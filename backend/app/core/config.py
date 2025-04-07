import json
from pydantic_settings import BaseSettings
from typing import List
from pydantic import EmailStr, AnyHttpUrl, field_validator


class Settings(BaseSettings):
    # Application settings
    PROJECT_NAME: str = "CrushIt"
    API_V1_STR: str = "/bapi"
    
    # CORS settings
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            try:
                # Try to parse as JSON
                return json.loads(v)
            except json.JSONDecodeError:
                # Fall back to comma-separated format
                return [url.strip() for url in v.split(",")]
        return v

    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str

    # Database settings
    DATABASE_URL: str
    
    # JWT settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Email settings
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: EmailStr
    MAIL_PORT: int = 587
    MAIL_SERVER: str
    MAIL_TLS: bool = True
    MAIL_SSL: bool = False

    # OAuth settings
    OAUTH_42_CLIENT_ID: str
    OAUTH_42_CLIENT_SECRET: str
    

    MEDIA_ROOT: str = "./media"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()