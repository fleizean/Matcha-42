from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


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
    
    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_name(cls, v: Optional[str], info) -> Optional[str]:
        if v is None:
            return v
            
        field_name = info.field_name.replace('_', ' ').title()
        
        if len(v) < 1 or len(v) > 50:
            raise ValueError(f"{field_name} 1 ile 50 karakter arasında olmalıdır")
        
        return v