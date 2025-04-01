import uuid
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def get_user_by_username(conn, username):
    """Get a user by username"""
    query = """
    SELECT id, username, email, first_name, last_name, 
           hashed_password, is_active, is_verified, is_online, last_online,
           created_at, updated_at
    FROM users
    WHERE username = $1
    """
    return await conn.fetchrow(query, username)

async def get_user_by_email(conn, email):
    """Get a user by email"""
    query = """
    SELECT id, username, email, first_name, last_name, 
           hashed_password, is_active, is_verified, is_online, last_online,
           created_at, updated_at
    FROM users
    WHERE email = $1
    """
    return await conn.fetchrow(query, email)

async def create_user(conn, user_data):
    """Create a new user"""
    user_id = str(uuid.uuid4())
    query = """
    INSERT INTO users (id, username, email, first_name, last_name, 
                     hashed_password, is_active, is_verified, verification_token)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
    """
    return await conn.fetchval(
        query, 
        user_id, 
        user_data["username"], 
        user_data["email"],
        user_data["first_name"], 
        user_data["last_name"], 
        pwd_context.hash(user_data["password"]),
        True,  # is_active
        False,  # is_verified
        user_data.get("verification_token")
    )

async def update_user(conn, user_id, user_data):
    """Update user information"""
    # Build dynamic update query based on provided fields
    fields = []
    values = [user_id]  # First parameter is always the user_id
    param_idx = 2

    for key, value in user_data.items():
        if key in ['username', 'email', 'first_name', 'last_name', 'is_active', 'is_verified']:
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
    UPDATE users
    SET {', '.join(fields)}
    WHERE id = $1
    RETURNING id, username, email, first_name, last_name, is_active, is_verified
    """
    
    return await conn.fetchrow(query, *values)


async def update_last_activity(conn, user_id, is_online):
    """Update user's last activity and online status"""

    now = datetime.now(timezone.utc)
    if is_online:
        query = """
        UPDATE users
        SET is_online = $2, last_online = $3
        WHERE id = $1
        RETURNING id
        """
        return await conn.fetchval(query, user_id, True, now)
    else:
        query = """
        UPDATE users
        SET is_online = $2, last_online = $3
        WHERE id = $1
        RETURNING id
        """
        return await conn.fetchval(query, user_id, False, now)

async def update_verification(conn, token, is_verified=True):
    """Verify a user using their verification token"""
    query = """
    UPDATE users
    SET is_verified = $2, verification_token = NULL, updated_at = $3
    WHERE verification_token = $1
    RETURNING id, username, email
    """
    return await conn.fetchrow(query, token, is_verified, datetime.now(timezone.utc))

async def update_refresh_token(conn, user_id, refresh_token):
    """Update a user's refresh token"""

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    query = """
    UPDATE users
    SET refresh_token = $2, refresh_token_expires = $3
    WHERE id = $1
    RETURNING id
    """
    return await conn.fetchval(query, user_id, refresh_token, expires_at)
