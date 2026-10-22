"""Límite de intentos para rutas de autenticación, con contadores en Redis.

Falla abierto: si Redis no responde, la petición sigue; el resto de la aplicación ya trata a Redis
como caché opcional. Cada clave cuenta aciertos en una ventana fija y bloquea al superar el límite.
"""

from fastapi import Request
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import settings
from app.errors import ApiError

WINDOW_SECONDS = 600


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


async def count_hits(cache, scope: str, keys: list[str], limit: int) -> bool:
    """Incrementa cada contador y devuelve True si alguno supera el límite."""
    blocked = False
    for key in keys:
        name = f"ratelimit:{scope}:{key}"
        count = await cache.incr(name)
        if count == 1:
            await cache.expire(name, WINDOW_SECONDS)
        if count > limit:
            blocked = True
    return blocked


async def enforce(scope: str, keys: list[str], limit: int) -> None:
    if settings.environment == "test":
        return
    try:
        async with Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.3,
            socket_timeout=0.3,
        ) as cache:
            blocked = await count_hits(cache, scope, keys, limit)
    except (RedisError, AttributeError, TypeError):
        # Sin Redis, o con una caché que no sabe contar, no se bloquea a nadie.
        return
    if blocked:
        raise ApiError(429, "RATE_LIMITED")


async def clear(scope: str, key: str) -> None:
    if settings.environment == "test":
        return
    try:
        async with Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.3,
            socket_timeout=0.3,
        ) as cache:
            await cache.delete(f"ratelimit:{scope}:{key}")
    except (RedisError, AttributeError, TypeError):
        return
