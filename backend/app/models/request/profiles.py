from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

class LikedStatusRequest(BaseModel):
    profileIds: List[str] = Field(..., description="List of profile IDs to like or unlike")

class LocationUpdateRequest(BaseModel):
    latitude: float = Field(..., 
                          description="Latitude coordinate (must be between -90 and 90)", 
                          ge=-90.0, 
                          le=90.0)
    longitude: float = Field(..., 
                           description="Longitude coordinate (must be between -180 and 180)", 
                           ge=-180.0, 
                           le=180.0)

class ProfileUpdateRequest(BaseModel):
    gender: Optional[str] = Field(None, description="User gender")
    sexual_preference: Optional[str] = Field(None, description="Sexual preference")
    biography: Optional[str] = Field(None, description="User biography")
    latitude: Optional[float] = Field(None, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, description="Longitude coordinate")
    birth_date: Optional[str] = Field(None, description="Birth date in ISO format")
    
    # Add field validations - using Pydantic V2 field_validator
    @field_validator('gender')
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_genders = ['male', 'female', 'non_binary', 'other']
            if v not in valid_genders:
                raise ValueError(f"Gender must be one of: {', '.join(valid_genders)}")
        return v
    
    @field_validator('sexual_preference')
    @classmethod
    def validate_sexual_preference(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_preferences = ['heterosexual', 'homosexual', 'bisexual', 'other']
            if v not in valid_preferences:
                raise ValueError(f"Sexual preference must be one of: {', '.join(valid_preferences)}")
        return v
    
    @field_validator('biography')
    @classmethod
    def validate_biography(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 1000:
            raise ValueError("Biography must be less than 1000 characters")
        return v
    
    @field_validator('latitude')
    @classmethod
    def validate_latitude(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < -90 or v > 90):
            raise ValueError("Latitude must be between -90 and 90")
        return v
    
    @field_validator('longitude')
    @classmethod
    def validate_longitude(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < -180 or v > 180):
            raise ValueError("Longitude must be between -180 and 180")
        return v
    
    @field_validator('birth_date')
    @classmethod
    def validate_birth_date(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        
        try:
            birth_date = datetime.fromisoformat(v.replace('Z', '+00:00'))
            today = datetime.now(timezone.utc)
            
            # Check if date is in future
            if birth_date > today:
                raise ValueError("Birth date cannot be in the future")
            
            # Check minimum age (18)
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            if age < 18:
                raise ValueError("Minimum age requirement is 18 years")
            
            # Check reasonable date range
            if birth_date.year < 1925:
                raise ValueError("Please enter a valid birth date")
            
            # Check maximum age (99)
            if age > 99:
                raise ValueError("Please enter a valid birth date")
            
        except ValueError as e:
            raise ValueError(f"Invalid date format: {str(e)}")
        
        return v
        
    # Optional: Validate coordinates together using a model validator
    @model_validator(mode='after')
    def validate_coordinates(self) -> 'ProfileUpdateRequest':
        lat, lon = self.latitude, self.longitude
        
        # If only one coordinate is provided, both should be provided
        if (lat is None and lon is not None) or (lat is not None and lon is None):
            raise ValueError("Both latitude and longitude must be provided together")
            
        return self
    
class UpdateTagsRequest(BaseModel):
    tags: List[str] = Field(default_list=[], description="List of tags to update the profile with")
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, tags):
        if not tags:
            return tags  # Tags are optional
        
        BLACKLISTED_TAGS = [
            'admin', 'moderator', 'staff', 'support',
            'system', 'crushit', 'crushitapp'
        ]
        
        errors = []
        for tag in tags:
            # Check length
            if len(tag) < 2 or len(tag) > 20:
                errors.append(f"Tag '{tag}': Tag name must be between 2 and 20 characters")
                continue
            
            # Check characters - only allow letters, numbers, and hyphens
            if not tag.replace('-', '').isalnum():
                errors.append(f"Tag '{tag}': Tag can only contain letters, numbers, and hyphens")
                continue
            
            # Check for valid hyphen usage
            if tag.startswith('-') or tag.endswith('-'):
                errors.append(f"Tag '{tag}': Tag cannot start or end with a hyphen")
                continue
            
            # Check for consecutive hyphens
            if '--' in tag:
                errors.append(f"Tag '{tag}': Tag cannot contain consecutive hyphens")
                continue
            
            # Check blacklist
            if tag.lower() in BLACKLISTED_TAGS:
                errors.append(f"Tag '{tag}': '{tag}' tag is not allowed")
                continue
            
            # Check if tag contains only hyphens
            if all(c == '-' for c in tag):
                errors.append(f"Tag '{tag}': Tag cannot consist only of hyphens")
                continue
        
        if errors:
            raise ValueError(errors)
        
        return tags