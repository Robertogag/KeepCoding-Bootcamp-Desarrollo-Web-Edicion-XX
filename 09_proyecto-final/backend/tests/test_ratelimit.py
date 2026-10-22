import pytest

from app.services.ratelimit import WINDOW_SECONDS, count_hits


class FakeCache:
    def __init__(self):
        self.counts = {}
        self.ttl = {}

    async def incr(self, name):
        self.counts[name] = self.counts.get(name, 0) + 1
        return self.counts[name]

    async def expire(self, name, seconds):
        self.ttl[name] = seconds


@pytest.mark.asyncio
async def test_count_hits_blocks_after_limit_and_sets_window_once():
    cache = FakeCache()
    for _ in range(3):
        assert await count_hits(cache, "login", ["ip:1.2.3.4", "user:demo"], limit=3) is False
    assert await count_hits(cache, "login", ["ip:1.2.3.4", "user:demo"], limit=3) is True
    assert cache.ttl["ratelimit:login:ip:1.2.3.4"] == WINDOW_SECONDS
    assert cache.counts["ratelimit:login:user:demo"] == 4


@pytest.mark.asyncio
async def test_count_hits_keeps_keys_independent():
    cache = FakeCache()
    for _ in range(5):
        await count_hits(cache, "login", ["ip:1.2.3.4"], limit=10)
    assert await count_hits(cache, "login", ["ip:9.9.9.9"], limit=10) is False
