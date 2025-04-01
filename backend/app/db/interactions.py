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

async def unlike_profile(conn, liker_id, liked_id, both_ways=False):
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
        if both_ways:
            # Remove the reverse like
            await conn.execute("""
            DELETE FROM likes
            WHERE liker_id = $1 AND liked_id = $2
            """, liked_id, liker_id)

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
