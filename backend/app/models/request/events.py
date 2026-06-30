from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


def _ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class EventCreateRequest(BaseModel):
    recipient_id: str
    title: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    meeting_type: Optional[str] = Field(None, max_length=50)
    starts_at: datetime
    ends_at: Optional[datetime] = None
    location_name: Optional[str] = Field(None, max_length=255)
    location_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    creator_note: Optional[str] = None

    @field_validator("title", "recipient_id")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator(
        "description",
        "meeting_type",
        "location_name",
        "location_address",
        "creator_note",
    )
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def normalize_datetime(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is None:
            return value
        return _ensure_aware(value)

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and (value < -90 or value > 90):
            raise ValueError("Latitude must be between -90 and 90")
        return value

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and (value < -180 or value > 180):
            raise ValueError("Longitude must be between -180 and 180")
        return value

    @model_validator(mode="after")
    def validate_times(self) -> "EventCreateRequest":
        now = datetime.now(timezone.utc)
        if self.starts_at <= now:
            raise ValueError("starts_at must be in the future")
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class EventDeclineRequest(BaseModel):
    note: Optional[str] = None

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None


class EventCancelRequest(BaseModel):
    reason: Optional[str] = None

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None
