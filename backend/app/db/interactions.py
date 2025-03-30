from datetime import datetime, timezone

from app.db.profiles import update_fame_rating
from app.db.realtime import create_notification
from app.api.realtime import broadcast_notification, manager

async def like_profile(conn, liker_id, liked_id):
    """Like a profile"""
    # Check if profiles exist
    liker_profile = await conn.fetchrow("SELECT id FROM profiles WHERE id = $1", liker_id)
    liked_profile = await conn.fetchrow("SELECT id FROM profiles WHERE id = $1", liked_id)
    
    if not liker_profile or not liked_profile:
        return None
    
    # Check if already liked
    existing = await conn.fetchval("""
    SELECT id FROM likes 
    WHERE liker_id = $1 AND liked_id = $2
    """, liker_id, liked_id)
    
    if existing:
        return {"like_id": existing, "is_match": False}
    
    # Check if blocked in either direction
    is_blocked = await conn.fetchval("""
    SELECT id FROM blocks
    WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
    """, liker_id, liked_id)
    
    if is_blocked:
        return None
    
    # Record the like
    like_id = await conn.fetchval("""
    INSERT INTO likes (liker_id, liked_id, created_at)
    VALUES ($1, $2, $3)
    RETURNING id
    """, liker_id, liked_id, datetime.now(timezone.utc))

    # Get user IDs for both profiles
    liker_user_id = await conn.fetchval("SELECT user_id FROM profiles WHERE id = $1", liker_id)
    liked_user_id = await conn.fetchval("SELECT user_id FROM profiles WHERE id = $1", liked_id)

    # Get user info for notifications
    liker_user = await conn.fetchrow("""
    SELECT id, username, first_name, last_name FROM users WHERE id = $1
    """, liker_user_id)
    
    liked_user = await conn.fetchrow("""
    SELECT id, username, first_name, last_name FROM users WHERE id = $1
    """, liked_user_id)

    # Create like notification
    await create_notification(
        conn, liked_user_id, liker_user_id, 'like', f"{liker_user['first_name']} Profilinizi beğendi!")
    
    # Send WebSocket notification to current user too
    await broadcast_notification(
        manager,
        liked_user_id,
        'like',
        liker_user_id,
        content=f"{liker_user['first_name']} Profilinizi beğendi!")
    
    # Check if it's a match (mutual like)
    mutual_like = await conn.fetchval("""
    SELECT id FROM likes
    WHERE liker_id = $1 AND liked_id = $2
    """, liked_id, liker_id)
    
    is_match = mutual_like is not None
    
    # If it's a match, create or reactivate a connection
    if is_match:
        
        # Check if connection already exists
        existing_conn = await conn.fetchrow("""
        SELECT id, is_active FROM connections
        WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
        """, liker_user_id, liked_user_id)
        
        if existing_conn:
            # Reactivate if inactive
            if not existing_conn['is_active']:
                await conn.execute("""
                UPDATE connections
                SET is_active = true, updated_at = $2
                WHERE id = $1
                """, existing_conn['id'], datetime.now(timezone.utc))
                
                # Create match notifications for reconnection
                await create_notification(
                conn, liker_user_id, liked_user_id, 'match', f"{liked_user['first_name']} ile yeniden eşleştiniz! Şimdi sohbet edebilirsiniz.")
                
                await create_notification(
                conn, liked_user_id, liker_user_id, 'match', f"{liker_user['first_name']} ile yeniden eşleştiniz! Şimdi sohbet edebilirsiniz.")

                # Send WebSocket notification to both users too
                await broadcast_notification(
                    manager,
                    liker_user_id,
                    'match',
                    liked_user_id,
                    content=f"{liked_user['first_name']} ile yeniden eşleştiniz! Şimdi sohbet edebilirsiniz.")
                
                await broadcast_notification(
                    manager,
                    liked_user_id,
                    'match',
                    liker_user_id,
                    content=f"{liker_user['first_name']} ile yeniden eşleştiniz! Şimdi sohbet edebilirsiniz.")
        else:
            # Create new connection
            now = datetime.now(timezone.utc)
            await conn.fetchval("""
            INSERT INTO connections (user1_id, user2_id, is_active, created_at, updated_at)
            VALUES ($1, $2, true, $3, $3)
            RETURNING id
            """, liker_user_id, liked_user_id, now)
            
            # Create match notifications for both users
            await create_notification(
            conn, liker_user_id, liked_user_id, 'match', f"{liked_user['first_name']} ile eşleştiniz! Şimdi sohbet edebilirsiniz.")

            await create_notification(
            conn, liked_user_id, liker_user_id, 'match', f"{liker_user['first_name']} ile eşleştiniz! Şimdi sohbet edebilirsiniz.")

            # Send WebSocket notification to both users too
            await broadcast_notification(
                manager,
                liker_user_id,
                'match',
                liked_user_id,
                content=f"{liked_user['first_name']} ile eşleştiniz! Şimdi sohbet edebilirsiniz.")
            
            await broadcast_notification(
                manager,
                liked_user_id,
                'match',
                liker_user_id,
                content=f"{liker_user['first_name']} ile eşleştiniz! Şimdi sohbet edebilirsiniz.")
  
    # Update fame rating
    await update_fame_rating(conn, liked_id)
    
    return {
        "like_id": like_id, 
        "is_match": is_match,
        "liker_user": dict(liker_user) if is_match else None,
        "liked_user": dict(liked_user) if is_match else None
    }

