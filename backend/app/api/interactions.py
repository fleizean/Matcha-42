from datetime import datetime, timezone
import json
from fastapi import APIRouter, Depends, HTTPException, status, Request

from app.core.db import get_connection
from app.core.security import get_current_verified_user
from app.db.profiles import get_profile_by_user_id, get_profile_pictures, get_profile_tags
from app.db.interactions import like_profile, unlike_profile

router = APIRouter()

@router.post("/like")
async def create_like(
    request: Request,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Like a profile"""
    data = await request.json()
    liked_id = data.get("liked_id")
    
    if not liked_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Liked profile ID is required"
        )
    
    liker_profile = await get_profile_by_user_id(conn, current_user["id"])
      
    # Like profile
    result = await like_profile(conn, liker_profile["id"], liked_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not like profile. The profile may not exist or might be blocked."
        )
   
    return {
        "message": "Profile liked successfully",
        "is_match": result["is_match"]
    }

@router.delete("/like/{profile_id}")
async def delete_like(
    profile_id: str,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Unlike a profile"""
    # Get current user's profile
    liker_profile = await get_profile_by_user_id(conn, current_user["id"])

    
    if not liker_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your profile not found"
        )
    
  
    result = await unlike_profile(conn, liker_profile["id"], profile_id)
    
    if not result["unliked"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile to unlike not found"
        )
         
    return {
        "message": "Profile unliked successfully"
    }


@router.post("/block")
async def create_block(
    request: Request,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Block a profile"""
    data = await request.json()
    
    # Get blocked_id from either profile_id or user_id
    blocked_id = data.get("blocked_id")
    blocked_user_id = data.get("blocked_user_id")
    
    if not blocked_id and not blocked_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either blocked_id or blocked_user_id is required"
        )
    
    # Get blocker's profile
    blocker_profile = await conn.fetchrow("""
    SELECT id FROM profiles 
    WHERE user_id = $1
    """, current_user["id"])
    
    if not blocker_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your profile not found"
        )
      
    # Check if blocked profile exists
    blocked_profile_exists = await conn.fetchval("""
    SELECT id FROM profiles 
    WHERE id = $1
    """, blocked_id)
    
    if not blocked_profile_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile to block not found"
        )
    
    # Can't block yourself
    if blocked_id == blocker_profile["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot block yourself"
        )
    
    # Check if already blocked
    existing_block = await conn.fetchrow("""
    SELECT id FROM blocks
    WHERE blocker_id = $1 AND blocked_id = $2
    """, blocker_profile["id"], blocked_id)
    
    if existing_block:
        return {
            "message": "Profile already blocked"
        }
    
    # Unlike the blocked profile if it was liked
    await unlike_profile(conn, blocker_profile["id"], blocked_id, both_ways=True)
    
    # Create block
    await conn.execute("""
    INSERT INTO blocks (blocker_id, blocked_id, created_at)
    VALUES ($1, $2, $3)
    """, blocker_profile["id"], blocked_id, datetime.now(timezone.utc))
    
    
    return {
        "message": "Profile blocked successfully"
    }

@router.delete("/block/{profile_id}")
async def delete_block(
    profile_id: str,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Unblock a profile"""
    # Get blocker's profile
    blocker_profile = await conn.fetchrow("""
    SELECT id FROM profiles 
    WHERE user_id = $1
    """, current_user["id"])
    
    if not blocker_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your profile not found"
        )
    
    # Delete the block
    deleted = await conn.fetchval("""
    DELETE FROM blocks
    WHERE blocker_id = $1 AND blocked_id = $2
    RETURNING id
    """, blocker_profile["id"], profile_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Block not found or already removed"
        )
    
    return {
        "message": "Profile unblocked successfully"
    }

