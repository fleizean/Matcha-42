from typing import Dict, Any
import httpx
from fastapi import HTTPException, status
from app.core.config import settings


class OAuth42Provider:
    """42 OAuth provider implementation"""
    
    AUTHORIZE_URL = "https://api.intra.42.fr/oauth/authorize"
    TOKEN_URL = "https://api.intra.42.fr/oauth/token"
    USER_INFO_URL = "https://api.intra.42.fr/v2/me"
    
    def __init__(self):
        # Add these to your settings in .env file
        self.client_id = settings.OAUTH_42_CLIENT_ID
        self.client_secret = settings.OAUTH_42_CLIENT_SECRET
        self.redirect_uri = f"{settings.FRONTEND_URL}/auth/callback/42"
    
    def get_authorize_url(self, state: str) -> str:
        """Get the authorization URL for the OAuth flow"""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "state": state,
            "scope": "public"
        }
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.AUTHORIZE_URL}?{query_string}"
    
    async def get_access_token(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(self.TOKEN_URL, data=data)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to retrieve access token: {response.text}"
                )
            
            return response.json()
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user information using the access token"""
        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(self.USER_INFO_URL, headers=headers)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to retrieve user info: {response.text}"
                )
            
            return response.json()