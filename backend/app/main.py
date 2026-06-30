from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import os
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.profiles import router as profiles_router
from app.api.interactions import router as interactions_router
from app.api.realtime import router as realtime_router
from app.api.events import router as events_router
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
    version="1.0.2",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://frontend:3000", "http://localhost:3000", "https://localhost", "https://localhost:443"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the media directory to serve static files
app.mount("/media", StaticFiles(directory=media_path), name="media")


# Make sure truly unexpected exceptions never leak a stack trace / internal
# error message to the client — they are logged server-side and the client
# only ever sees a generic 500 response.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # exc.errors() can contain non-JSON-serializable objects (e.g. raw ValueError
    # instances in "ctx") — jsonable_encoder safely stringifies those.
    errors = jsonable_encoder(exc.errors())
    for error in errors:
        # Pydantic v2 prefixes messages from plain `raise ValueError(...)` validators
        # with "Value error, " / "Assertion error, " — strip that for cleaner messages.
        msg = error.get("msg", "")
        for prefix in ("Value error, ", "Assertion error, "):
            if msg.startswith(prefix):
                error["msg"] = msg[len(prefix):]
                break
    return JSONResponse(status_code=422, content={"detail": errors})


app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["Users"])
app.include_router(profiles_router, prefix=f"{settings.API_V1_STR}/profiles", tags=["Profiles"])
app.include_router(interactions_router, prefix=f"{settings.API_V1_STR}/interactions", tags=["Interactions"])
app.include_router(realtime_router, prefix=f"{settings.API_V1_STR}/realtime", tags=["Real-time"])
app.include_router(events_router, prefix=f"{settings.API_V1_STR}/events", tags=["Events"])
