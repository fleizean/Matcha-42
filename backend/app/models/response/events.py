from typing import Optional

from pydantic import BaseModel


class EventResponse(BaseModel):
    id: int
    connection_id: int
    creator_id: str
    recipient_id: str
    title: str
    description: Optional[str] = None
    meeting_type: Optional[str] = None
    starts_at: str
    ends_at: Optional[str] = None
    location_name: Optional[str] = None
    location_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    creator_note: Optional[str] = None
    recipient_note: Optional[str] = None
    status: str
    cancelled_by: Optional[str] = None
    cancelled_reason: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    responded_at: Optional[str] = None
    creator_username: Optional[str] = None
    recipient_username: Optional[str] = None
    creator_first_name: Optional[str] = None
    recipient_first_name: Optional[str] = None
    creator_last_name: Optional[str] = None
    recipient_last_name: Optional[str] = None


class MessageResponse(BaseModel):
    message: str
