import uuid
from datetime import datetime, timedelta, timezone

from app.utils.geolocation import get_bounding_box, haversine_distance

async def get_profile_by_id(conn, profile_id):
    """Get a profile by ID"""
    query = """
    SELECT id, user_id, gender, sexual_preference, biography,
           latitude, longitude, fame_rating, is_complete,
           birth_date, created_at, updated_at
    FROM profiles
    WHERE id = $1
    """
    return await conn.fetchrow(query, profile_id)

async def get_profile_by_user_id(conn, user_id):
    """Get a profile by user ID"""
    query = """
    SELECT id, user_id, gender, sexual_preference, biography,
           latitude, longitude, fame_rating, is_complete,
           birth_date, created_at, updated_at
    FROM profiles
    WHERE user_id = $1
    """
    return await conn.fetchrow(query, user_id)

async def get_profile_by_username(conn, username):
    """Get a profile by username"""
    query = """
    SELECT p.id, p.user_id, p.gender, p.sexual_preference, p.biography,
           p.latitude, p.longitude, p.fame_rating, p.is_complete,
           p.birth_date, p.created_at, p.updated_at
    FROM profiles p
    JOIN users u ON p.user_id = u.id
    WHERE u.username = $1
    """
    return await conn.fetchrow(query, username)

async def create_profile(conn, user_id):
    """Create a new profile for a user"""
    profile_id = str(uuid.uuid4())
    query = """
    INSERT INTO profiles (id, user_id, is_complete, fame_rating)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    """
    return await conn.fetchval(query, profile_id, user_id, False, 0.0)

async def update_profile(conn, profile_id, profile_data):
    """Update profile information"""
    # Build dynamic update query based on provided fields
    fields = []
    values = [profile_id]  # First parameter is always the profile_id
    param_idx = 2

    for key, value in profile_data.items():
        if key in ['gender', 'sexual_preference', 'biography', 'latitude', 'longitude', 'birth_date', 'is_complete']:
            fields.append(f"{key} = ${param_idx}")
            values.append(value)
            param_idx += 1

    # Add updated_at field
    fields.append(f"updated_at = ${param_idx}")
    values.append(datetime.now(timezone.utc))

    # If no fields to update, return early
    if not fields:
        return None

    query = f"""
    UPDATE profiles
    SET {', '.join(fields)}
    WHERE id = $1
    RETURNING id, user_id, gender, sexual_preference, biography,
              latitude, longitude, fame_rating, is_complete, birth_date
    """
    
    return await conn.fetchrow(query, *values)

async def is_profile_complete(conn, profile_id):
    """Check if a profile is complete with all required information"""
    # Get profile details
    profile = await get_profile_by_id(conn, profile_id)
    if not profile:
        return False
    
    # Check required fields
    if (profile['gender'] is None or
        profile['sexual_preference'] is None or
        profile['biography'] is None or
        profile['latitude'] is None or
        profile['longitude'] is None):
        return False
    
    # Check if profile has at least one picture
    pic_count = await conn.fetchval("""
    SELECT COUNT(*) FROM profile_pictures
    WHERE profile_id = $1
    """, profile_id)
    
    if pic_count == 0:
        return False
    
    # Check if profile has at least one tag
    tag_count = await conn.fetchval("""
    SELECT COUNT(*) FROM profile_tags
    WHERE profile_id = $1
    """, profile_id)
    
    if tag_count == 0:
        return False
    
    return True

async def get_profile_pictures(conn, profile_id):
    """Get all pictures for a profile"""
    query = """
    SELECT id, profile_id, file_path, backend_url, is_primary, created_at
    FROM profile_pictures
    WHERE profile_id = $1
    ORDER BY is_primary DESC, created_at ASC
    """
    return await conn.fetch(query, profile_id)

