from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from fastapi.responses import JSONResponse
from typing import List, Optional
import uuid
import os
import shutil

from app.core.db import get_connection
from app.core.security import get_current_verified_user
from app.core.config import settings
from app.validation.profile import validate_profile_update, validate_tags
from app.db.profiles import get_suggested_profiles, update_fame_rating
from app.db.realtime import create_notification
from app.api.realtime import broadcast_notification, manager

router = APIRouter()

@router.get("/me")
async def get_my_profile(
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Get current user's profile"""
    # Get profile
    profile = await conn.fetchrow("""
    SELECT * FROM profiles
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Get profile pictures
    pictures = await conn.fetch("""
    SELECT id, profile_id, file_path, backend_url, is_primary, created_at
    FROM profile_pictures
    WHERE profile_id = $1
    ORDER BY is_primary DESC, created_at ASC
    """, profile["id"])
    
    # Get profile tags
    tags = await conn.fetch("""
    SELECT t.id, t.name
    FROM tags t
    JOIN profile_tags pt ON t.id = pt.tag_id
    WHERE pt.profile_id = $1
    """, profile["id"])
    
    # Combine data
    result = dict(profile)
    result["pictures"] = [dict(pic) for pic in pictures]
    result["tags"] = [dict(tag) for tag in tags]
    
    return result

@router.put("/me")
async def update_my_profile(
    request: Request,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Update current user's profile"""
    data = await request.json()
    
    # Validate profile data
    is_valid, errors = validate_profile_update(data)
    if not is_valid:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": errors}
        )
    
    # Get current profile
    profile = await conn.fetchrow("""
    SELECT id FROM profiles
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Build update query based on provided fields
    update_fields = []
    params = [profile["id"]]  # First parameter is always profile_id
    param_idx = 2
    
    for key, value in data.items():
        if key in ["gender", "sexual_preference", "biography", "latitude", "longitude"]:
            update_fields.append(f"{key} = ${param_idx}")
            params.append(value)
            param_idx += 1
        elif key == "birth_date" and value:
            # Convert birth_date string to datetime object
            try:
                if isinstance(value, str):
                    birth_date = datetime.fromisoformat(value.replace('Z', '+00:00'))
                else:
                    birth_date = value
                update_fields.append(f"{key} = ${param_idx}")
                params.append(birth_date)
                param_idx += 1
            except ValueError:
                # Skip invalid date
                pass
    
    # Add updated_at field
    update_fields.append(f"updated_at = ${param_idx}")
    params.append(datetime.now(timezone.utc))
    param_idx += 1
    
    # Check if profile would be complete after this update
    gender = data.get("gender", None)
    sexual_preference = data.get("sexual_preference", None)
    biography = data.get("biography", None)
    latitude = data.get("latitude", None)
    longitude = data.get("longitude", None)
    
    # Get existing values if not in update
    if gender is None or sexual_preference is None or biography is None or latitude is None or longitude is None:
        existing = await conn.fetchrow("""
        SELECT gender, sexual_preference, biography, latitude, longitude
        FROM profiles WHERE id = $1
        """, profile["id"])
        
        gender = gender or existing["gender"]
        sexual_preference = sexual_preference or existing["sexual_preference"]
        biography = biography or existing["biography"]
        latitude = latitude or existing["latitude"]
        longitude = longitude or existing["longitude"]
    
    # Get picture count
    pic_count = await conn.fetchval("""
    SELECT COUNT(*) FROM profile_pictures
    WHERE profile_id = $1
    """, profile["id"])
    
    # Get tag count
    tag_count = await conn.fetchval("""
    SELECT COUNT(*) FROM profile_tags
    WHERE profile_id = $1
    """, profile["id"])
    
    # Check if profile is complete
    is_complete = (
        gender is not None and 
        sexual_preference is not None and 
        biography is not None and 
        latitude is not None and 
        longitude is not None and
        pic_count > 0 and
        tag_count > 0
    )
    
    # Add is_complete to update
    update_fields.append(f"is_complete = ${param_idx}")
    params.append(is_complete)
    
    # If no fields to update, return early
    if len(update_fields) <= 2:  # Only updated_at and is_complete
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    # Execute update
    query = f"""
    UPDATE profiles
    SET {", ".join(update_fields)}
    WHERE id = $1
    RETURNING *
    """
    
    updated_profile = await conn.fetchrow(query, *params)
    
    if not updated_profile:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )
    
    # Get profile pictures
    pictures = await conn.fetch("""
    SELECT id, profile_id, file_path, backend_url, is_primary, created_at
    FROM profile_pictures
    WHERE profile_id = $1
    ORDER BY is_primary DESC, created_at ASC
    """, profile["id"])
    
    # Get profile tags
    tags = await conn.fetch("""
    SELECT t.id, t.name
    FROM tags t
    JOIN profile_tags pt ON t.id = pt.tag_id
    WHERE pt.profile_id = $1
    """, profile["id"])
    
    # Combine data
    result = dict(updated_profile)
    result["pictures"] = [dict(pic) for pic in pictures]
    result["tags"] = [dict(tag) for tag in tags]
    
    return result

@router.put("/me/tags")
async def update_my_tags(
    request: Request,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Update current user's profile tags"""
    data = await request.json()
    tags = data.get("tags", [])
    
    # Validate tags
    is_valid, errors = validate_tags(tags)
    if not is_valid:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": errors}
        )
    
    # Get profile
    profile = await conn.fetchrow("""
    SELECT id FROM profiles
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Update tags
    async with conn.transaction():
        # Remove all existing tags
        await conn.execute("""
        DELETE FROM profile_tags
        WHERE profile_id = $1
        """, profile["id"])
        
        # Add new tags
        for tag_name in tags:
            # Check if tag exists
            tag_id = await conn.fetchval("""
            SELECT id FROM tags
            WHERE name = $1
            """, tag_name.lower())
            
            # Create tag if it doesn't exist
            if not tag_id:
                tag_id = await conn.fetchval("""
                INSERT INTO tags (name)
                VALUES ($1)
                RETURNING id
                """, tag_name.lower())
            
            # Add tag to profile
            await conn.execute("""
            INSERT INTO profile_tags (profile_id, tag_id)
            VALUES ($1, $2)
            """, profile["id"], tag_id)
        
        # Update profile completeness
        pic_count = await conn.fetchval("""
        SELECT COUNT(*) FROM profile_pictures
        WHERE profile_id = $1
        """, profile["id"])
        
        existing = await conn.fetchrow("""
        SELECT gender, sexual_preference, biography, latitude, longitude
        FROM profiles WHERE id = $1
        """, profile["id"])
        
        is_complete = (
            len(tags) > 0 and 
            pic_count > 0 and
            existing["gender"] is not None and 
            existing["sexual_preference"] is not None and 
            existing["biography"] is not None and 
            existing["latitude"] is not None and 
            existing["longitude"] is not None
        )
        
        await conn.execute("""
        UPDATE profiles
        SET is_complete = $2, updated_at = $3
        WHERE id = $1
        """, profile["id"], is_complete, datetime.now(timezone.utc))
    
    # Get updated profile
    updated_profile = await conn.fetchrow("""
    SELECT * FROM profiles
    WHERE id = $1
    """, profile["id"])
    
    # Get profile pictures
    pictures = await conn.fetch("""
    SELECT id, profile_id, file_path, backend_url, is_primary, created_at
    FROM profile_pictures
    WHERE profile_id = $1
    ORDER BY is_primary DESC, created_at ASC
    """, profile["id"])
    
    # Get new tags
    new_tags = await conn.fetch("""
    SELECT t.id, t.name
    FROM tags t
    JOIN profile_tags pt ON t.id = pt.tag_id
    WHERE pt.profile_id = $1
    """, profile["id"])
    
    # Combine data
    result = dict(updated_profile)
    result["pictures"] = [dict(pic) for pic in pictures]
    result["tags"] = [dict(tag) for tag in new_tags]
    
    return result

@router.put("/me/location")
async def update_location(
    request: Request,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Update current user's location"""
    data = await request.json()
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    
    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Latitude and longitude are required"
        )
    
    # Validate coordinates
    if latitude < -90 or latitude > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Latitude must be between -90 and 90"
        )
    
    if longitude < -180 or longitude > 180:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Longitude must be between -180 and 180"
        )
    
    # Get profile
    profile = await conn.fetchrow("""
    SELECT id, gender, sexual_preference, biography, is_complete
    FROM profiles
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Update location
    await conn.execute("""
    UPDATE profiles
    SET latitude = $2, longitude = $3, updated_at = $4
    WHERE id = $1
    """, profile["id"], latitude, longitude, datetime.now(timezone.utc))
    
    # Check if profile would be complete after this update
    pic_count = await conn.fetchval("""
    SELECT COUNT(*) FROM profile_pictures
    WHERE profile_id = $1
    """, profile["id"])
    
    tag_count = await conn.fetchval("""
    SELECT COUNT(*) FROM profile_tags
    WHERE profile_id = $1
    """, profile["id"])
    
    is_complete = (
        profile["gender"] is not None and 
        profile["sexual_preference"] is not None and 
        profile["biography"] is not None and 
        latitude is not None and 
        longitude is not None and
        pic_count > 0 and
        tag_count > 0
    )
    
    if is_complete != profile["is_complete"]:
        await conn.execute("""
        UPDATE profiles
        SET is_complete = $2
        WHERE id = $1
        """, profile["id"], is_complete)
    
    # Get updated profile
    updated_profile = await conn.fetchrow("""
    SELECT * FROM profiles
    WHERE id = $1
    """, profile["id"])
    
    # Get profile pictures
    pictures = await conn.fetch("""
    SELECT id, profile_id, file_path, backend_url, is_primary, created_at
    FROM profile_pictures
    WHERE profile_id = $1
    ORDER BY is_primary DESC, created_at ASC
    """, profile["id"])
    
    # Get profile tags
    tags = await conn.fetch("""
    SELECT t.id, t.name
    FROM tags t
    JOIN profile_tags pt ON t.id = pt.tag_id
    WHERE pt.profile_id = $1
    """, profile["id"])
    
    # Combine data
    result = dict(updated_profile)
    result["pictures"] = [dict(pic) for pic in pictures]
    result["tags"] = [dict(tag) for tag in tags]
    
    return result

@router.post("/me/pictures")
async def upload_profile_picture(
    is_primary: bool = Form(False),
    file: UploadFile = File(...),
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Upload a profile picture"""
    # Get profile
    profile = await conn.fetchrow("""
    SELECT id FROM profiles
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Validate file type
    allowed_extensions = [".jpg", ".jpeg", ".png", ".gif"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Check picture count limit
    pic_count = await conn.fetchval("""
    SELECT COUNT(*) FROM profile_pictures
    WHERE profile_id = $1
    """, profile["id"])
    
    if pic_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum number of pictures reached (5)"
        )
    
    # Create upload directory
    upload_dir = os.path.join(settings.MEDIA_ROOT, "profile_pictures", str(profile["id"]))
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate filename and save file
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Normalize file path for database
    relative_path = os.path.relpath(file_path, start=os.path.dirname(settings.MEDIA_ROOT))
    
    # Create backend URL
    backend_url = f"{settings.BACKEND_URL}/{relative_path.replace(os.sep, '/')}"
    
    # If this is the first picture or primary is specified, make it primary
    if pic_count == 0 or is_primary:
        # Unset any existing primary pictures
        await conn.execute("""
        UPDATE profile_pictures
        SET is_primary = false
        WHERE profile_id = $1
        """, profile["id"])
        
        is_primary = True
    
    # Add picture to database
    picture = await conn.fetchrow("""
    INSERT INTO profile_pictures (profile_id, file_path, backend_url, is_primary)
    VALUES ($1, $2, $3, $4)
    RETURNING id, profile_id, file_path, backend_url, is_primary, created_at
    """, profile["id"], relative_path, backend_url, is_primary)
    
    # Check if profile is complete
    existing = await conn.fetchrow("""
    SELECT gender, sexual_preference, biography, latitude, longitude
    FROM profiles WHERE id = $1
    """, profile["id"])
    
    tag_count = await conn.fetchval("""
    SELECT COUNT(*) FROM profile_tags
    WHERE profile_id = $1
    """, profile["id"])
    
    is_complete = (
        pic_count + 1 > 0 and 
        tag_count > 0 and
        existing["gender"] is not None and 
        existing["sexual_preference"] is not None and 
        existing["biography"] is not None and 
        existing["latitude"] is not None and 
        existing["longitude"] is not None
    )
    
    await conn.execute("""
    UPDATE profiles
    SET is_complete = $2, updated_at = $3
    WHERE id = $1
    """, profile["id"], is_complete, datetime.now(timezone.utc))
    
    return dict(picture)

@router.put("/me/pictures/{picture_id}/primary")
async def set_primary_profile_picture(
    picture_id: int,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Set a profile picture as primary"""
    # Get profile
    profile = await conn.fetchrow("""
    SELECT id FROM profiles
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Check if picture exists
    picture = await conn.fetchrow("""
    SELECT id FROM profile_pictures
    WHERE id = $1 AND profile_id = $2
    """, picture_id, profile["id"])
    
    if not picture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Picture not found"
        )
    
    # Update all pictures to not be primary
    await conn.execute("""
    UPDATE profile_pictures
    SET is_primary = false
    WHERE profile_id = $1
    """, profile["id"])
    
    # Set this picture as primary
    await conn.execute("""
    UPDATE profile_pictures
    SET is_primary = true
    WHERE id = $1
    """, picture_id)
    
    # Get updated picture
    updated_picture = await conn.fetchrow("""
    SELECT id, profile_id, file_path, backend_url, is_primary, created_at
    FROM profile_pictures
    WHERE id = $1
    """, picture_id)
    
    return dict(updated_picture)

@router.delete("/me/pictures/{picture_id}")
async def delete_profile_picture(
    picture_id: int,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Delete a profile picture"""
    # Get profile
    profile = await conn.fetchrow("""
    SELECT id FROM profiles
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Get picture
    picture = await conn.fetchrow("""
    SELECT id, file_path, is_primary FROM profile_pictures
    WHERE id = $1 AND profile_id = $2
    """, picture_id, profile["id"])
    
    if not picture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Picture not found"
        )
    
    # Check if this is the primary picture
    was_primary = picture["is_primary"]
    
    # Delete picture from filesystem
    file_path = os.path.join(settings.MEDIA_ROOT, picture["file_path"])
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Delete picture from database
    await conn.execute("""
    DELETE FROM profile_pictures
    WHERE id = $1
    """, picture_id)
    
    # If this was the primary picture, set a new primary
    if was_primary:
        # Get another picture to make primary
        another_picture = await conn.fetchval("""
        SELECT id FROM profile_pictures
        WHERE profile_id = $1
        LIMIT 1
        """, profile["id"])
        
        if another_picture:
            await conn.execute("""
            UPDATE profile_pictures
            SET is_primary = true
            WHERE id = $1
            """, another_picture)
    
    # Check if profile is still complete
    pic_count = await conn.fetchval("""
    SELECT COUNT(*) FROM profile_pictures
    WHERE profile_id = $1
    """, profile["id"])
    
    existing = await conn.fetchrow("""
    SELECT gender, sexual_preference, biography, latitude, longitude, is_complete
    FROM profiles WHERE id = $1
    """, profile["id"])
    
    tag_count = await conn.fetchval("""
    SELECT COUNT(*) FROM profile_tags
    WHERE profile_id = $1
    """, profile["id"])
    
    is_complete = (
        pic_count > 0 and 
        tag_count > 0 and
        existing["gender"] is not None and 
        existing["sexual_preference"] is not None and 
        existing["biography"] is not None and 
        existing["latitude"] is not None and 
        existing["longitude"] is not None
    )
    
    if is_complete != existing["is_complete"]:
        await conn.execute("""
        UPDATE profiles
        SET is_complete = $2, updated_at = $3
        WHERE id = $1
        """, profile["id"], is_complete, datetime.now(timezone.utc))
    
    return {"message": "Picture deleted successfully"}


@router.get("/suggested")
async def get_suggested(
    limit: int = 20,
    offset: int = 0,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    min_fame: Optional[float] = None,
    max_fame: Optional[float] = None,
    max_distance: Optional[float] = None,
        tags: Optional[List[str]] = Query(
        None, 
        description="List of tags to filter by",
        example=["music", "kitap"],
        openapi_examples={
            "single_tag": {
                "summary": "Single tag filter",
                "value": ["music"]
            },
            "multiple_tags": {
                "summary": "Multiple tag filter",
                "value": ["music", "kitap", "spor"]
            }
        }
    ),
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """
    Get suggested profiles with age-based filtering
    """
    # Get user's profile
    profile = await conn.fetchrow("""
    SELECT id, is_complete FROM profiles
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil bulunamadı"
        )
    
    # Check if profile is complete
    if not profile["is_complete"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Lütfen profilinizi tamamlayın"
        )
    
    try:
        # Get suggested profiles with filters
        suggested = await get_suggested_profiles(
            conn=conn,
            user_id=current_user["id"],
            limit=limit,
            offset=offset,
            min_age=min_age,
            max_age=max_age,
            min_fame=min_fame,
            max_fame=max_fame,
            max_distance=max_distance,
            tags=tags
        )
                
        return suggested
        
    except Exception as e:
        # Log the error
        import logging
        logging.error(f"Error in get_suggested: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching suggested profiles: {str(e)}"
        )

@router.get("/{username}")
async def get_profile(
    username: str,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """
    Get a profile by username
    """
    try:
        # Get basic profile info
        profile_user = await conn.fetchrow("""
        SELECT p.id, p.user_id, p.gender, p.sexual_preference, p.biography,
               p.latitude, p.longitude, p.fame_rating, p.birth_date,
               u.username, u.first_name, u.last_name, u.is_online, u.last_online
        FROM profiles p
        JOIN users u ON p.user_id = u.id
        WHERE u.username = $1
        """, username)
        
        if not profile_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
        
        # Check if profile user has blocked current user
        is_blocked = await conn.fetchval("""
        SELECT id FROM blocks
        WHERE blocker_id = $2 AND blocked_id = $1
        """, current_user["id"], profile_user["id"])
        
        if is_blocked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Blocked profile"
            )
        
        # Get profile pictures
        pictures = await conn.fetch("""
        SELECT id, profile_id, file_path, backend_url, is_primary, created_at
        FROM profile_pictures
        WHERE profile_id = $1
        ORDER BY is_primary DESC, created_at ASC
        """, profile_user["id"])
        
        # Get profile tags
        tags = await conn.fetch("""
        SELECT t.id, t.name
        FROM tags t
        JOIN profile_tags pt ON t.id = pt.tag_id
        WHERE pt.profile_id = $1
        """, profile_user["id"])
        
        # Record visit if not own profile
        if profile_user["user_id"] != current_user["id"]:
            # Get current user's profile
            visitor_profile = await conn.fetchrow("""
            SELECT id FROM profiles
            WHERE user_id = $1
            """, current_user["id"])
            
            if visitor_profile:
                # Check if a visit was recorded recently (last 5 minutes)
                five_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
                recent_visit = await conn.fetchval("""
                SELECT id FROM visits
                WHERE visitor_id = $1 AND visited_id = $2 AND created_at > $3
                """, visitor_profile["id"], profile_user["id"], five_minutes_ago)
                
                # Only record new visit if no recent visit exists
                if not recent_visit:
                    # Record the visit
                    await conn.execute("""
                    INSERT INTO visits (visitor_id, visited_id, created_at)
                    VALUES ($1, $2, $3)
                    """, visitor_profile["id"], profile_user["id"], datetime.now(timezone.utc))
                    
                    # Create notification
                    await create_notification(conn, profile_user["user_id"], current_user["id"], "visit", f"{current_user['first_name']} profilinizi ziyaret etti!")

                    # Send WebSocket notification
                    await broadcast_notification(manager, profile_user["user_id"], "visit", current_user["id"], f"{current_user['first_name']} profilinizi ziyaret etti!")                    
                    # Update fame rating
                    await update_fame_rating(conn, profile_user["id"])
        
        # Combine all data into a single response
        profile_dict = dict(profile_user)
        profile_dict["pictures"] = [dict(pic) for pic in pictures]
        profile_dict["tags"] = [dict(tag) for tag in tags]
        
        return profile_dict
        
    except Exception as e:
        import logging
        logging.error(f"Error in get_profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching profile: {str(e)}"
        )
    
@router.get("/get-for-chat/{username}")
async def get_profile_for_chat(
    username: str,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """
    Get a profile by username
    """
    try:
        # Get basic profile info
        profile_user = await conn.fetchrow("""
        SELECT p.id, p.user_id, p.gender, p.sexual_preference, p.biography,
               p.latitude, p.longitude, p.fame_rating, p.birth_date,
               u.username, u.first_name, u.last_name, u.is_online, u.last_online
        FROM profiles p
        JOIN users u ON p.user_id = u.id
        WHERE u.username = $1
        """, username)
        
        if not profile_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
        
        # Get profile pictures
        pictures = await conn.fetch("""
        SELECT id, profile_id, file_path, backend_url, is_primary, created_at
        FROM profile_pictures
        WHERE profile_id = $1
        ORDER BY is_primary DESC, created_at ASC
        """, profile_user["id"])
        
        # Get profile tags
        tags = await conn.fetch("""
        SELECT t.id, t.name
        FROM tags t
        JOIN profile_tags pt ON t.id = pt.tag_id
        WHERE pt.profile_id = $1
        """, profile_user["id"])
        
        # Combine all data into a single response
        profile_dict = dict(profile_user)
        profile_dict["pictures"] = [dict(pic) for pic in pictures]
        profile_dict["tags"] = [dict(tag) for tag in tags]
        
        return profile_dict
        
    except Exception as e:
        import logging
        logging.error(f"Error in get_profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching profile: {str(e)}"
        )

@router.get("/get-by-user_id/{user_id}")
async def get_profile_by_user_id_endpoint(
    user_id: str,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """
    Get a profile by user_id
    """
    try:
        # Get basic profile info
        profile_user = await conn.fetchrow("""
        SELECT p.id, p.user_id, p.gender, p.sexual_preference, p.biography,
               p.latitude, p.longitude, p.fame_rating, p.birth_date,
               u.username, u.first_name, u.last_name, u.is_online, u.last_online
        FROM profiles p
        JOIN users u ON p.user_id = u.id
        WHERE u.id = $1
        """, user_id)
        
        if not profile_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found"
            )
        
        # Get profile pictures
        pictures = await conn.fetch("""
        SELECT id, profile_id, file_path, backend_url, is_primary, created_at
        FROM profile_pictures
        WHERE profile_id = $1
        ORDER BY is_primary DESC, created_at ASC
        """, profile_user["id"])
        
        # Get profile tags
        tags = await conn.fetch("""
        SELECT t.id, t.name
        FROM tags t
        JOIN profile_tags pt ON t.id = pt.tag_id
        WHERE pt.profile_id = $1
        """, profile_user["id"])
        
        # Combine all data into a single response
        profile_dict = dict(profile_user)
        profile_dict["pictures"] = [dict(pic) for pic in pictures]
        profile_dict["tags"] = [dict(tag) for tag in tags]
        
        return profile_dict
        
    except Exception as e:
        import logging
        logging.error(f"Error in get_profile_by_user_id: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching profile: {str(e)}"
        )

@router.get("/check-real-profile/{username}")
async def check_real_profile(
    username: str,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """
    Check if a profile is real
    """
    try:
        # Check if profile exists
        profile_exists = await conn.fetchval("""
        SELECT p.id
        FROM profiles p
        JOIN users u ON p.user_id = u.id
        WHERE u.username = $1
        """, username)
        
        return {"exists": profile_exists is not None}
        
    except Exception as e:
        import logging
        logging.error(f"Error in check_real_profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking profile: {str(e)}"
        )

@router.put("/me/delete-account")
async def delete_account(
    request: Request,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """
    Delete user account
    """
    try:
        # Parse request body
        data = await request.json()
        password = data.get("password")
        
        if not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required"
            )
        
        # Get user with password
        user = await conn.fetchrow("""
        SELECT hashed_password FROM users
        WHERE id = $1
        """, current_user["id"])
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Verify password - you'll need to import your password verification function
        from app.core.security import verify_password
        if not verify_password(password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hatalı şifre"
            )
        
        # Get profile
        profile = await conn.fetchrow("""
        SELECT id FROM profiles
        WHERE user_id = $1
        """, current_user["id"])
        
        if profile:
            # Get profile pictures
            pictures = await conn.fetch("""
            SELECT id, file_path FROM profile_pictures
            WHERE profile_id = $1
            """, profile["id"])
            
            # Delete physical picture files
            for picture in pictures:
                file_path = os.path.join(settings.MEDIA_ROOT, picture["file_path"])
                if os.path.exists(file_path):
                    os.remove(file_path)
        
        # Start a transaction
        async with conn.transaction():
            # The profile and related data will be deleted by cascading constraints
            
            # Delete user
            await conn.execute("""
            DELETE FROM users
            WHERE id = $1
            """, current_user["id"])
        
        return {"message": "Hesap başarıyla silindi"}
        
    except Exception as e:
        import logging
        logging.error(f"Error in delete_account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting account: {str(e)}"
        )    

@router.post("/liked-status")
async def get_liked_status_batch(
    request: Request,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """
    Get liked status for multiple profiles in a single request
    Input: List of profile IDs
    Output: List of profile IDs that the current user has liked
    """
    try:
        # Get request body
        data = await request.json()
        profile_ids = data.get("profileIds", [])
        
        if not profile_ids:
            return {"likedProfiles": []}
        
        # Get user's profile
        user_profile = await conn.fetchrow("""
        SELECT id FROM profiles 
        WHERE user_id = $1
        """, current_user["id"])
        
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Your profile not found"
            )
        
        # Query for likes
        # Using ANY with array for more efficient querying
        liked_profiles = await conn.fetch("""
        SELECT liked_id FROM likes
        WHERE liker_id = $1 AND liked_id = ANY($2)
        """, user_profile["id"], profile_ids)
        
        # Extract just the IDs into a list
        liked_profile_ids = [str(row["liked_id"]) for row in liked_profiles]
        
        return {"likedProfiles": liked_profile_ids}
        
    except Exception as e:
        print(f"Error in get_liked_status_batch: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking liked status: {str(e)}"
        )


@router.get("/me/is-liked/{username}")
async def check_if_liked(
    username: str,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """
    Check if current user has liked a profile
    """
    try:
        # Get target profile by username
        target_profile = await conn.fetchrow("""
        SELECT p.id 
        FROM profiles p
        JOIN users u ON p.user_id = u.id
        WHERE u.username = $1
        """, username)
        
        if not target_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hedef profil bulunamadı"
            )
        
        # Get current user's profile
        current_profile = await conn.fetchrow("""
        SELECT id FROM profiles 
        WHERE user_id = $1
        """, current_user["id"])
        
        if not current_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profil bulunamadı"
            )
        
        # Check if the user has liked the target profile
        like = await conn.fetchval("""
        SELECT id FROM likes
        WHERE liker_id = $1 AND liked_id = $2
        """, current_profile["id"], target_profile["id"])
        
        return {"is_liked": like is not None}
        
    except Exception as e:
        import logging
        logging.error(f"Error in check_if_liked: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    
