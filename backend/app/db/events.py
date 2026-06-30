from datetime import datetime, timezone
from typing import Any, Optional

from app.api.realtime import broadcast_notification, manager
from app.db.realtime import create_notification

EVENT_STATUSES = {
    "pending",
    "accepted",
    "declined",
    "cancelled",
    "completed",
    "expired",
}
EVENT_SELECT = """
SELECT e.id, e.connection_id, e.creator_id, e.recipient_id, e.title,
       e.description, e.meeting_type, e.starts_at, e.ends_at,
       e.location_name, e.location_address, e.latitude, e.longitude,
       e.creator_note, e.recipient_note, e.status, e.cancelled_by,
       e.cancelled_reason, e.created_at, e.updated_at, e.responded_at,
       creator.username AS creator_username,
       creator.first_name AS creator_first_name,
       creator.last_name AS creator_last_name,
       recipient.username AS recipient_username,
       recipient.first_name AS recipient_first_name,
       recipient.last_name AS recipient_last_name
FROM date_events e
JOIN users creator ON e.creator_id = creator.id
JOIN users recipient ON e.recipient_id = recipient.id
"""


def _serialize_event(row):
    if not row:
        return None

    event = dict(row)
    for field in ("starts_at", "ends_at", "created_at", "updated_at", "responded_at"):
        if event.get(field):
            event[field] = event[field].isoformat()
    return event


async def _send_event_notification(
    conn, user_id: str, sender_id: str, notification_type: str, content: str
):
    await create_notification(conn, user_id, sender_id, notification_type, content)
    await broadcast_notification(
        manager, user_id, notification_type, sender_id, content=content
    )


async def get_active_connection(conn, user1_id: str, user2_id: str):
    return await conn.fetchrow(
        """
    SELECT id, user1_id, user2_id, is_active
    FROM connections
    WHERE is_active = true
      AND ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))
    """,
        user1_id,
        user2_id,
    )


async def has_active_connection_for_event(conn, event) -> bool:
    exists = await conn.fetchval(
        """
    SELECT EXISTS(
        SELECT 1
        FROM connections
        WHERE id = $1 AND is_active = true
    )
    """,
        event["connection_id"],
    )
    return bool(exists)


async def _get_profile_ids(conn, user1_id: str, user2_id: str):
    rows = await conn.fetch(
        """
    SELECT user_id, id
    FROM profiles
    WHERE user_id = $1 OR user_id = $2
    """,
        user1_id,
        user2_id,
    )
    return {row["user_id"]: row["id"] for row in rows}


async def _profiles_blocked(conn, profile1_id: str, profile2_id: str) -> bool:
    blocked = await conn.fetchval(
        """
    SELECT EXISTS(
        SELECT 1
        FROM blocks
        WHERE (blocker_id = $1 AND blocked_id = $2)
           OR (blocker_id = $2 AND blocked_id = $1)
    )
    """,
        profile1_id,
        profile2_id,
    )
    return bool(blocked)


async def create_event(conn, creator_id: str, event_data):
    recipient_id = event_data.recipient_id

    if recipient_id == creator_id:
        return None, "self"

    recipient = await conn.fetchrow(
        """
    SELECT id
    FROM users
    WHERE id = $1 AND is_active = true
    """,
        recipient_id,
    )
    if not recipient:
        return None, "recipient_not_found"

    profile_ids = await _get_profile_ids(conn, creator_id, recipient_id)
    creator_profile_id = profile_ids.get(creator_id)
    recipient_profile_id = profile_ids.get(recipient_id)
    if not creator_profile_id or not recipient_profile_id:
        return None, "profile_not_found"

    if await _profiles_blocked(conn, creator_profile_id, recipient_profile_id):
        return None, "blocked"

    connection = await get_active_connection(conn, creator_id, recipient_id)
    if not connection:
        return None, "not_matched"

    now = datetime.now(timezone.utc)
    event_id = await conn.fetchval(
        """
    INSERT INTO date_events (
        connection_id, creator_id, recipient_id, title, description, meeting_type,
        starts_at, ends_at, location_name, location_address, latitude, longitude,
        creator_note, status, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, $14)
    RETURNING id
    """,
        connection["id"],
        creator_id,
        recipient_id,
        event_data.title,
        event_data.description,
        event_data.meeting_type,
        event_data.starts_at,
        event_data.ends_at,
        event_data.location_name,
        event_data.location_address,
        event_data.latitude,
        event_data.longitude,
        event_data.creator_note,
        now,
    )

    event = await get_event_by_id(conn, event_id, creator_id)
    if not event:
        return None, "create_failed"

    content = f"{event['creator_first_name']} sizinle bir buluşma planlamak istiyor: {event['title']}"
    await _send_event_notification(
        conn, recipient_id, creator_id, "event_invite", content
    )

    return event, None


