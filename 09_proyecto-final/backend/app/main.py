import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import text

from app.api import (
    alerts,
    auth,
    board,
    events,
    injection,
    layout,
    machines,
    me,
    notifications,
    oee,
    plants,
    public,
    shifts,
    telemetry,
    watchlist,
    ws,
)
from app.config import settings
from app.db import SessionLocal, engine
from app.errors import install_error_handlers
from app.openapi import install_openapi
from app.services.notifier import run_notifier


@asynccontextmanager
async def lifespan(app):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    notifier = asyncio.create_task(run_notifier())
    try:
        yield
    finally:
        notifier.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await notifier
        await engine.dispose()


app = FastAPI(
    title="OEE Live",
    version="1.0.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Disposition"],
)
install_error_handlers(app)
for module in (
    auth,
    board,
    me,
    public,
    plants,
    machines,
    shifts,
    oee,
    events,
    injection,
    layout,
    telemetry,
    alerts,
    notifications,
    watchlist,
):
    app.include_router(module.router, prefix="/api/v1")
app.include_router(ws.router)


@app.get("/api/v1/health", tags=["health"])
async def health():
    checks = {"database": False, "redis": False}
    try:
        async with asyncio.timeout(2), SessionLocal() as session:
            await session.execute(text("SELECT 1"))
            checks["database"] = True
    except Exception:
        pass
    try:
        async with Redis.from_url(
            settings.redis_url, socket_timeout=1, socket_connect_timeout=1
        ) as cache:
            checks["redis"] = bool(await cache.ping())
    except Exception:
        pass
    ready = all(checks.values())
    return JSONResponse(
        {"status": "ok" if ready else "unavailable", "checks": checks},
        status_code=200 if ready else 503,
    )


install_openapi(app)