async def unlike_profile(conn, liker_id, liked_id):
    """Unlike a profile"""
    # Check if the like exists
    like = await conn.fetchrow("""
    SELECT id FROM likes
    WHERE liker_id = $1 AND liked_id = $2
    """, liker_id, liked_id)
    
    if not like:
        return None
    
    # Check if it was a match
    mutual_like = await conn.fetchrow("""
    SELECT id FROM likes
    WHERE liker_id = $1 AND liked_id = $2
    """, liked_id, liker_id)
    
    was_match = mutual_like is not None

    # Remove the like
    await conn.execute("""
    DELETE FROM likes
    WHERE liker_id = $1 AND liked_id = $2
    """, liker_id, liked_id)
    #TODO: Directly get liker_user, liked_user??
    liker_user_id = await conn.fetchval("SELECT user_id FROM profiles WHERE id = $1", liker_id)
    liked_user_id = await conn.fetchval("SELECT user_id FROM profiles WHERE id = $1", liked_id)

    # Get user info for notifications
    liker_user = await conn.fetchrow("""
    SELECT id, username, first_name, last_name FROM users WHERE id = $1
    """, liker_user_id)
    
    liked_user = await conn.fetchrow("""
    SELECT id, username, first_name, last_name FROM users WHERE id = $1
    """, liked_user_id)

    # Create unlike notification with descriptive content
    await create_notification(
        conn, liked_user_id, liker_user_id, 'unlike', f"{liker_user['first_name']} profilinizi beğenmekten vazgeçti.")

    # Send WebSocket notification to current user too
    await broadcast_notification(
        manager,
        liker_user_id,
        'unlike',
        liked_user_id,
        content=f"{liked_user['first_name']} profilinizi beğenmekten vazgeçti.")
    # If it was a match, deactivate the connection
    if was_match:
       
        # Update connection
        await conn.execute("""
        UPDATE connections
        SET is_active = false, updated_at = $3
        WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
        """, liker_user_id, liked_user_id, datetime.now(timezone.utc))
        
        # Create unmatch notifications for both users
        await create_notification(
        conn, liked_user_id, liker_user_id, 'unmatch', f"{liker_user['first_name']} artık eşleşmenizde değil.")

        await create_notification(
        conn, liker_user_id, liked_user_id, 'unmatch', f"{liked_user['first_name']} artık eşleşmenizde değil.")
        
        # Send WebSocket notification to both users too
        await broadcast_notification(
            manager,
            liker_user_id,
            'unmatch',
            liked_user_id,
            content=f"{liked_user['first_name']} artık eşleşmenizde değil.")
        
        await broadcast_notification(
            manager,
            liked_user_id,
            'unmatch',
            liker_user_id,
            content=f"{liker_user['first_name']} artık eşleşmenizde değil.")
        
    # Update fame rating
    await update_fame_rating(conn, liked_id)
    
    return {
        "unliked": True, 
        "was_match": was_match
    }