async def add_profile_picture(conn, profile_id, file_path, backend_url, is_primary=False):
    """Add a picture to a profile"""
    # If this is primary, unset any existing primary pictures
    if is_primary:
        await conn.execute("""
        UPDATE profile_pictures
        SET is_primary = false
        WHERE profile_id = $1
        """, profile_id)
    
    query = """
    INSERT INTO profile_pictures (profile_id, file_path, backend_url, is_primary)
    VALUES ($1, $2, $3, $4)
    RETURNING id, profile_id, file_path, backend_url, is_primary, created_at
    """
    return await conn.fetchrow(query, profile_id, file_path, backend_url, is_primary)

async def set_primary_picture(conn, profile_id, picture_id):
    """Set a picture as primary for a profile"""
    # First unset all primary pictures
    await conn.execute("""
    UPDATE profile_pictures
    SET is_primary = false
    WHERE profile_id = $1
    """, profile_id)
    
    # Then set the selected picture as primary
    query = """
    UPDATE profile_pictures
    SET is_primary = true
    WHERE id = $1 AND profile_id = $2
    RETURNING id
    """
    return await conn.fetchval(query, picture_id, profile_id)

async def remove_profile_picture(conn, picture_id, profile_id):
    """Remove a picture from a profile"""
    query = """
    DELETE FROM profile_pictures
    WHERE id = $1 AND profile_id = $2
    RETURNING id, is_primary
    """
    return await conn.fetchrow(query, picture_id, profile_id)

async def get_profile_tags(conn, profile_id):
    """Get all tags for a profile"""
    query = """
    SELECT t.id, t.name
    FROM tags t
    JOIN profile_tags pt ON t.id = pt.tag_id
    WHERE pt.profile_id = $1
    """
    return await conn.fetch(query, profile_id)

async def update_profile_tags(conn, profile_id, tag_names):
    """Update a profile's tags"""
    # Start a transaction
    async with conn.transaction():
        # Remove all existing tags for the profile
        await conn.execute("""
        DELETE FROM profile_tags
        WHERE profile_id = $1
        """, profile_id)
        
        # Add each tag
        for tag_name in tag_names:
            # Check if tag exists
            tag_id = await conn.fetchval("""
            SELECT id FROM tags WHERE name = $1
            """, tag_name.lower())
            
            # Create tag if it doesn't exist
            if not tag_id:
                tag_id = await conn.fetchval("""
                INSERT INTO tags (name) VALUES ($1) RETURNING id
                """, tag_name.lower())
            
            # Add tag to profile
            await conn.execute("""
            INSERT INTO profile_tags (profile_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            """, profile_id, tag_id)
            
    # Return the updated tags
    return await get_profile_tags(conn, profile_id)

async def update_fame_rating(conn, profile_id):
    """Update a profile's fame rating based on likes and visits"""
    # Count likes
    likes_count = await conn.fetchval("""
    SELECT COUNT(*) FROM likes
    WHERE liked_id = $1
    """, profile_id)
    
    # Count visits
    visits_count = await conn.fetchval("""
    SELECT COUNT(*) FROM visits
    WHERE visited_id = $1
    """, profile_id)
    
    # Get total user count for normalization
    total_users = await conn.fetchval("""
    SELECT COUNT(*) FROM users
    """)
    
    # Calculate fame rating
    if total_users > 0:
        # Formula: (likes * 2 + visits) / total_users * 5
        fame_rating = (likes_count * 2 + visits_count) / total_users * 5
        fame_rating = min(5.0, fame_rating)  # Cap at 5
    else:
        fame_rating = 0.0
    
    # Update profile
    query = """
    UPDATE profiles
    SET fame_rating = $2, updated_at = $3
    WHERE id = $1
    RETURNING fame_rating
    """
    return await conn.fetchval(query, profile_id, fame_rating, datetime.now(timezone.utc))

