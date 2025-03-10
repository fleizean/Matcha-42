from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, List, Dict, Optional
import json

from app.core.db import get_db
from app.core.security import get_current_user, get_current_verified_user
from app.models.user import User
from app.schemas.realtime import Message, MessageCreate, Notification, WebSocketMessage
from app.services.realtime import (
    get_notifications,
    mark_notification_as_read,
    mark_all_notifications_as_read,
    get_unread_notification_count,
    send_message,
    get_messages,
    get_unread_message_count,
    get_recent_conversations
)
from app.services.auth import update_last_activity

router = APIRouter()


# WebSocket connection manager for real-time features
class ConnectionManager:
    def __init__(self):
        # active_connections maps user_id to WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: Any, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(json.dumps(message))
    
    async def broadcast(self, message: Any):
        for connection in self.active_connections.values():
            await connection.send_text(json.dumps(message))


# Create connection manager instance
manager = ConnectionManager()


@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: AsyncSession = Depends(get_db)):
    """
    WebSocket endpoint for real-time features
    Uses JWT token for authentication
    """
    try:
        # Authenticate user with token
        user = await get_current_user(token=token, db=db)
        
        # Accept connection
        await manager.connect(websocket, user.id)
        
        # Update online status
        await update_last_activity(db, user.id, is_online=True)
        
        try:
            while True:
                # Receive message from client
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Handle different message types
                if message_data["type"] == "message":
                    # Send chat message
                    recipient_id = message_data["recipientId"]
                    content = message_data["content"]
                    
                    # Create message in database
                    result = await send_message(db, user.id, recipient_id, content)
                    
                    if result:
                        # Send to recipient if online
                        await manager.send_personal_message({
                            "type": "message",
                            "sender_id": user.id,
                            "content": content,
                            "timestamp": result["message"].created_at.isoformat()
                        }, recipient_id)
                
                elif message_data["type"] == "ping":
                    # Client ping to keep connection alive and update online status
                    await update_last_activity(db, user.id, is_online=True)
                    await websocket.send_text(json.dumps({"type": "pong"}))
        
        except WebSocketDisconnect:
            # Handle disconnect
            manager.disconnect(user.id)
            await update_last_activity(db, user.id, is_online=False)
    
    except Exception as e:
        # Handle authentication failure
        await websocket.close(code=1008)  # Policy violation


@router.get("/notifications", response_model=List[Notification])
async def read_notifications(
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get notifications for current user
    """
    notifications_data = await get_notifications(db, current_user.id, limit, offset, unread_only)
    
    # Extract notification objects from data
    notifications = [item["notification"] for item in notifications_data]
    
    return notifications


@router.get("/notifications/count", response_model=Dict[str, int])
async def read_notification_count(
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get unread notification count for current user
    """
    count = await get_unread_notification_count(db, current_user.id)
    
    return {
        "count": count
    }


@router.post("/notifications/{notification_id}/read", response_model=Notification)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Mark a notification as read
    """
    notification = await mark_notification_as_read(db, notification_id, current_user.id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    return notification


@router.post("/notifications/read-all", response_model=Dict[str, int])
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Mark all notifications as read
    """
    count = await mark_all_notifications_as_read(db, current_user.id)
    
    return {
        "count": count
    }


@router.post("/messages", response_model=Message)
async def create_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Send a message to another user
    """
    result = await send_message(db, current_user.id, message_data.recipient_id, message_data.content)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not send message. You might not be connected with this user."
        )
    
    # Send real-time notification via WebSocket if recipient is online
    await manager.send_personal_message({
        "type": "message",
        "sender_id": current_user.id,
        "content": message_data.content,
        "timestamp": result["message"].created_at.isoformat()
    }, message_data.recipient_id)
    
    return result["message"]


@router.get("/messages/{user_id}", response_model=List[Message])
async def read_messages(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get messages between current user and another user
    """
    messages = await get_messages(db, current_user.id, user_id, limit, offset)
    
    return messages


@router.get("/conversations", response_model=List[Dict])
async def read_conversations(
    limit: int = 10,
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get recent conversations for current user
    """
    conversations = await get_recent_conversations(db, current_user.id, limit)
    
    return conversations


@router.get("/messages/unread/count", response_model=Dict[str, int])
async def read_unread_message_count(
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get unread message count for current user
    """
    count = await get_unread_message_count(db, current_user.id)
    
    return {
        "count": count
    }