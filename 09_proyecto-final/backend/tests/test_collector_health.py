from datetime import UTC, datetime, timedelta

import pytest
from fakeredis.aioredis import FakeRedis
from redis.exceptions import ConnectionError as RedisConnectionError

from app.collector.health import check_health, evaluate_heartbeat

NOW = datetime(2026, 10, 21, 20, tzinfo=UTC)


@pytest.mark.parametrize("age", [0, 2, 9.999])
def test_recent_heartbeat_is_healthy(age):
    result = evaluate_heartbeat((NOW - timedelta(seconds=age)).isoformat(), NOW)
    assert result["status"] == "healthy"
    assert result["age_seconds"] == age


@pytest.mark.parametrize("age", [10, 3600])
def test_stale_signal_is_unhealthy_even_if_redis_still_contains_the_key(age):
    result = evaluate_heartbeat((NOW - timedelta(seconds=age)).isoformat(), NOW)
    assert result["reason"] == "stale_heartbeat"


@pytest.mark.parametrize("raw", ["bad-timestamp", "2026-10-21T20:00:00", ""])
def test_invalid_or_timezone_free_signal_is_not_healthy(raw):
    assert evaluate_heartbeat(raw, NOW)["reason"] == "invalid_heartbeat"


def test_missing_heartbeat_and_clock_skew_are_distinguished():
    assert evaluate_heartbeat(None, NOW)["reason"] == "collector_not_reporting"
    assert evaluate_heartbeat((NOW + timedelta(seconds=3)).isoformat(), NOW)["reason"] == (
        "collector_clock_ahead"
    )
    assert evaluate_heartbeat((NOW + timedelta(seconds=1)).isoformat(), NOW) == {
        "status": "healthy",
        "age_seconds": 0.0,
    }


async def test_probe_observes_the_live_signal_and_its_disappearance():
    async with FakeRedis(decode_responses=True) as cache:
        await cache.set("collector:heartbeat", datetime.now(UTC).isoformat(), ex=10)
        assert (await check_health(cache))["status"] == "healthy"
        await cache.delete("collector:heartbeat")
        assert (await check_health(cache))["reason"] == "collector_not_reporting"


async def test_redis_failure_does_not_expose_connection_details():
    class UnreachableCache:
        async def get(self, _):
            raise RedisConnectionError("redis://private-user:private-password@private-host")

    result = await check_health(UnreachableCache())
    assert result == {"status": "unhealthy", "reason": "redis_unavailable"}
