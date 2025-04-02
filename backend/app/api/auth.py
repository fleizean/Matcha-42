import json
from typing import Any, Dict
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm

from app.core.db import get_connection
from app.core.security import create_access_token, create_refresh_token, get_current_user, verify_password, get_password_hash
from app.db import users, profiles
from app.services.email import send_verification_email, send_password_reset_email

import secrets
from app.core.oauth import OAuth42Provider
from app.models.request.auth import ChangePasswordRequest, ForgotPasswordRequest, LoginRequest, OAuthRequest, RefreshTokenRequest, RegisterRequest, ResetPasswordRequest, VerifyTokenRequest
from app.models.response.auth import MessageResponse, OAuthResponse, OAuthorizeResponse, TokenResponse

router = APIRouter()

@router.post("/register", response_model=MessageResponse)
async def register(
    user_data: RegisterRequest,
    conn = Depends(get_connection)
) -> Dict[str, str]:
    """
    Register a new user
    """
    # Check if username already exists
    existing_user = await users.get_user_by_username(conn, user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This username is already registered"
        )
    
    # Check if email already exists
    existing_email = await users.get_user_by_email(conn, user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is already registered"
        )
    
    # Generate verification token
    verification_token = str(uuid.uuid4())
    
    # Create user with verification token
    user_info = {
        "username": user_data.username,
        "email": user_data.email,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "password": user_data.password,
        "verification_token": verification_token
    }
    
    try:
        # Create user in database
        user_id = await users.create_user(conn, user_info)
        
        # Create empty profile
        await profiles.create_profile(conn, user_id)
        
        # Send verification email
        await send_verification_email(user_data.email, user_data.username, verification_token)
        
        return MessageResponse(
            message="User registered successfully. Please check your email to verify your account."
        )
    except Exception as e:
        # Log the error
        import logging
        logging.error(f"Error during registration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again later."
        )

@router.post("/login", response_model=TokenResponse)
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
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

# Initialize OAuth provider
oauth42 = OAuth42Provider()

@router.get("/oauth/42", response_model=OAuthorizeResponse)
async def oauth_42_authorize():
    """Start 42 OAuth flow"""
    # Generate a random state to prevent CSRF attacks
    state = secrets.token_urlsafe(32)
    authorize_url = oauth42.get_authorize_url(state)
    
    return OAuthorizeResponse(
        authorize_url=authorize_url,
        state=state
    )


@router.post("/oauth/42/callback", response_model=OAuthResponse)
async def oauth_42_callback(
    oauth_data: OAuthRequest,
    conn = Depends(get_connection)
):
    """Handle 42 OAuth callback"""
    try:
        # Extract code and state from request body
        code = oauth_data.code
        state = oauth_data.state
        
        if not code or not state:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Code and state parameters are required"}
            )
            
        # Exchange code for access token
        token_data = await oauth42.get_access_token(code)
        access_token = token_data.get("access_token")
        
        if not access_token:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Invalid access token"}
            )
        
        # Get user info from 42 API
        user_info = await oauth42.get_user_info(access_token)
        
        # Extract needed information
        intra_id = str(user_info.get("id"))
        email = user_info.get("email")
        login = user_info.get("login")
        first_name = user_info.get("first_name")
        last_name = user_info.get("last_name")
        
        # Get profile image URL if available
        image_url = None
        if user_info.get("image") and isinstance(user_info.get("image"), dict):
            # 42 API has different image versions - try to get link or versions
            image_data = user_info.get("image")
            if image_data.get("link"):
                image_url = image_data.get("link")
            elif image_data.get("versions") and isinstance(image_data.get("versions"), dict):
                # Try to get medium size or any available size
                versions = image_data.get("versions")
                image_url = (versions.get("medium") or versions.get("large") or 
                             versions.get("small") or next(iter(versions.values()), None))
        
        if not email or not intra_id:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Missing user information from 42 API"}
            )
        
        # Check if user already exists by email
        existing_user = await users.get_user_by_email(conn, email)
        
        # User exists, login the user
        if existing_user:
            # User is already registered, check if they were registered with 42
            oauth_connection = await conn.fetchrow("""
            SELECT id FROM oauth_connections 
            WHERE provider = '42' AND provider_user_id = $1
            """, intra_id)
            
            # If not registered with 42, link the accounts
            if not oauth_connection:
                # Create the oauth connection
                await conn.execute("""
                INSERT INTO oauth_connections (user_id, provider, provider_user_id, provider_data)
                VALUES ($1, '42', $2, $3)
                """, existing_user["id"], intra_id, json.dumps({"image_url": image_url}) if image_url else None)
                
                # Get user's profile
                profile = await conn.fetchrow("""
                SELECT id FROM profiles
                WHERE user_id = $1
                """, existing_user["id"])
                
                # Check if user has a profile picture
                has_picture = False
                if profile:
                    has_picture = await conn.fetchval("""
                    SELECT COUNT(*) FROM profile_pictures
                    WHERE profile_id = $1
                    """, profile["id"])
                
                # If user doesn't have a profile picture yet, save the 42 profile image
                if profile and not has_picture and image_url:
                    from app.utils.profile_picture import save_profile_image_from_url
                    await save_profile_image_from_url(conn, profile["id"], image_url)
            
            
            # Generate JWT tokens
            access_token = create_access_token(existing_user["id"])
            refresh_token = create_refresh_token(existing_user["id"])
            
            # Store refresh token
            await users.update_refresh_token(conn, existing_user["id"], refresh_token)
            
            # Update last login
            await users.update_last_activity(conn, existing_user["id"], True)
            
            return OAuthResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                is_new_user=False
            )
        
        # User doesn't exist, create a new user
        else:
            # Generate a unique username if necessary
            username = login
            username_exists = await users.get_user_by_username(conn, username)
            
            # Append a random string if username already exists
            if username_exists:
                username = f"{login}_{secrets.token_hex(4)}"
            
            # Create a random password (user won't need it, will use OAuth)
            random_password = secrets.token_urlsafe(16)
            
            # Start a transaction
            async with conn.transaction():
                # Create the user
                user_data = {
                    "username": username,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "password": random_password,
                    "verification_token": None  # No need for verification token
                }
                
                user_id = await users.create_user(conn, user_data)
                
                # Mark user as verified since 42 already verified their email
                await conn.execute("""
                UPDATE users SET is_verified = true WHERE id = $1
                """, user_id)
                
                # Create empty profile
                profile_id = await profiles.create_profile(conn, user_id)
                
                # Save profile image if available
                if image_url:
                    from app.utils.profile_picture import save_profile_image_from_url
                    await save_profile_image_from_url(conn, profile_id, image_url)
                        
                # Create OAuth connection
                await conn.execute("""
                INSERT INTO oauth_connections (user_id, provider, provider_user_id, provider_data)
                VALUES ($1, '42', $2, $3)
                """, user_id, intra_id, json.dumps({"image_url": image_url}) if image_url else None)
                
                # Generate JWT tokens
                access_token = create_access_token(user_id)
                refresh_token = create_refresh_token(user_id)
                
                # Store refresh token
                await users.update_refresh_token(conn, user_id, refresh_token)
                
                # Update last login
                await users.update_last_activity(conn, user_id, True)
            
            return OAuthResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer",
                is_new_user=True
            )
            
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"OAuth callback error: {str(e)}"}
        )

