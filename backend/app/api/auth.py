from typing import Any
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm

from app.core.db import get_connection
from app.core.security import create_access_token, create_refresh_token, get_current_user, verify_password, get_password_hash
from app.validation.user import validate_password, validate_user_create
from app.db import users, profiles
from app.services.email import send_verification_email, send_password_reset_email

router = APIRouter()

@router.post("/register", response_model=dict)
async def register(
    request: Request,
    conn = Depends(get_connection)
) -> Any:
    """
    Register a new user
    """
    data = await request.json()
    
    # Validate user data
    is_valid, errors = validate_user_create(data)
    if not is_valid:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": errors}
        )
    
    # Check if username already exists
    existing_user = await users.get_user_by_username(conn, data["username"])
    if existing_user:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "This username is already registered"}
        )
    
    # Check if email already exists
    existing_email = await users.get_user_by_email(conn, data["email"])
    if existing_email:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "This email is already registered"}
        )
    
    # Generate verification token
    verification_token = str(uuid.uuid4())
    
    # Create user with verification token
    user_data = {
        "username": data["username"],
        "email": data["email"],
        "first_name": data["first_name"],
        "last_name": data["last_name"],
        "password": data["password"],
        "verification_token": verification_token
    }
    
    user_id = await users.create_user(conn, user_data)
    
    # Create empty profile
    await profiles.create_profile(conn, user_id)
    
    # Send verification email
    await send_verification_email(data["email"], data["username"], verification_token)
    
    return {
        "message": "User registered successfully. Please check your email to verify your account."
    }

@router.post("/login", response_model=dict)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    conn = Depends(get_connection)
) -> Any:
    """
    OAuth2 compatible token login
    """
    # Get user by username
    user = await users.get_user_by_username(conn, form_data.username)
    
    # If not found by username, try email
    if not user:
        user = await users.get_user_by_email(conn, form_data.username)
    
    # Check if user exists and password is correct
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is verified
    if not user["is_verified"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your email for verification instructions.",
        )
    
    # Generate access token
    access_token = create_access_token(user["id"])
    
    # Generate refresh token
    refresh_token = create_refresh_token(user["id"])
    
    # Store refresh token in the database
    await users.update_refresh_token(conn, user["id"], refresh_token)
    
    # Update user's last login and online status
    await users.update_last_activity(conn, user["id"], True)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/login/json", response_model=dict)
async def login_json(
    request: Request,
    conn = Depends(get_connection)
) -> Any:
    """
    JSON compatible login (alternative to OAuth2)
    """
    data = await request.json()
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required"
        )
    
    # Get user by username
    user = await users.get_user_by_username(conn, username)
    
    # If not found by username, try email
    if not user:
        user = await users.get_user_by_email(conn, username)
    
    # Check if user exists and password is correct
    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı adı veya şifre hatalı",
        )
    
    if not user["is_verified"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email onaylanmamış. Lütfen emailinizi kontrol edin.",
        )
    
    # Generate tokens
    access_token = create_access_token(user["id"])
    refresh_token = create_refresh_token(user["id"])
    
    # Store refresh token in the database with expiration
    await users.update_refresh_token(conn, user["id"], refresh_token)

    # Update user's last login and online status
    await users.update_last_activity(conn, user["id"], True)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=dict)
async def refresh_token_endpoint(
    request: Request,
    conn = Depends(get_connection)
) -> Any:
    """
    Refresh access token using refresh token
    """
    data = await request.json()
    refresh_token = data.get("refresh_token")
    
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refresh token is required"
        )
    
    # Get user by refresh token
    query = """
    SELECT id FROM users
    WHERE refresh_token = $1 AND refresh_token_expires > $2
    """
    user_id = await conn.fetchval(query, refresh_token, datetime.now(timezone.utc))
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    # Generate new access token
    access_token = create_access_token(user_id)
    
    # Generate new refresh token (rotating refresh tokens for better security)
    new_refresh_token = create_refresh_token(user_id)
    
    # Update refresh token in database
    await users.update_refresh_token(conn, user_id, new_refresh_token)
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.get("/verify", response_model=dict)
async def verify_email(
    token: str,
    conn = Depends(get_connection)
) -> Any:
    """
    Verify email with token
    """
    # Verify user with token
    user = await users.update_verification(conn, token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz veya süresi dolmuş onay kodu"
        )
    
    return {
        "message": "Başarıyla onaylandı. Artık giriş yapabilirsiniz."
    }

@router.post("/forgot-password", response_model=dict)
async def forgot_password(
    request: Request,
    background_tasks: BackgroundTasks,
    conn = Depends(get_connection)
) -> Any:
    """
    Request password reset
    """
    data = await request.json()
    email = data.get("email")
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required"
        )
    
    # Process in background to prevent timing attacks
    async def _request_password_reset(email: str):
        # Check if user exists
        user = await conn.fetchrow("""
        SELECT id, username FROM users WHERE email = $1
        """, email)
        
        if not user:
            # Return early without error to prevent email enumeration
            return
        
        # Generate reset token
        reset_token = str(uuid.uuid4())
        
        # Update user with reset token
        await conn.execute("""
        UPDATE users
        SET reset_password_token = $2, updated_at = $3
        WHERE id = $1
        """, user["id"], reset_token, datetime.now(timezone.utc))
        
        # Send password reset email
        await send_password_reset_email(email, user["username"], reset_token)
    
    background_tasks.add_task(_request_password_reset, email)
    
    return {
        "message": "If your email is registered, you will receive password reset instructions."
    }

@router.post("/reset-password", response_model=dict)
async def reset_password_route(
    request: Request,
    conn = Depends(get_connection)
) -> Any:
    """
    Reset password with token
    """
    data = await request.json()
    token = data.get("token")
    new_password = data.get("new_password")
    
    if not token or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token and new password are required"
        )
    
    # Validate password
    is_valid, msg = validate_password(new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )
    
    # Reset password
    user = await conn.fetchrow("""
    UPDATE users
    SET hashed_password = $2, reset_password_token = NULL, updated_at = $3
    WHERE reset_password_token = $1
    RETURNING id
    """, token, get_password_hash(new_password), datetime.now(timezone.utc))
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    return {
        "message": "Password reset successfully. You can now log in with your new password."
    }

@router.post("/change-password", response_model=dict)
async def change_password_route(
    request: Request,
    current_user = Depends(get_current_user),
    conn = Depends(get_connection)
) -> Any:
    """
    Change password
    """
    data = await request.json()
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password and new password are required"
        )
    
    # Validate new password
    is_valid, msg = validate_password(new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )
    
    # Get user with password
    user = await conn.fetchrow("""
    SELECT hashed_password FROM users WHERE id = $1
    """, current_user["id"])
    
    # Verify current password
    if not verify_password(current_password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    # Update password
    await conn.execute("""
    UPDATE users
    SET hashed_password = $2, updated_at = $3
    WHERE id = $1
    """, current_user["id"], get_password_hash(new_password), datetime.now(timezone.utc))
    
    return {
        "message": "Password changed successfully"
    }

@router.post("/logout", response_model=dict)
async def logout(
    current_user = Depends(get_current_user),
    conn = Depends(get_connection)
) -> Any:
    """
    Logout (invalidate refresh token and update online status)
    """
    # Update online status and invalidate refresh token
    await conn.execute("""
    UPDATE users
    SET is_online = false, last_online = $2, refresh_token = NULL, refresh_token_expires = NULL
    WHERE id = $1
    """, current_user["id"], datetime.now(timezone.utc))
    
    return {
        "message": "Logged out successfully"
    }