#TODO: Unused function
async def visit_profile(conn, visitor_id, visited_id):
    """Record a profile visit"""
    # Check if profiles exist
    visitor_profile = await conn.fetchrow("SELECT id, user_id FROM profiles WHERE id = $1", visitor_id)
    visited_profile = await conn.fetchrow("SELECT id, user_id FROM profiles WHERE id = $1", visited_id)
    
    if not visitor_profile or not visited_profile or visitor_id == visited_id:
        return None
    
    # Check if blocked in either direction
    is_blocked = await conn.fetchval("""
    SELECT id FROM blocks
    WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
    """, visitor_id, visited_id)
    
    if is_blocked:
        return None
    
    # Record the visit
    now = datetime.now(timezone.utc)
    visit_id = await conn.fetchval("""
    INSERT INTO visits (visitor_id, visited_id, created_at)
    VALUES ($1, $2, $3)
    RETURNING id
    """, visitor_id, visited_id, now)
    
    # Get visitor user info for notification
    visitor_user = await conn.fetchrow("""
    SELECT id, username, first_name, last_name FROM users WHERE id = $1
    """, visitor_profile['user_id'])
    
    # Create visit notification
    await conn.execute("""
    INSERT INTO notifications (user_id, sender_id, type, content, created_at)
    VALUES ($1, $2, 'visit', $3, $4)
    """, visited_profile['user_id'], visitor_profile['user_id'],
    f"{visitor_user['first_name']} profilinizi ziyaret etti!", now)
    
    # Update fame rating
    await update_fame_rating(conn, visited_id)
    
    return visit_id

#TODO: Unused function
async def is_blocked(conn, blocker_id, blocked_id):
    """Check if a user is blocked and return block details"""
    block = await conn.fetchrow("""
    SELECT id, blocker_id, blocked_id, created_at
    FROM blocks
    WHERE blocker_id = $1 AND blocked_id = $2
    """, blocker_id, blocked_id)
    
    if not block:
        return {
            "is_blocked": False,
            "block_info": None
        }
    
    return {
        "is_blocked": True,
        "block_info": {
            "block_date": block['created_at'],
            "blocker_id": block['blocker_id'],
            "blocked_id": block['blocked_id']
        }
    }

#TODO: Unused function
async def get_blocks_sent(conn, profile_id, limit=10, offset=0):
    """Get blocks sent by a profile"""
    blocks = await conn.fetch("""
    SELECT b.id, b.blocker_id, b.blocked_id, b.created_at,
           p.id as profile_id, p.gender, p.sexual_preference, p.biography, p.fame_rating,
           u.id as user_id, u.username, u.first_name, u.last_name, u.is_online, u.last_online
    FROM blocks b
    JOIN profiles p ON b.blocked_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE b.blocker_id = $1
    ORDER BY b.created_at DESC
    LIMIT $2 OFFSET $3
    """, profile_id, limit, offset)
    
    result = []
    for block in blocks:
        block_dict = {
            "block": {
                "id": block['id'],
                "blocker_id": block['blocker_id'],
                "blocked_id": block['blocked_id'],
                "created_at": block['created_at']
            },
            "profile": {
                "id": block['profile_id'],
                "gender": block['gender'],
                "sexual_preference": block['sexual_preference'],
                "biography": block['biography'],
                "fame_rating": block['fame_rating']
            },
            "user": {
                "id": block['user_id'],
                "username": block['username'],
                "first_name": block['first_name'],
                "last_name": block['last_name'],
                "is_online": block['is_online'],
                "last_online": block['last_online']
            }
        }
        
        # Get profile pictures
        pictures = await conn.fetch("""
        SELECT id, profile_id, file_path, backend_url, is_primary, created_at
        FROM profile_pictures
        WHERE profile_id = $1
        ORDER BY is_primary DESC, created_at ASC
        """, block['profile_id'])
        
        block_dict['profile']['pictures'] = [dict(pic) for pic in pictures]
        
        result.append(block_dict)
    
    return result

#TODO: Unused function
async def get_blocks_received(conn, profile_id, limit=10, offset=0):
    """Get blocks received by a profile"""
    blocks = await conn.fetch("""
    SELECT b.id, b.blocker_id, b.blocked_id, b.created_at,
           p.id as profile_id, p.gender, p.sexual_preference, p.biography, p.fame_rating,
           u.id as user_id, u.username, u.first_name, u.last_name, u.is_online, u.last_online
    FROM blocks b
    JOIN profiles p ON b.blocker_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE b.blocked_id = $1
    ORDER BY b.created_at DESC
    LIMIT $2 OFFSET $3
    """, profile_id, limit, offset)
    
    result = []
    for block in blocks:
        block_dict = {
            "block": {
                "id": block['id'],
                "blocker_id": block['blocker_id'],
                "blocked_id": block['blocked_id'],
                "created_at": block['created_at']
            },
            "profile": {
                "id": block['profile_id'],
                "gender": block['gender'],
                "sexual_preference": block['sexual_preference'],
                "biography": block['biography'],
                "fame_rating": block['fame_rating']
            },
            "user": {
                "id": block['user_id'],
                "username": block['username'],
                "first_name": block['first_name'],
                "last_name": block['last_name'],
                "is_online": block['is_online'],
                "last_online": block['last_online']
            }
        }
        
        # Get profile pictures
        pictures = await conn.fetch("""
        SELECT id, profile_id, file_path, backend_url, is_primary, created_at
        FROM profile_pictures
        WHERE profile_id = $1
        ORDER BY is_primary DESC, created_at ASC
        """, block['profile_id'])
        
        block_dict['profile']['pictures'] = [dict(pic) for pic in pictures]
        
        result.append(block_dict)
    
    return result


