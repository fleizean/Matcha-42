from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.profiles import router as profiles_router
from app.api.interactions import router as interactions_router
from app.api.realtime import router as realtime_router
from app.core.config import settings
from app.core.migrations import run_migrations
from contextlib import asynccontextmanager

# Create upload directories
os.makedirs(os.path.join(settings.MEDIA_ROOT, "profile_pictures"), exist_ok=True)

# Define the path to your media directory
media_path = Path(settings.MEDIA_ROOT)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run database migrations on startup
    await run_migrations()
    yield
    # Cleanup code (if needed) would go here

app = FastAPI(
    title="CrushIt API",
    description="API for CrushIt dating app",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://localhost:80","http://localhost","https://localhost:3000"], #TODO: Change this settings.BACKEND_CORS_ORIGINS from env file
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the media directory to serve static files
app.mount("/media", StaticFiles(directory=media_path), name="media")


app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["Users"])
app.include_router(profiles_router, prefix=f"{settings.API_V1_STR}/profiles", tags=["Profiles"])
app.include_router(interactions_router, prefix=f"{settings.API_V1_STR}/interactions", tags=["Interactions"])
app.include_router(realtime_router, prefix=f"{settings.API_V1_STR}/realtime", tags=["Real-time"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)