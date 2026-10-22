"""Read-only readiness probe for the separate telemetry collector.

The collector publishes its heartbeat after durable SQL persistence and Redis
publication. Checking its timestamp catches expired, malformed and stale signals.
Run with ``python -m app.collector.health`` from the backend environment.
"""

import asyncio
import json
from datetime import UTC, datetime

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import settings

MAX_AGE_SECONDS = 10
MAX_CLOCK_SKEW_SECONDS = 2


def evaluate_heartbeat(raw: str | None, now: datetime) -> dict:
    if raw is None:
        return {"status": "unhealthy", "reason": "collector_not_reporting"}
    try:
        heartbeat = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if heartbeat.tzinfo is None or heartbeat.utcoffset() is None:
            raise ValueError("Heartbeat needs a timezone")
        age = (now - heartbeat).total_seconds()
    except (ValueError, TypeError, AttributeError):
        return {"status": "unhealthy", "reason": "invalid_heartbeat"}
    if age < -MAX_CLOCK_SKEW_SECONDS:
        return {"status": "unhealthy", "reason": "collector_clock_ahead"}
    if age >= MAX_AGE_SECONDS:
        return {"status": "unhealthy", "reason": "stale_heartbeat", "age_seconds": round(age, 3)}
    return {"status": "healthy", "age_seconds": round(max(0.0, age), 3)}


async def check_health(cache: Redis) -> dict:
    try:
        raw = await cache.get("collector:heartbeat")
    except (RedisError, OSError, TimeoutError):
        return {"status": "unhealthy", "reason": "redis_unavailable"}
    return evaluate_heartbeat(raw, datetime.now(UTC))


async def main() -> int:
    async with Redis.from_url(
        settings.redis_url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2
    ) as cache:
        result = await check_health(cache)
    print(json.dumps(result))
    return 0 if result["status"] == "healthy" else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