#TODO: Unused function
async def report_profile(conn, reporter_id, reported_id, reason, description=None):
    """Report a profile"""
    # Check if profiles exist
    reporter_profile = await conn.fetchrow("SELECT id FROM profiles WHERE id = $1", reporter_id)
    reported_profile = await conn.fetchrow("SELECT id FROM profiles WHERE id = $1", reported_id)
    
    if not reporter_profile or not reported_profile or reporter_id == reported_id:
        return None
    
    # Create report
    report_id = await conn.fetchval("""
    INSERT INTO reports (reporter_id, reported_id, reason, description, is_resolved, created_at)
    VALUES ($1, $2, $3, $4, false, $5)
    RETURNING id
    """, reporter_id, reported_id, reason, description, datetime.now(timezone.utc))
    
    return report_id

async def get_likes_received(conn, profile_id, limit=10, offset=0):
    """Get likes received by a profile"""
    likes = await conn.fetch("""
    SELECT l.id, l.liker_id, l.liked_id, l.created_at,
           p.id as profile_id, p.gender, p.sexual_preference, p.biography, 
           p.latitude, p.longitude, p.fame_rating, p.birth_date,
           u.id as user_id, u.username, u.first_name, u.last_name, 
           u.is_online, u.last_online
    FROM likes l
    JOIN profiles p ON l.liker_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE l.liked_id = $1
    ORDER BY l.created_at DESC
    LIMIT $2 OFFSET $3
    """, profile_id, limit, offset)
    
    result = []
    for like in likes:
        like_dict = {
            "like": {
                "id": like['id'],
                "liker_id": like['liker_id'],
                "liked_id": like['liked_id'],
                "created_at": like['created_at']
            },
            "profile": {
                "id": like['profile_id'],
                "gender": like['gender'],
                "sexual_preference": like['sexual_preference'],
                "biography": like['biography'],
                "latitude": like['latitude'],
                "longitude": like['longitude'],
                "fame_rating": like['fame_rating'],
                "birth_date": like['birth_date']
            },
            "user": {
                "id": like['user_id'],
                "username": like['username'],
                "first_name": like['first_name'],
                "last_name": like['last_name'],
                "is_online": like['is_online'],
                "last_online": like['last_online']
            }
        }
        
        # Get profile pictures
        pictures = await conn.fetch("""
        SELECT id, profile_id, file_path, backend_url, is_primary, created_at
        FROM profile_pictures
        WHERE profile_id = $1
        ORDER BY is_primary DESC, created_at ASC
        """, like['profile_id'])
        
        like_dict['pictures'] = [dict(pic) for pic in pictures]
        
        # Get profile tags
        tags = await conn.fetch("""
        SELECT t.id, t.name
        FROM tags t
        JOIN profile_tags pt ON t.id = pt.tag_id
        WHERE pt.profile_id = $1
        """, like['profile_id'])
        
        like_dict['tags'] = [dict(tag) for tag in tags]
        
        result.append(like_dict)
    
    return result