async def list_events(
    conn,
    user_id: str,
    status: Optional[str] = None,
    upcoming: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0,
):
    params: list[Any] = [user_id]
    query = (
        EVENT_SELECT
        + """
    WHERE (e.creator_id = $1 OR e.recipient_id = $1)
    """
    )

    if status:
        params.append(status)
        query += f" AND e.status = ${len(params)}"

    if upcoming is not None:
        params.append(datetime.now(timezone.utc))
        now_param = len(params)
        if upcoming:
            query += f" AND e.starts_at >= ${now_param} AND e.status IN ('pending', 'accepted')"
        else:
            query += f" AND (e.starts_at < ${now_param} OR e.status NOT IN ('pending', 'accepted'))"

    params.extend([limit, offset])
    limit_param = len(params) - 1
    offset_param = len(params)
    order_direction = "ASC" if upcoming else "DESC"
    query += f"""
    ORDER BY e.starts_at {order_direction}
    LIMIT ${limit_param} OFFSET ${offset_param}
    """

    rows = await conn.fetch(query, *params)
    return [_serialize_event(row) for row in rows]


async def list_upcoming_events(conn, user_id: str, limit: int = 20, offset: int = 0):
    rows = await conn.fetch(
        EVENT_SELECT
        + """
    WHERE (e.creator_id = $1 OR e.recipient_id = $1)
      AND e.status IN ('pending', 'accepted')
      AND e.starts_at >= $2
    ORDER BY e.starts_at ASC
    LIMIT $3 OFFSET $4
    """,
        user_id,
        datetime.now(timezone.utc),
        limit,
        offset,
    )
    return [_serialize_event(row) for row in rows]


async def get_event_by_id(conn, event_id: int, user_id: str):
    row = await conn.fetchrow(
        EVENT_SELECT
        + """
    WHERE e.id = $1
      AND (e.creator_id = $2 OR e.recipient_id = $2)
    """,
        event_id,
        user_id,
    )
    return _serialize_event(row)


async def accept_event(conn, event, recipient_id: str):
    now = datetime.now(timezone.utc)
    await conn.execute(
        """
    UPDATE date_events
    SET status = 'accepted', updated_at = $2, responded_at = $2
    WHERE id = $1
    """,
        event["id"],
        now,
    )

    updated_event = await get_event_by_id(conn, event["id"], recipient_id)
    if not updated_event:
        raise RuntimeError("Event not found after accepting")

    content = f"{updated_event['recipient_first_name']} buluşma davetinizi kabul etti: {updated_event['title']}"
    await _send_event_notification(
        conn, updated_event["creator_id"], recipient_id, "event_accepted", content
    )
    return updated_event


async def decline_event(conn, event, recipient_id: str, note: Optional[str] = None):
    now = datetime.now(timezone.utc)
    await conn.execute(
        """
    UPDATE date_events
    SET status = 'declined', recipient_note = $2, updated_at = $3, responded_at = $3
    WHERE id = $1
    """,
        event["id"],
        note,
        now,
    )

    updated_event = await get_event_by_id(conn, event["id"], recipient_id)
    if not updated_event:
        raise RuntimeError("Event not found after declining")

    content = f"{updated_event['recipient_first_name']} buluşma davetinizi reddetti: {updated_event['title']}"
    await _send_event_notification(
        conn, updated_event["creator_id"], recipient_id, "event_declined", content
    )
    return updated_event


async def cancel_event(conn, event, cancelled_by: str, reason: Optional[str] = None):
    now = datetime.now(timezone.utc)
    await conn.execute(
        """
    UPDATE date_events
    SET status = 'cancelled', cancelled_by = $2, cancelled_reason = $3, updated_at = $4
    WHERE id = $1
    """,
        event["id"],
        cancelled_by,
        reason,
        now,
    )

    updated_event = await get_event_by_id(conn, event["id"], cancelled_by)
    if not updated_event:
        raise RuntimeError("Event not found after cancelling")

    other_user_id = (
        updated_event["recipient_id"]
        if cancelled_by == updated_event["creator_id"]
        else updated_event["creator_id"]
    )
    canceller_name = (
        updated_event["creator_first_name"]
        if cancelled_by == updated_event["creator_id"]
        else updated_event["recipient_first_name"]
    )
    content = f"{canceller_name} buluşmayı iptal etti: {updated_event['title']}"
    await _send_event_notification(
        conn, other_user_id, cancelled_by, "event_cancelled", content
    )
    return updated_event


async def cancel_future_events_for_connection(
    conn,
    connection_id: int,
    cancelled_by: Optional[str] = None,
    reason: Optional[str] = None,
):
    result = await conn.execute(
        """
    UPDATE date_events
    SET status = 'cancelled', cancelled_by = $2, cancelled_reason = $3, updated_at = $4
    WHERE connection_id = $1
      AND status IN ('pending', 'accepted')
      AND starts_at > $4
    """,
        connection_id,
        cancelled_by,
        reason,
        datetime.now(timezone.utc),
    )

    return int(result.split()[-1])
