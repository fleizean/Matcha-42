from datetime import datetime, timezone
from typing import Optional, Dict, Any
import uuid
from app.core.security import verify_password, get_password_hash
from app.services.email import send_verification_email, send_password_reset_email
from jose import jwt, JWTError
from app.core.config import settings

async def authenticate_user(conn, username: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Authenticate a user with username and password
    """
    # Try to get user by username
    query = """
    SELECT id, username, email, first_name, last_name, 
           hashed_password, is_active, is_verified, is_online, last_online,
           created_at, updated_at
    FROM users
    WHERE username = $1
    """
    user = await conn.fetchrow(query, username)
    
    # If not found by username, try email
    if not user:
        query = """
        SELECT id, username, email, first_name, last_name, 
               hashed_password, is_active, is_verified, is_online, last_online,
               created_at, updated_at
        FROM users
        WHERE email = $1
        """
        user = await conn.fetchrow(query, username)
    
    if not user:
        return None
    
    if not verify_password(password, user["hashed_password"]):
        return None
    
    # Update online status
    update_query = """
    UPDATE users
    SET is_online = true, last_online = $2
    WHERE id = $1
    """
    await conn.execute(update_query, user["id"], datetime.now(timezone.utc))
    
    return dict(user)

async def create_user(conn, username: str, email: str, password: str, first_name: str, last_name: str) -> Dict[str, Any]:
    """
    Create a new user
    """
    # Generate verification token
    verification_token = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    
    # Create the user
    query = """
    INSERT INTO users 
    (id, username, email, first_name, last_name, 
     hashed_password, verification_token, is_verified)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, username, email, first_name, last_name, is_verified
    """
    
    user = await conn.fetchrow(
        query, 
        user_id, 
        username, 
        email, 
        first_name, 
        last_name, 
        get_password_hash(password),
        verification_token,
        False
    )
    
    # Create empty profile
    profile_id = str(uuid.uuid4())
    profile_query = """
    INSERT INTO profiles (id, user_id, is_complete, fame_rating)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    """
    await conn.fetchval(profile_query, profile_id, user_id, False, 0.0)
    
    # Send verification email
    await send_verification_email(email, username, verification_token)
    
    return dict(user)

async def verify_user(conn, verification_token: str) -> Optional[Dict[str, Any]]:
    """
    Verify a user's email with the verification token
    """
    query = """
    UPDATE users
    SET is_verified = true, verification_token = NULL, updated_at = $2
    WHERE verification_token = $1
    RETURNING id, username, email, first_name, last_name, is_verified
    """
    
    user = await conn.fetchrow(query, verification_token, datetime.now(timezone.utc))
    
    if not user:
        return None
    
    return dict(user)

async def request_password_reset(conn, email: str) -> bool:
    """
    Request a password reset for a user
    """
    query = """
    SELECT id, username FROM users
    WHERE email = $1
    """
    
    user = await conn.fetchrow(query, email)
    
    if not user:
        # Return True anyway to prevent email enumeration
        return True
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    
    # Update user
    update_query = """
    UPDATE users
    SET reset_password_token = $2, updated_at = $3
    WHERE id = $1
    """
    
    await conn.execute(update_query, user["id"], reset_token, datetime.now(timezone.utc))
    
    # Send password reset email
    await send_password_reset_email(email, user["username"], reset_token)
    
    return True

async def reset_password(conn, token: str, new_password: str) -> Optional[Dict[str, Any]]:
    """
    Reset a user's password with the reset token
    """
    query = """
    UPDATE users
    SET hashed_password = $2, reset_password_token = NULL, updated_at = $3
    WHERE reset_password_token = $1
    RETURNING id, username, email, first_name, last_name
    """
    
    user = await conn.fetchrow(query, token, get_password_hash(new_password), datetime.now(timezone.utc))
    
    if not user:
        return None
    
    return dict(user)

async def change_password(conn, user_id: str, current_password: str, new_password: str) -> Optional[Dict[str, Any]]:
    """
    Change a user's password
    """
    query = """
    SELECT id, hashed_password FROM users
    WHERE id = $1
    """
    
    user = await conn.fetchrow(query, user_id)
    
    if not user:
        return None
    
    # Verify current password
    if not verify_password(current_password, user["hashed_password"]):
        return None
    
    # Update password
    update_query = """
    UPDATE users
    SET hashed_password = $2, updated_at = $3
    WHERE id = $1
    RETURNING id, username, email, first_name, last_name
    """
    
    updated_user = await conn.fetchrow(update_query, user_id, get_password_hash(new_password), datetime.now(timezone.utc))
    
    return dict(updated_user)


async def validate_refresh_token(conn, refresh_token: str) -> Optional[Dict[str, Any]]:
    """
    Validate a refresh token and return the user if valid
    """
    query = """
    SELECT id, username, email, first_name, last_name
    FROM users
    WHERE refresh_token = $1 AND refresh_token_expires > $2
    """
    
    user = await conn.fetchrow(query, refresh_token, datetime.now(timezone.utc))
    
    if not user:
        return None
    
    return dict(user)

async def invalidate_refresh_token(conn, user_id: str) -> bool:
    """
    Invalidate a user's refresh token
    """
    query = """
    UPDATE users
    SET refresh_token = NULL, refresh_token_expires = NULL
    WHERE id = $1
    RETURNING id
    """
    
    result = await conn.fetchval(query, user_id)
    
    return result is not None

def verify_jwt_token(token):
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None