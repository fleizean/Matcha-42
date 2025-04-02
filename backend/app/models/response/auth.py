from pydantic import BaseModel

class MessageResponse(BaseModel):
    message: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class OAuthorizeResponse(BaseModel):
    authorize_url: str
    state: str

class OAuthResponse(TokenResponse):
    is_new_user: bool