@router.post("/login/json", response_model=TokenResponse)
async def login_json(
    login_data: LoginRequest,
    conn = Depends(get_connection)
) -> Any:
    """
    JSON compatible login (alternative to OAuth2)
    """
    username = login_data.username
    password = login_data.password
    
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
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token_endpoint(
    token_data: RefreshTokenRequest,
    conn = Depends(get_connection)
) -> Any:
    """
    Refresh access token using refresh token
    """
    
    if not token_data.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refresh token is required"
        )
    
    # Get user by refresh token
    query = """
    SELECT id FROM users
    WHERE refresh_token = $1 AND refresh_token_expires > $2
    """
    user_id = await conn.fetchval(query, token_data.refresh_token, datetime.now(timezone.utc))
    
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
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer"
    )


@router.get("/verify", response_model=MessageResponse)
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
    
    return MessageResponse(
        message="Email onaylandı. Artık giriş yapabilirsiniz."
    )

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    forgot_password_data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    conn = Depends(get_connection)
) -> Any:
    """
    Request password reset
    """
    email = forgot_password_data.email
    
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
    
    return MessageResponse(
        message="If your email is registered, you will receive password reset instructions."
    )

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password_route(
    reset_data: ResetPasswordRequest,
    conn = Depends(get_connection)
) -> Dict[str, str]:
    """
    Reset password with token
    
    - **token**: Password reset token sent via email
    - **new_password**: New password that meets security requirements
    """
    try:
        # Reset password
        user = await conn.fetchrow("""
        UPDATE users
        SET hashed_password = $2, reset_password_token = NULL, updated_at = $3
        WHERE reset_password_token = $1
        RETURNING id
        """, reset_data.token, get_password_hash(reset_data.new_password), datetime.now(timezone.utc))
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        return MessageResponse(
            message="Password reset successfully. You can now log in with your new password."
        )
    except Exception as e:       
        # If it's our HTTPException, re-raise it
        if isinstance(e, HTTPException):
            raise
            
        # Otherwise, return a generic error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed. Please try again later."
        )

@router.post("/change-password", response_model=MessageResponse)
async def change_password_route(
    change_data: ChangePasswordRequest,
    current_user = Depends(get_current_user),
    conn = Depends(get_connection)
) -> Any:
    """
    Change password
    """
    try:
        # Get user with password
        user = await conn.fetchrow("""
        SELECT hashed_password FROM users WHERE id = $1
        """, current_user["id"])
        
        # Verify current password
        if not verify_password(change_data.current_password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password"
            )
        
        # Update password
        await conn.execute("""
        UPDATE users
        SET hashed_password = $2, updated_at = $3
        WHERE id = $1
        """, current_user["id"], get_password_hash(change_data.new_password), datetime.now(timezone.utc))
        
        return MessageResponse(
            message="Password changed successfully"
        )
    except Exception as e:       
        # If it's our HTTPException, re-raise it
        if isinstance(e, HTTPException):
            raise
            
        # Otherwise, return a generic error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed. Please try again later."
        )

@router.post("/logout", response_model=MessageResponse)
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
    
    return MessageResponse(
        message="Logged out successfully"
    )