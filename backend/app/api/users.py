# app/api/users.py
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.db import get_connection
from app.core.security import get_current_user, get_current_verified_user
from app.db import users
from app.models.request.users import UserUpdateRequest
from app.models.response.users import UserResponse

router = APIRouter()

@router.get("/me", response_model=dict)
async def read_user_me(
    current_user = Depends(get_current_user),
) -> Any:
    """
    Get current user
    """
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_user_me(
    user_data: UserUpdateRequest,
    current_user = Depends(get_current_verified_user),
    conn = Depends(get_connection)
) -> Dict[str, Any]:
    """
    Update current user information
    """
    # Convert Pydantic model to dict for database operations
    data = user_data.model_dump(exclude_unset=True, exclude_none=True)
    
    # If no fields to update, return early
    if not data:
        return dict(current_user)
    
    # Check if username is being changed and if it's already taken
    if "username" in data and data["username"] != current_user["username"]:
        existing_user = await users.get_user_by_username(conn, data["username"])
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
    
    # Check if email is being changed and if it's already taken
    if "email" in data and data["email"] != current_user["email"]:
        existing_email = await users.get_user_by_email(conn, data["email"])
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # Update user
    updated_user = await users.update_user(conn, current_user["id"], data)
    
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )
    
    return dict(updated_user)

@router.get("/me/oauth")
async def get_user_oauth_status(
    current_user = Depends(get_current_user),
    conn = Depends(get_connection)
) -> Dict[str, bool]:
    """
    Check if the current user has any OAuth connections
    """
    # Check if user has any OAuth connections
    oauth_connections = await conn.fetchval("""
    SELECT COUNT(*) FROM oauth_connections
    WHERE user_id = $1
    """, current_user["id"])
    
    return {
        "has_oauth_connections": oauth_connections > 0
    }

@router.post("/heartbeat", response_model=dict)
async def user_heartbeat(
    current_user = Depends(get_current_user),
    conn = Depends(get_connection)
) -> Any:
    """
    Update user's last activity timestamp (for online status)
    """
    await users.update_last_activity(conn, current_user["id"], True)
    
    return {
        "status": "ok"
    }