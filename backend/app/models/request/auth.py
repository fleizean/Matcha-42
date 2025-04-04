from pydantic import BaseModel, EmailStr, Field, field_validator

from app.utils.validation import password_check, username_check


class OAuthRequest(BaseModel):
    code: str
    state: str

class LoginRequest(BaseModel):
    username: str
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="Refresh token for obtaining a new access token")

class VerifyTokenRequest(BaseModel):
    token: str = Field(..., description="Token to verify")

class RegisterRequest(BaseModel):
    username: str = Field(..., description="User's username")
    email: EmailStr = Field(..., description="User's email address")
    first_name: str = Field(..., description="User's first name")
    last_name: str = Field(..., description="User's last name")
    password: str = Field(..., description="User's password")
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        return username_check(v)
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        return password_check(v)
    
    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_name(cls, v: str, info) -> str:
        field_name = info.field_name.replace('_', ' ').title()
        
        if len(v) < 1 or len(v) > 50:
            raise ValueError(f"{field_name} 1 ile 50 karakter arasında olmalıdır")
        
        return v

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        return password_check(v)

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        return password_check(v)
