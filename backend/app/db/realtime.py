from datetime import datetime, timezone
from jose import jwt, JWTError
from app.core.config import settings

def verify_jwt_token(token):
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None

async def create_notification(conn, user_id, sender_id, notification_type, content=None):
    """Create a notification"""
    query = """
    INSERT INTO notifications (user_id, sender_id, type, content, is_read, created_at)
    VALUES ($1, $2, $3, $4, false, $5)
    RETURNING id, user_id, sender_id, type, content, is_read, created_at
    """
    return await conn.fetchrow(
        query, user_id, sender_id, notification_type, content, datetime.now(timezone.utc)
    )

async def get_notifications(conn, user_id, limit=20, offset=0, unread_only=False):
    """Get notifications for a user with sender username"""
    params = [user_id, limit, offset]
    
    query = """
    SELECT n.id, n.user_id, n.sender_id, n.type, n.content, 
           n.is_read, n.created_at, n.read_at,
           u.username as sender_username, u.first_name as sender_first_name,
           u.last_name as sender_last_name
    FROM notifications n
    LEFT JOIN users u ON n.sender_id = u.id
    WHERE n.user_id = $1
    """
    
    if unread_only:
        query += " AND n.is_read = false"
    
    query += """
    ORDER BY n.created_at DESC
    LIMIT $2 OFFSET $3
    """
    
    notifications = await conn.fetch(query, *params)
    result = []
    for notification in notifications:

        created_at = notification['created_at'].isoformat() if notification['created_at'] else None
        read_at = notification['read_at'].isoformat() if notification['read_at'] else None

        result.append({
            "id": notification['id'],
            "user_id": notification['user_id'],
            "sender_id": notification['sender_id'],
            "type": notification['type'],
            "content": notification['content'],
            "is_read": notification['is_read'],
            "created_at": created_at,
            "read_at": read_at,
            "sender_username": notification['sender_username'],
            "sender_first_name": notification['sender_first_name'],
            "sender_last_name": notification['sender_last_name']
        })
    
    return result

async def mark_notification_as_read(conn, notification_id, user_id):
    """Mark a notification as read"""
    query = """
    UPDATE notifications
    SET is_read = true, read_at = $3
    WHERE id = $1 AND user_id = $2
    RETURNING id, user_id, sender_id, type, content, is_read, created_at, read_at
    """
    return await conn.fetchrow(query, notification_id, user_id, datetime.now(timezone.utc))

async def mark_all_notifications_as_read(conn, user_id):
    """Mark all notifications as read for a user"""
    query = """
    UPDATE notifications
    SET is_read = true, read_at = $2
    WHERE user_id = $1 AND is_read = false
    """
    result = await conn.execute(query, user_id, datetime.now(timezone.utc))
    
    # Get the number of affected rows
    return int(result.split()[-1])

async def get_unread_notification_count(conn, user_id):
    """Get count of unread notifications for a user"""
    query = """
    SELECT COUNT(*)
    FROM notifications
    WHERE user_id = $1 AND is_read = false
    """
    return await conn.fetchval(query, user_id)

async def send_message(conn, sender_id, recipient_id, content):
    """Send a message from one user to another"""
    # Check if users exist
    sender = await conn.fetchrow("SELECT id, username, first_name, last_name FROM users WHERE id = $1", sender_id)
    recipient = await conn.fetchrow("SELECT id FROM users WHERE id = $1", recipient_id)
    
    if not sender or not recipient:
        return None
    
    # Check if they are connected
    connection = await conn.fetchrow("""
    SELECT id FROM connections
    WHERE is_active = true AND 
    ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))
    """, sender_id, recipient_id)
    
    if not connection:
        return None
    
    # Create message
    now = datetime.now(timezone.utc)
    message_id = await conn.fetchval("""
    INSERT INTO messages (sender_id, recipient_id, content, is_read, created_at)
    VALUES ($1, $2, $3, false, $4)
    RETURNING id
    """, sender_id, recipient_id, content, now)
    
    # Create notification
    truncated_content = content[:30] + "..." if len(content) > 30 else content
    notification_content = f"{sender['first_name']} size yeni bir mesaj gönderdi: '{truncated_content}'"
    
    await create_notification(
        conn, recipient_id, sender_id, 'message', notification_content
    )
    
    # Update connection timestamp
    await conn.execute("""
    UPDATE connections
    SET updated_at = $2
    WHERE id = $1
    """, connection['id'], now)
    
    # Get the created message
    message = await conn.fetchrow("""
    SELECT id, sender_id, recipient_id, content, is_read, created_at, read_at
    FROM messages
    WHERE id = $1
    """, message_id)
    
    return {
        "message": dict(message),
        "sender": dict(sender),
        "recipient": dict(recipient)
    }