async def get_suggested_profiles(
    conn, 
    user_id, 
    limit=20, 
    offset=0, 
    min_age=None, 
    max_age=None, 
    min_fame=None, 
    max_fame=None, 
    max_distance=None, 
    tags=None
):
    """
    Get suggested profiles for a user based on filters
    """
    # Get user's profile
    user_profile = await get_profile_by_user_id(conn, user_id)
    if not user_profile:
        return []
    
    # Get user's gender and sexual preference
    user_gender = user_profile['gender']
    user_preference = user_profile['sexual_preference']
    
    # Get blocks in both directions
    blocked_ids = await conn.fetch("""
    SELECT blocked_id FROM blocks WHERE blocker_id = $1
    UNION
    SELECT blocker_id FROM blocks WHERE blocked_id = $1
    """, user_profile['id'])
    
    # Build the exclusion list differently to handle types properly
    excluded_ids = [user_profile['id']]
    for row in blocked_ids:
        excluded_ids.append(row['blocked_id'])
    
    # Base query parts
    select_part = """
    SELECT p.id, p.user_id, p.gender, p.sexual_preference, p.biography,
           p.latitude, p.longitude, p.fame_rating, p.birth_date,
           u.username, u.first_name, u.last_name, u.is_online, u.last_online
    FROM profiles p
    JOIN users u ON p.user_id = u.id
    """
    
    where_parts = ["p.is_complete = true"]
    
    # Handle excluded IDs without using array casting
    if excluded_ids:
        excluded_placeholders = []
        for i, _ in enumerate(excluded_ids):
            excluded_placeholders.append(f"${i+1}")
        
        where_parts.append(f"p.id NOT IN ({','.join(excluded_placeholders)})")
    
    # Start with excluded IDs as parameters
    params = excluded_ids.copy()
    param_idx = len(params) + 1
    
    # Add gender and preference filters
    if user_gender and user_preference:
        if user_preference == 'heterosexual':
            # Heterosexual: match with opposite gender
            opposite_gender = 'female' if user_gender == 'male' else 'male'
            where_parts.append(f"p.gender = ${param_idx}")
            params.append(opposite_gender)
            param_idx += 1
            
            # And the other user should be interested in user's gender
            where_parts.append("(p.sexual_preference IN ('heterosexual', 'bisexual'))")
            
        elif user_preference == 'homosexual':
            # Homosexual: match with same gender
            where_parts.append(f"p.gender = ${param_idx}")
            params.append(user_gender)
            param_idx += 1
            
            # And the other user should be interested in same gender
            where_parts.append("(p.sexual_preference IN ('homosexual', 'bisexual'))")
            
        elif user_preference == 'bisexual':
            # Bisexual: match with compatible combinations
            bisexual_conditions = []
            
            # If other is heterosexual, they should be opposite gender
            opposite_gender = 'female' if user_gender == 'male' else 'male'
            bisexual_conditions.append(f"(p.sexual_preference = 'heterosexual' AND p.gender = ${param_idx})")
            params.append(opposite_gender)
            param_idx += 1
            
            # If other is homosexual, they should be same gender
            bisexual_conditions.append(f"(p.sexual_preference = 'homosexual' AND p.gender = ${param_idx})")
            params.append(user_gender)
            param_idx += 1
            
            # If other is bisexual, no gender restrictions
            bisexual_conditions.append("(p.sexual_preference = 'bisexual')")
            
            where_parts.append(f"({' OR '.join(bisexual_conditions)})")
    
    # Add age filters
    if min_age is not None:
        max_birth_date = datetime.now(timezone.utc) - timedelta(days=min_age*365.25)
        where_parts.append(f"p.birth_date <= ${param_idx}")
        params.append(max_birth_date)
        param_idx += 1
    
    if max_age is not None:
        min_birth_date = datetime.now(timezone.utc) - timedelta(days=(max_age+1)*365.25)
        where_parts.append(f"p.birth_date >= ${param_idx}")
        params.append(min_birth_date)
        param_idx += 1
    
    # Add fame rating filters
    if min_fame is not None:
        where_parts.append(f"p.fame_rating >= ${param_idx}")
        params.append(min_fame)
        param_idx += 1
    
    if max_fame is not None:
        where_parts.append(f"p.fame_rating <= ${param_idx}")
        params.append(max_fame)
        param_idx += 1
    
    # Add geographical distance filter (bounding box)
    if max_distance is not None and user_profile['latitude'] and user_profile['longitude']:
        min_lat, min_lon, max_lat, max_lon = get_bounding_box(
            user_profile['latitude'], 
            user_profile['longitude'], 
            max_distance
        )
        
        where_parts.append(f"""
        (p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND
         p.latitude BETWEEN ${param_idx} AND ${param_idx+2} AND
         p.longitude BETWEEN ${param_idx+1} AND ${param_idx+3})
        """)
        
        params.extend([min_lat, min_lon, max_lat, max_lon])
        param_idx += 4
    
    # Add tag filters
    if tags and len(tags) > 0:
        tag_conditions = []
        for tag in tags:
            tag_conditions.append(f"""
            EXISTS (
                SELECT 1 FROM profile_tags pt
                JOIN tags t ON pt.tag_id = t.id
                WHERE pt.profile_id = p.id AND LOWER(t.name) = LOWER(${param_idx})
            )
            """)
            params.append(tag)
            param_idx += 1
        
        if tag_conditions:
            where_parts.append(f"({' AND '.join(tag_conditions)})")
    
    # Complete the query
    where_clause = " AND ".join(where_parts)
    order_clause = "ORDER BY p.fame_rating DESC, u.is_online DESC, u.last_online DESC"
    limit_clause = f"LIMIT ${param_idx} OFFSET ${param_idx+1}"
    params.extend([limit, offset])
    
    query = f"{select_part} WHERE {where_clause} {order_clause} {limit_clause}"
    
    try:
        # Execute query
        profiles = await conn.fetch(query, *params)
        
        # Get additional data for each profile
        results = []
        for profile in profiles:
            profile_dict = dict(profile)
            
            # Get profile pictures
            pictures = await get_profile_pictures(conn, profile['id'])
            profile_dict['pictures'] = [dict(pic) for pic in pictures]
            
            # Get profile tags
            tags = await get_profile_tags(conn, profile['id'])
            profile_dict['tags'] = [dict(tag) for tag in tags]
            
            # Calculate distance if coordinates available
            if (user_profile['latitude'] and user_profile['longitude'] and 
                profile['latitude'] and profile['longitude']):
                distance = haversine_distance(
                    user_profile['latitude'], 
                    user_profile['longitude'], 
                    profile['latitude'], 
                    profile['longitude']
                )
                profile_dict['distance'] = distance
            else:
                profile_dict['distance'] = None
            
            # Calculate age
            if profile['birth_date']:
                today = datetime.now(timezone.utc)
                birth_date = profile['birth_date']
                age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
                profile_dict['age'] = age
            else:
                profile_dict['age'] = None
            
            # Check if user has liked this profile
            liked = await conn.fetchval("""
            SELECT id FROM likes
            WHERE liker_id = $1 AND liked_id = $2
            """, user_profile['id'], profile['id'])
            
            profile_dict['has_liked'] = liked is not None
            
            # Calculate common tags
            user_tags = await conn.fetch("""
            SELECT tag_id FROM profile_tags
            WHERE profile_id = $1
            """, user_profile['id'])
            
            profile_tags = await conn.fetch("""
            SELECT tag_id FROM profile_tags
            WHERE profile_id = $1
            """, profile['id'])
            
            user_tag_ids = {t['tag_id'] for t in user_tags}
            profile_tag_ids = {t['tag_id'] for t in profile_tags}
            common_tags = len(user_tag_ids.intersection(profile_tag_ids))
            
            profile_dict['common_tags'] = common_tags
            
            results.append(profile_dict)
        
        # Sort by proximity, then common tags, then fame rating
        if max_distance is not None:
            results.sort(key=lambda x: (
                float('inf') if x['distance'] is None else x['distance'],
                -x['common_tags'],
                -x['fame_rating']
            ))
        return results
    except Exception as e:
        print(f"Error executing query: {str(e)}")
        print(f"Query: {query}")
        print(f"Params: {params}")
        raise