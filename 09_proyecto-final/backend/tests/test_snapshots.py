import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from redis.exceptions import ConnectionError

from app.services import oee

SINCE = "2026-10-21T12:00:00Z"
LAST_OBSERVED = "2026-10-21T12:20:00Z"
METRICS = dict(availability=0.8, performance=0.9, quality=0.95, oee=0.684)


def reading(**kwargs):
    return dict(
        state="RUNNING",
        since=SINCE,
        good=523,
        reject=7,
        alarm_code=3,
        last_cycle_s=28.4,
        **kwargs,
    )


@pytest.fixture
def snapshot_reader(monkeypatch):
    async def run(values, *, failure_on=None, event=None, durable=None):
        class Cache:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def get(self, key):
                if key == failure_on:
                    raise ConnectionError("Redis unavailable")
                return values.get(key)

        async def today(session, machine):
            return METRICS.copy()

        class Session:
            async def scalar(self, query):
                return event

            async def get(self, model, machine_id):
                return durable

        monkeypatch.setattr(oee.Redis, "from_url", lambda *args, **kwargs: Cache())
        monkeypatch.setattr(oee, "oee_today", today)
        return await oee.machine_snapshot(Session(), SimpleNamespace(id=1))

    return run


async def test_dead_collector_marks_offline_preserving_newest_absolute_counters(snapshot_reader):
    values = {
        "machine:1:snapshot": json.dumps(reading()),
        "machine:1:collector": json.dumps(
            {**reading(), "good": 530, "reject": 8, "accounted_at": LAST_OBSERVED}
        ),
    }
    result = await snapshot_reader(values)
    assert result["state"] == "OFFLINE"
    assert result["since"] == LAST_OBSERVED
    assert (result["good"], result["reject"]) == (530, 8)
    assert result["last_cycle_s"] == 28.4 and result["alarm_code"] == 3


async def test_live_first_checkpoint_does_not_require_a_published_snapshot(snapshot_reader):
    values = {
        "machine:1:collector": json.dumps({**reading(), "accounted_at": LAST_OBSERVED}),
        "collector:heartbeat": LAST_OBSERVED,
    }
    result = await snapshot_reader(values)
    assert result["state"] == "RUNNING"
    assert result["since"] == SINCE
    assert result["oee_today"] == METRICS


async def test_redis_failure_after_reading_retains_cached_counts(snapshot_reader):
    values = {
        "machine:1:snapshot": json.dumps(reading()),
        "machine:1:collector": json.dumps({**reading(), "accounted_at": LAST_OBSERVED}),
    }
    result = await snapshot_reader(values, failure_on="collector:heartbeat")
    assert result["state"] == "OFFLINE"
    assert result["good"] == 523 and result["reject"] == 7
    assert result["since"] == LAST_OBSERVED


async def test_snapshot_without_checkpoint_uses_database_event_timestamp(snapshot_reader):
    ended = datetime(2026, 10, 21, 12, 19, tzinfo=UTC)
    event = SimpleNamespace(started_at=datetime(2026, 10, 21, 12, tzinfo=UTC), ended_at=ended)
    values = {"machine:1:snapshot": json.dumps(reading())}
    result = await snapshot_reader(values, event=event)
    assert result["state"] == "OFFLINE"
    assert result["since"] == "2026-10-21T12:19:00Z"
    assert result["good"] == 523


async def test_no_telemetry_handles_redis_failure_without_inventing_a_timestamp(snapshot_reader):
    result = await snapshot_reader({}, failure_on="machine:1:snapshot")
    assert result["state"] == "OFFLINE"
    assert result["since"] is None and result["last_cycle_s"] is None
    assert result["good"] == 0 and result["reject"] == 0
    assert all(value is None for value in result["oee_today"].values())


async def test_existing_offline_interval_keeps_original_start(snapshot_reader):
    values = {
        "machine:1:collector": json.dumps(
            {**reading(), "state": "OFFLINE", "accounted_at": LAST_OBSERVED}
        ),
    }
    result = await snapshot_reader(values)
    assert result["state"] == "OFFLINE"
    assert result["since"] == SINCE


async def test_malformed_checkpoint_cannot_hide_valid_snapshot(snapshot_reader):
    values = {
        "machine:1:snapshot": json.dumps(reading()),
        "machine:1:collector": "[not-json]",
        "collector:heartbeat": LAST_OBSERVED,
    }
    result = await snapshot_reader(values)
    assert result["state"] == "RUNNING" and result["good"] == 523


async def test_full_redis_outage_uses_durable_absolute_counters(snapshot_reader):
    durable = SimpleNamespace(
        snapshot={**reading(), "good": 580, "reject": 11},
        accounted_at=datetime(2026, 10, 21, 12, 25, tzinfo=UTC),
    )
    result = await snapshot_reader({}, failure_on="machine:1:snapshot", durable=durable)
    assert result["state"] == "OFFLINE"
    assert result["since"] == "2026-10-21T12:25:00Z"
    assert result["good"] == 580 and result["reject"] == 11


async def test_newer_durable_checkpoint_takes_precedence_over_stale_redis(snapshot_reader):
    durable = SimpleNamespace(
        snapshot={**reading(), "good": 581},
        accounted_at=datetime(2026, 10, 21, 12, 21, tzinfo=UTC),
    )
    result = await snapshot_reader(
        {
            "machine:1:collector": json.dumps({**reading(), "accounted_at": LAST_OBSERVED}),
        },
        durable=durable,
    )
    assert result["state"] == "OFFLINE"
    assert result["good"] == 581 and result["since"] == "2026-10-21T12:21:00Z"