@router.get("/blocks")
async def get_blocks(
    limit: int = 10,
    offset: int = 0,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Get profiles that the current user has blocked"""
    # Get user's profile
    profile = await conn.fetchrow("""
    SELECT id FROM profiles 
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your profile not found"
        )
    
    # Get blocked profiles with their details
    blocked_profiles = await conn.fetch("""
    SELECT p.id, p.user_id, p.gender, p.sexual_preference, p.biography,
           p.latitude, p.longitude, p.fame_rating, p.birth_date,
           u.username, u.first_name, u.last_name, u.is_online, u.last_online
    FROM blocks b
    JOIN profiles p ON b.blocked_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE b.blocker_id = $1
    ORDER BY b.created_at DESC
    LIMIT $2 OFFSET $3
    """, profile["id"], limit, offset)
    
    # Get profile pictures for each blocked profile
    result = []
    for blocked in blocked_profiles:
        # Format the profile data
        profile_data = dict(blocked)
        
        # Get profile pictures
        pictures = await get_profile_pictures(conn, blocked["id"])
        
        # Get profile tags
        tags = await get_profile_tags(conn, blocked["id"])
        
        # Add pictures and tags to the profile data
        profile_data["pictures"] = [dict(pic) for pic in pictures]
        profile_data["tags"] = [dict(tag) for tag in tags]
        
        result.append(profile_data)
    
    return result

@router.post("/is_blocked")
async def check_if_blocked(
    request: Request,
    blocked_username: str = None,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Check if a user is blocked and who initiated the block"""
    # Try getting from query params first
    username = blocked_username
    
    # If not in query params, try getting from request body
    if not username:
        try:
            data = await request.json()
            username = data.get("username")
        except json.JSONDecodeError:
            pass
    
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required"
        )
    
    # Get current user's profile
    user_profile = await conn.fetchrow("""
    SELECT id FROM profiles 
    WHERE user_id = $1
    """, current_user["id"])
    
    if not user_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your profile not found"
        )
    
    # Get the profile by username
    other_profile = await conn.fetchrow("""
    SELECT p.id 
    FROM profiles p
    JOIN users u ON p.user_id = u.id
    WHERE u.username = $1
    """, username)
    
    if not other_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Check both directions of blocking
    blocked_by_me = await conn.fetchval("""
    SELECT id FROM blocks
    WHERE blocker_id = $1 AND blocked_id = $2
    """, user_profile["id"], other_profile["id"])
    
    blocked_by_them = await conn.fetchval("""
    SELECT id FROM blocks
    WHERE blocker_id = $1 AND blocked_id = $2
    """, other_profile["id"], user_profile["id"])
    
    return {
        "is_blocked": blocked_by_me is not None or blocked_by_them is not None,
        "blocked_by_me": blocked_by_me is not None,
        "blocked_by_them": blocked_by_them is not None,
        "blocker_id": other_profile["id"] if blocked_by_them else (user_profile["id"] if blocked_by_me else None)
    }


@router.post("/report")
async def create_report(
    request: Request,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Report a profile"""
    data = await request.json()
    reported_id = data.get("reported_id")
    reason = data.get("reason")
    description = data.get("description")
    
    if not reported_id or not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reported profile ID and reason are required"
        )
    
    # Get reporter's profile
    reporter_profile = await conn.fetchrow("""
    SELECT id FROM profiles 
    WHERE user_id = $1
    """, current_user["id"])
    
    if not reporter_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your profile not found"
        )
    
    # Check if reported profile exists
    reported_profile = await conn.fetchval("""
    SELECT id FROM profiles 
    WHERE id = $1
    """, reported_id)
    
    if not reported_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile to report not found"
        )
    
    # Can't report yourself
    if reported_id == reporter_profile["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot report yourself"
        )
    
    # Create report
    report_id = await conn.fetchval("""
    INSERT INTO reports (reporter_id, reported_id, reason, description, created_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
    """, reporter_profile["id"], reported_id, reason, description, datetime.now(timezone.utc))
    
    return {
        "message": "Profile reported successfully",
        "report_id": report_id
    }

