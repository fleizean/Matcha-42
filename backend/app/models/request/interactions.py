from pydantic import BaseModel

class LikeRequest(BaseModel):
    liked_id: str

class BlockRequest(BaseModel):
    blocked_id: str

class ReportRequest(BaseModel):
    reported_id: str
    reason: str
    description: str