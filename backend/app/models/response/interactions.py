from typing import List, Optional
from pydantic import BaseModel


class LikeResponse(BaseModel):
    message: str
    is_match: bool

class MessageResponse(BaseModel):
    message: str

class ProfilePicture(BaseModel):
    id: int
    profile_id: str
    file_path: str
    backend_url: str
    is_primary: bool
    created_at: str

class PublicProfile(BaseModel):
    id: str
    username: str
    first_name: str
    last_name: str
    is_online: bool
    pictures: List[ProfilePicture]

class BlockResponse(BaseModel):
    is_blocked: bool
    blocked_by_me: bool
    blocked_by_them: bool
    blocker_id: Optional[str] = None

class ReportResponse(BaseModel):
    message: str
    report_id: int