@router.get("/likes")
async def get_likes(
    limit: int = 10,
    offset: int = 0,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Get profiles that liked the current user"""
    # Get user's profile
    profile = await conn.fetchrow("""
    SELECT id FROM profiles 
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your profile not found"
        )
    
    # Get profiles that liked the user with eager loading
    likes_received = await conn.fetch("""
    SELECT p.id, p.user_id, p.gender, p.sexual_preference, p.biography,
           p.latitude, p.longitude, p.fame_rating, p.birth_date,
           u.username, u.first_name, u.last_name, u.is_online, u.last_online
    FROM likes l
    JOIN profiles p ON l.liker_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE l.liked_id = $1
    ORDER BY l.created_at DESC
    LIMIT $2 OFFSET $3
    """, profile["id"], limit, offset)
    
    # Get profile pictures and tags for each profile
    result = []
    for like in likes_received:
        # Format the profile data
        profile_data = dict(like)
        
        # Get profile pictures
        pictures = await get_profile_pictures(conn, like["id"])
        
        # Get profile tags
        tags = await get_profile_tags(conn, like["id"])
        
        # Add pictures and tags to the profile data
        profile_data["pictures"] = [dict(pic) for pic in pictures]
        profile_data["tags"] = [dict(tag) for tag in tags]
        
        result.append(profile_data)
    
    return result


@router.get("/visits")
async def get_visits(
    username: str,
    limit: int = 10,
    offset: int = 0,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """Get profiles that visited the specified user's profile"""
    # Get current user's profile
    user_profile = await conn.fetchrow("""
    SELECT id FROM profiles 
    WHERE user_id = $1
    """, current_user["id"])
    
    if not user_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your profile not found"
        )
    
    # Get the target profile by username
    username_profile = await conn.fetchrow("""
    SELECT p.id, p.user_id
    FROM profiles p
    JOIN users u ON p.user_id = u.id
    WHERE u.username = $1
    """, username)
    
    if not username_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile with username {username} not found"
        )
    
    # Check permission - only allow current user to see their own visits
    if username_profile["user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own visits"
        )
    
    # Get profiles that visited the user
    visits_received = await conn.fetch("""
    SELECT p.id, p.user_id, p.gender, p.sexual_preference, p.biography,
           p.latitude, p.longitude, p.fame_rating, p.birth_date,
           u.username, u.first_name, u.last_name, u.is_online, u.last_online
    FROM visits v
    JOIN profiles p ON v.visitor_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE v.visited_id = $1
    ORDER BY v.created_at DESC
    LIMIT $2 OFFSET $3
    """, username_profile["id"], limit, offset)
    
    # Get profile pictures and tags for each visitor
    result = []
    for visit in visits_received:
        # Format the profile data
        profile_data = dict(visit)
        
        # Get profile pictures
        pictures = await get_profile_pictures(conn, visit["id"])
        
        # Get profile tags
        tags = await get_profile_tags(conn, visit["id"])
        
        # Add pictures and tags to the profile data
        profile_data["pictures"] = [dict(pic) for pic in pictures]
        profile_data["tags"] = [dict(tag) for tag in tags]
        
        result.append(profile_data)
    
    return result

@router.get("/matches")
async def get_user_matches(
    limit: int = 10,
    offset: int = 0,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
):
    """
    Get current user's matches (mutual likes)
    """
    # Get user's profile
    profile = await conn.fetchrow("""
    SELECT id FROM profiles 
    WHERE user_id = $1
    """, current_user["id"])
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your profile not found"
        )
    
    # Get matches (mutual likes) with their profile details
    # A match is when both users have liked each other and have an active connection
    matches = await conn.fetch("""
    SELECT p.id, p.user_id, p.gender, p.sexual_preference, p.biography,
           p.latitude, p.longitude, p.fame_rating, p.birth_date,
           u.username, u.first_name, u.last_name, u.is_online, u.last_online
    FROM connections c
    JOIN users u ON (c.user1_id = $1 AND c.user2_id = u.id) OR (c.user2_id = $1 AND c.user1_id = u.id)
    JOIN profiles p ON u.id = p.user_id
    WHERE c.is_active = true
    ORDER BY c.updated_at DESC
    LIMIT $2 OFFSET $3
    """, current_user["id"], limit, offset)
    
    # Get profile pictures and tags for each match
    result = []
    for match in matches:
        # Format the profile data
        profile_data = dict(match)
        
        # Get profile pictures
        pictures = await get_profile_pictures(conn, match["id"])
        
        # Get profile tags
        tags = await get_profile_tags(conn, match["id"])
        
        # Add pictures and tags to the profile data
        profile_data["pictures"] = [dict(pic) for pic in pictures]
        profile_data["tags"] = [dict(tag) for tag in tags]
        
        result.append(profile_data)
    
    return result