#TODO: Unused function
async def get_visits_received(conn, profile_id, limit=10, offset=0):
    """Get visits received by a profile"""
    visits = await conn.fetch("""
    SELECT v.id, v.visitor_id, v.visited_id, v.created_at,
           p.id as profile_id, p.gender, p.sexual_preference, p.biography, 
           p.latitude, p.longitude, p.fame_rating, p.birth_date,
           u.id as user_id, u.username, u.first_name, u.last_name, 
           u.is_online, u.last_online
    FROM visits v
    JOIN profiles p ON v.visitor_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE v.visited_id = $1
    ORDER BY v.created_at DESC
    LIMIT $2 OFFSET $3
    """, profile_id, limit, offset)
    
    result = []
    for visit in visits:
        visit_dict = {
            "visit": {
                "id": visit['id'],
                "visitor_id": visit['visitor_id'],
                "visited_id": visit['visited_id'],
                "created_at": visit['created_at']
            },
            "profile": {
                "id": visit['profile_id'],
                "gender": visit['gender'],
                "sexual_preference": visit['sexual_preference'],
                "biography": visit['biography'],
                "latitude": visit['latitude'],
                "longitude": visit['longitude'],
                "fame_rating": visit['fame_rating'],
                "birth_date": visit['birth_date']
            },
            "user": {
                "id": visit['user_id'],
                "username": visit['username'],
                "first_name": visit['first_name'],
                "last_name": visit['last_name'],
                "is_online": visit['is_online'],
                "last_online": visit['last_online']
            }
        }
        
        # Get profile pictures
        pictures = await conn.fetch("""
        SELECT id, profile_id, file_path, backend_url, is_primary, created_at
        FROM profile_pictures
        WHERE profile_id = $1
        ORDER BY is_primary DESC, created_at ASC
        """, visit['profile_id'])
        
        visit_dict['pictures'] = [dict(pic) for pic in pictures]
        
        # Get profile tags
        tags = await conn.fetch("""
        SELECT t.id, t.name
        FROM tags t
        JOIN profile_tags pt ON t.id = pt.tag_id
        WHERE pt.profile_id = $1
        """, visit['profile_id'])
        
        visit_dict['tags'] = [dict(tag) for tag in tags]
        
        result.append(visit_dict)
    
    return result

#TODO: Unused function
async def get_matches(conn, user_id, limit=10, offset=0):
    """Get matches for a user"""
    # Get the user's profile ID
    profile_id = await conn.fetchval("SELECT id FROM profiles WHERE user_id = $1", user_id)
    
    if not profile_id:
        return []
    
    # Get profiles with mutual likes (matches)
    matches = await conn.fetch("""
    SELECT p.id, p.user_id, p.gender, p.sexual_preference, p.biography, 
           p.latitude, p.longitude, p.fame_rating, p.birth_date,
           u.id as u_id, u.username, u.first_name, u.last_name, u.is_online, u.last_online,
           c.id as connection_id, c.is_active, c.created_at as connection_created_at, c.updated_at as connection_updated_at
    FROM profiles p
    JOIN users u ON p.user_id = u.id
    JOIN connections c ON (c.user1_id = $1 AND c.user2_id = u.id) OR (c.user1_id = u.id AND c.user2_id = $1)
    WHERE p.id IN (
        SELECT l1.liked_id
        FROM likes l1
        JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
        WHERE l1.liker_id = $2
    )
    AND c.is_active = true
    ORDER BY c.updated_at DESC
    LIMIT $3 OFFSET $4
    """, user_id, profile_id, limit, offset)
    
    result = []
    for match in matches:
        match_dict = {
            "connection": {
                "id": match['connection_id'],
                "is_active": match['is_active'],
                "created_at": match['connection_created_at'],
                "updated_at": match['connection_updated_at']
            },
            "profile": {
                "id": match['id'],
                "user_id": match['user_id'],
                "gender": match['gender'],
                "sexual_preference": match['sexual_preference'],
                "biography": match['biography'],
                "latitude": match['latitude'],
                "longitude": match['longitude'],
                "fame_rating": match['fame_rating'],
                "birth_date": match['birth_date']
            },
            "user": {
                "id": match['u_id'],
                "username": match['username'],
                "first_name": match['first_name'],
                "last_name": match['last_name'],
                "is_online": match['is_online'],
                "last_online": match['last_online']
            }
        }
        
        # Get profile pictures
        pictures = await conn.fetch("""
        SELECT id, profile_id, file_path, backend_url, is_primary, created_at
        FROM profile_pictures
        WHERE profile_id = $1
        ORDER BY is_primary DESC, created_at ASC
        """, match['id'])
        
        match_dict['profile']['pictures'] = [dict(pic) for pic in pictures]
        
        # Get profile tags
        tags = await conn.fetch("""
        SELECT t.id, t.name
        FROM tags t
        JOIN profile_tags pt ON t.id = pt.tag_id
        WHERE pt.profile_id = $1
        """, match['id'])
        
        match_dict['profile']['tags'] = [dict(tag) for tag in tags]
        
        result.append(match_dict)
    
    return result