async def get_messages(conn, user1_id, user2_id, limit=50, offset=0):
    """Get messages between two users"""
    # Get messages
    query = """
    SELECT id, sender_id, recipient_id, content, is_read, created_at, read_at
    FROM messages
    WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
    ORDER BY created_at DESC
    LIMIT $3 OFFSET $4
    """
    messages = await conn.fetch(query, user1_id, user2_id, limit, offset)
    
    # Mark messages as read if recipient is user1
    now = datetime.now(timezone.utc)
    for message in messages:
        if message['recipient_id'] == user1_id and not message['is_read']:
            await conn.execute("""
            UPDATE messages
            SET is_read = true, read_at = $2
            WHERE id = $1
            """, message['id'], now)
    
    # Return in chronological order (reverse the desc order from the query)
    result = []
    for message in reversed(messages):
        # Format the dates
        created_at = message['created_at'].isoformat() if message['created_at'] else None
        read_at = message['read_at'].isoformat() if message['read_at'] else None
        
        result.append({
            "id": message['id'],
            "sender_id": message['sender_id'],
            "recipient_id": message['recipient_id'],
            "content": message['content'],
            "is_read": message['is_read'],
            "created_at": created_at,
            "read_at": read_at
        })
    
    return result

async def get_unread_message_count(conn, user_id):
    """Get count of unread messages for a user"""
    query = """
    SELECT COUNT(*)
    FROM messages
    WHERE recipient_id = $1 AND is_read = false
    """
    return await conn.fetchval(query, user_id)

async def get_recent_conversations(conn, user_id, limit=10):
    """Get recent chats for a user"""
    try:
        # Get active connections
        connections = await conn.fetch("""
        SELECT c.id, c.user1_id, c.user2_id, c.is_active, c.created_at, c.updated_at,
               u.id as u_id, u.username, u.first_name, u.last_name, u.is_online, u.last_online
        FROM connections c
        JOIN users u ON (c.user1_id = $1 AND c.user2_id = u.id) OR (c.user1_id = u.id AND c.user2_id = $1)
        WHERE c.is_active = true
        ORDER BY c.updated_at DESC
        LIMIT $2
        """, user_id, limit)
        
        chats = []
        for connection in connections:
            # Get the other user
            other_user_id = connection['user2_id'] if connection['user1_id'] == user_id else connection['user1_id']
            
            # Format the timestamps
            created_at = connection['created_at'].isoformat() if connection['created_at'] else None
            updated_at = connection['updated_at'].isoformat() if connection['updated_at'] else None
            last_online = connection['last_online'].isoformat() if connection['last_online'] else None
            
            # Create user info
            other_user = {
                "id": connection['u_id'],
                "username": connection['username'],
                "first_name": connection['first_name'],
                "last_name": connection['last_name'],
                "is_online": connection['is_online'],
                "last_online": last_online
            }
            
            # Get most recent message
            recent_message = await conn.fetchrow("""
            SELECT id, sender_id, recipient_id, content, is_read, created_at, read_at
            FROM messages
            WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
            ORDER BY created_at DESC
            LIMIT 1
            """, user_id, other_user_id)
            
            # Format message dates if exists
            formatted_message = None
            if recent_message:
                message_created_at = recent_message['created_at'].isoformat() if recent_message['created_at'] else None
                message_read_at = recent_message['read_at'].isoformat() if recent_message['read_at'] else None
                
                formatted_message = {
                    "id": recent_message['id'],
                    "sender_id": recent_message['sender_id'],
                    "recipient_id": recent_message['recipient_id'],
                    "content": recent_message['content'],
                    "is_read": recent_message['is_read'],
                    "created_at": message_created_at,
                    "read_at": message_read_at
                }
            
            # Get unread count
            unread_count = await conn.fetchval("""
            SELECT COUNT(*)
            FROM messages
            WHERE sender_id = $1 AND recipient_id = $2 AND is_read = false
            """, other_user_id, user_id)
            
            chats.append({
                "connection": {
                    "id": connection['id'],
                    "user1_id": connection['user1_id'],
                    "user2_id": connection['user2_id'],
                    "is_active": connection['is_active'],
                    "created_at": created_at,
                    "updated_at": updated_at
                },
                "user": other_user,
                "recent_message": formatted_message,
                "unread_count": unread_count
            })
        
        return chats
        
    except Exception as e:
        # Log the exception
        import logging
        logging.error(f"Error in get_recent_conversations: {str(e)}")
        
        # Return empty list instead of failing
        return []