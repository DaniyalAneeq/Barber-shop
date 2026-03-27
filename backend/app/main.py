"""
BarberShop AI Chatbot — FastAPI application entry point.

Architecture:
  /api/auth/*  — Registration, email verification, JWT auth
  /api/chat/*  — Messaging, streaming, history, file uploads
  /health      — Health check for load balancers

Middleware stack (inside-out):
  1. CORS (outermost)
  2. Trusted Host
  3. GZip compression
  4. Request ID + error handler
  5. Routers
"""
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.database import close_db, init_db
from app.middleware.error_handler import ErrorHandlerMiddleware
from app.routers import auth, chat

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if get_settings().debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)
settings = get_settings()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="AI-powered barbershop assistant with email verification",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)

# ── Middleware ─────────────────────────────────────────────────────────────────
app.add_middleware(ErrorHandlerMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Refresh-Token"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(chat.router)


# ── Lifecycle ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup() -> None:
    logger.info("Starting %s (env=%s)", settings.app_name, settings.app_env)
    if settings.app_env == "development":
        await init_db()
        logger.info("Database tables created/verified")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await close_db()
    logger.info("Database connections closed")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok", "app": settings.app_name}


@app.get("/", tags=["system"])
async def root():
    return {"message": f"Welcome to {settings.app_name} API", "docs": "/docs"}
