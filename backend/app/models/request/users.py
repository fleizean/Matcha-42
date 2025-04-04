from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.utils.validation import username_check


class UserUpdateRequest(BaseModel):
    username: Optional[str] = Field(None, description="User's username")
    email: Optional[EmailStr] = Field(None, description="User's email address")
    first_name: Optional[str] = Field(None, description="User's first name")
    last_name: Optional[str] = Field(None, description="User's last name")
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
            
        username_check(v)
    
    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_name(cls, v: Optional[str], info) -> Optional[str]:
        if v is None:
            return v
            
        field_name = info.field_name.replace('_', ' ').title()
        
        if len(v) < 1 or len(v) > 50:
            raise ValueError(f"{field_name} 1 ile 50 karakter arasında olmalıdır")
        
        return v