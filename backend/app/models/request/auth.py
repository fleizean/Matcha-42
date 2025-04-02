from pydantic import BaseModel, EmailStr, Field, field_validator


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
        if len(v) < 3 or len(v) > 30:
            raise ValueError("Kullanıcı adı 3 ile 30 karakter arasında olmalıdır")
        
        # Turkish character mapping
        turkish_map = {
            'ğ': 'g', 'Ğ': 'G',
            'ü': 'u', 'Ü': 'U',
            'ş': 's', 'Ş': 'S',
            'ı': 'i', 'İ': 'I',
            'ö': 'o', 'Ö': 'O',
            'ç': 'c', 'Ç': 'C'
        }
        
        # Convert Turkish characters to ASCII equivalents
        normalized = ''.join(turkish_map.get(char, char) for char in v)
        
        # Check if contains only allowed characters
        if not normalized.isalnum():
            raise ValueError("Kullanıcı adı sadece harf ve rakamlardan oluşabilir")
        
        # Check if original had Turkish characters
        if v != normalized:
            raise ValueError("Kullanıcı adı türkçe karakter içeremez (ü,ğ,ş,ı,ö,ç)")
        
        return v
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Şifre en az 8 karakter olmalıdır")
        
        # Check complexity
        has_upper = any(char.isupper() for char in v)
        has_lower = any(char.islower() for char in v)
        has_digit = any(char.isdigit() for char in v)
        has_special = any(not char.isalnum() for char in v)
        
        complexity_score = sum([has_upper, has_lower, has_digit, has_special])
        if complexity_score < 3:
            raise ValueError("Şifre yeterince karmaşık değil")
        
        # Check against common passwords
        common_passwords = [
            'password', '123456', '12345678', '1234', 'qwerty', '12345', 'abc123',
            'password1', 'admin', 'letmein', 'welcome', 'monkey', 'football', 'iloveyou'
        ]
        
        if v.lower() in common_passwords:
            raise ValueError("Şifre çok yaygın bir şifre, lütfen daha güçlü bir şifre seçin")
        
        return v
    
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
        if len(v) < 8:
            raise ValueError("Şifre en az 8 karakter olmalıdır")
        
        # Check complexity
        has_upper = any(char.isupper() for char in v)
        has_lower = any(char.islower() for char in v)
        has_digit = any(char.isdigit() for char in v)
        has_special = any(not char.isalnum() for char in v)
        
        complexity_score = sum([has_upper, has_lower, has_digit, has_special])
        if complexity_score < 3:
            raise ValueError("Şifre yeterince karmaşık değil")
        
        # Check against common passwords
        common_passwords = [
            'password', '123456', '12345678', '1234', 'qwerty', '12345', 'abc123',
            'password1', 'admin', 'letmein', 'welcome', 'monkey', 'football', 'iloveyou'
        ]
        
        if v.lower() in common_passwords:
            raise ValueError("Şifre çok yaygın bir şifre, lütfen daha güçlü bir şifre seçin")
        
        return v

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Şifre en az 8 karakter olmalıdır")
        
        # Check complexity
        has_upper = any(char.isupper() for char in v)
        has_lower = any(char.islower() for char in v)
        has_digit = any(char.isdigit() for char in v)
        has_special = any(not char.isalnum() for char in v)
        
        complexity_score = sum([has_upper, has_lower, has_digit, has_special])
        if complexity_score < 3:
            raise ValueError("Şifre yeterince karmaşık değil")
        
        # Check against common passwords
        common_passwords = [
            'password', '123456', '12345678', '1234', 'qwerty', '12345', 'abc123',
            'password1', 'admin', 'letmein', 'welcome', 'monkey', 'football', 'iloveyou'
        ]
        
        if v.lower() in common_passwords:
            raise ValueError("Şifre çok yaygın bir şifre, lütfen daha güçlü bir şifre seçin")
        
        return v