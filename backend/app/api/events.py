from typing import List, Optional

from app.core.db import get_connection
from app.core.security import get_current_verified_user
from app.db.events import (
    EVENT_STATUSES,
    accept_event,
    cancel_event,
    create_event,
    decline_event,
    get_event_by_id,
    has_active_connection_for_event,
    list_events,
    list_upcoming_events,
)
from app.models.request.events import (
    EventCancelRequest,
    EventCreateRequest,
    EventDeclineRequest,
)
from app.models.response.events import EventResponse
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status

router = APIRouter()


_CREATE_ERROR_DETAILS = {
    "self": (http_status.HTTP_400_BAD_REQUEST, "Cannot create an event with yourself"),
    "recipient_not_found": (http_status.HTTP_404_NOT_FOUND, "Recipient user not found"),
    "profile_not_found": (
        http_status.HTTP_400_BAD_REQUEST,
        "Both users need profiles to create events",
    ),
    "blocked": (
        http_status.HTTP_403_FORBIDDEN,
        "Cannot create an event with a blocked user",
    ),
    "not_matched": (
        http_status.HTTP_403_FORBIDDEN,
        "You can only create events with active matches",
    ),
    "create_failed": (
        http_status.HTTP_500_INTERNAL_SERVER_ERROR,
        "Event was created but could not be loaded",
    ),
}


async def _get_event_or_404(conn, event_id: int, user_id: str):
    event = await get_event_by_id(conn, event_id, user_id)
    if not event:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event


async def _ensure_active_connection(conn, event):
    if not await has_active_connection_for_event(conn, event):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="This event's match is no longer active",
        )


@router.post("", response_model=EventResponse, status_code=http_status.HTTP_201_CREATED)
async def create_date_event(
    event_data: EventCreateRequest,
    current_user=Depends(get_current_verified_user),
    conn=Depends(get_connection),
):
    """Create a date/event proposal for an active match."""
    event, error = await create_event(conn, current_user["id"], event_data)
    if error:
        status_code, detail = _CREATE_ERROR_DETAILS.get(
            error, (http_status.HTTP_400_BAD_REQUEST, "Could not create event")
        )
        raise HTTPException(status_code=status_code, detail=detail)

    return event


@router.get("", response_model=List[EventResponse])
async def read_events(
    status: Optional[str] = None,
    upcoming: Optional[bool] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_verified_user),
    conn=Depends(get_connection),
):
    """List events for the current user."""
    if status is not None and status not in EVENT_STATUSES:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST, detail="Invalid event status"
        )

    return await list_events(conn, current_user["id"], status, upcoming, limit, offset)


@router.get("/upcoming", response_model=List[EventResponse])
async def read_upcoming_events(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_verified_user),
    conn=Depends(get_connection),
):
    """List pending/accepted upcoming events for the current user."""
    return await list_upcoming_events(conn, current_user["id"], limit, offset)


@router.get("/{event_id}", response_model=EventResponse)
async def read_event(
    event_id: int,
    current_user=Depends(get_current_verified_user),
    conn=Depends(get_connection),
):
    """Get an event detail for a participant."""
    return await _get_event_or_404(conn, event_id, current_user["id"])


@router.post("/{event_id}/accept", response_model=EventResponse)
async def accept_date_event(
    event_id: int,
    current_user=Depends(get_current_verified_user),
    conn=Depends(get_connection),
):
    """Accept a pending event proposal. Only the recipient can accept."""
    event = await _get_event_or_404(conn, event_id, current_user["id"])
    if event["recipient_id"] != current_user["id"]:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only the recipient can accept this event",
        )
    if event["status"] != "pending":
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Only pending events can be accepted",
        )

    await _ensure_active_connection(conn, event)
    return await accept_event(conn, event, current_user["id"])


@router.post("/{event_id}/decline", response_model=EventResponse)
async def decline_date_event(
    event_id: int,
    decline_data: Optional[EventDeclineRequest] = None,
    current_user=Depends(get_current_verified_user),
    conn=Depends(get_connection),
):
    """Decline a pending event proposal. Only the recipient can decline."""
    event = await _get_event_or_404(conn, event_id, current_user["id"])
    if event["recipient_id"] != current_user["id"]:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only the recipient can decline this event",
        )
    if event["status"] != "pending":
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Only pending events can be declined",
        )

    await _ensure_active_connection(conn, event)
    note = decline_data.note if decline_data else None
    return await decline_event(conn, event, current_user["id"], note)


@router.post("/{event_id}/cancel", response_model=EventResponse)
async def cancel_date_event(
    event_id: int,
    cancel_data: Optional[EventCancelRequest] = None,
    current_user=Depends(get_current_verified_user),
    conn=Depends(get_connection),
):
    """Cancel a pending or accepted event. Either participant can cancel."""
    event = await _get_event_or_404(conn, event_id, current_user["id"])
    if event["status"] not in ("pending", "accepted"):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Only pending or accepted events can be cancelled",
        )

    await _ensure_active_connection(conn, event)
    reason = cancel_data.reason if cancel_data else None
    return await cancel_event(conn, event, current_user["id"], reason)
