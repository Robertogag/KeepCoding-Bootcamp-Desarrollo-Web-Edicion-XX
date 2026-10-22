import csv
import io
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models import (
    AlertRule,
    DowntimeReason,
    Machine,
    MachineCheckpoint,
    MachineEvent,
    Notification,
    ProductionMinute,
    ProductionSample,
)
from app.services.alerts import evaluate_alerts
from app.services.follow_tokens import unfollow_token
from app.services.oee import oee_series


@pytest.fixture
async def setup_machine(client, register, auth_headers):
    owner = await register()
    headers = auth_headers(owner)
    plant = (
        await client.post(
            "/api/v1/plants",
            headers=headers,
            json={"name": "Test plant", "timezone": "UTC", "is_public": True},
        )
    ).json()
    result = await client.post(
        f"/api/v1/plants/{plant['id']}/machines",
        headers=headers,
        json={
            "name": "Machine 01",
            "brand": "Demo",
            "model": "A",
            "host": "localhost",
            "port": 5020,
            "unit_id": 1,
            "ideal_cycle_s": 10,
            "is_active": True,
        },
    )
    assert result.status_code == 201, result.text
    return owner, headers, plant, result.json()


async def test_oee_events_and_csv_agree_on_partial_window(client, db_session, setup_machine):
    _, headers, plant, machine = setup_machine
    start = datetime(2026, 1, 1, 10, tzinfo=UTC)
    db_session.add(
        MachineEvent(
            machine_id=machine["id"],
            state="RUNNING",
            started_at=start - timedelta(hours=1),
            ended_at=start + timedelta(hours=1),
        )
    )
    db_session.add(
        ProductionMinute(
            machine_id=machine["id"],
            bucket_start=start,
            good=3,
            reject=0,
            run_s=60,
            idle_s=0,
            down_s=0,
            offline_s=0,
        )
    )
    for second in (5, 20, 45):
        db_session.add(
            ProductionSample(
                machine_id=machine["id"],
                sampled_at=start + timedelta(seconds=second),
                good=1,
                reject=0,
            )
        )
    await db_session.commit()
    params = {"from": "2026-01-01T10:00:15Z", "to": "2026-01-01T10:00:45Z"}
    response = await client.get(
        f"/api/v1/machines/{machine['id']}/oee", headers=headers, params=params
    )
    assert response.status_code == 200, response.text
    row = response.json()[0]
    assert row["good"] == 1 and row["run_s"] == 30 and row["planned_s"] == 30
    assert row["oee"] == pytest.approx(1 / 3)
    events = await client.get(
        f"/api/v1/machines/{machine['id']}/events", headers=headers, params=params
    )
    assert events.json()["total"] == 1
    assert events.json()["items"][0]["started_at"] == "2026-01-01T09:00:00Z"
    report = await client.get(
        f"/api/v1/plants/{plant['id']}/reports/oee.csv", headers=headers, params=params
    )
    assert report.status_code == 200, report.text
    assert report.content.startswith(b"\xef\xbb\xbf")
    assert "attachment" in report.headers["content-disposition"]
    assert "2026-01-01,Machine 01,1.0," in report.text
    exported = list(csv.DictReader(io.StringIO(report.text.lstrip("\ufeff"))))
    assert float(exported[0]["ideal_seconds"]) == 10
    offset_report = await client.get(
        f"/api/v1/plants/{plant['id']}/reports/oee.csv",
        headers=headers,
        params={"from": "2026-01-01T04:00:15-06:00", "to": "2026-01-01T04:00:45-06:00"},
    )
    assert offset_report.content == report.content
    assert offset_report.headers["content-disposition"] == report.headers["content-disposition"]
    assert "20260101T100015Z_20260101T100045Z.csv" in report.headers["content-disposition"]
    invalid = await client.get(
        f"/api/v1/machines/{machine['id']}/oee",
        headers=headers,
        params={"from": params["to"], "to": params["from"]},
    )
    assert invalid.status_code == 422


async def test_oee_series_excludes_future_time(db_session, setup_machine):
    _, _, _, machine_data = setup_machine
    machine = await db_session.get(Machine, machine_data["id"])
    start = datetime(2026, 1, 1, tzinfo=UTC)
    now = start + timedelta(hours=10, minutes=20)
    tomorrow = start + timedelta(days=1)
    db_session.add(MachineEvent(machine_id=machine.id, state="RUNNING", started_at=start))
    await db_session.commit()
    rows = await oee_series(db_session, machine, start, tomorrow, "day", now=now)
    assert len(rows) == 1
    assert rows[0]["planned_s"] == (now - start).total_seconds()
    assert rows[0]["run_s"] == (now - start).total_seconds()
    assert (
        await oee_series(db_session, machine, tomorrow, tomorrow + timedelta(days=1), now=now) == []
    )


async def test_oee_open_event_stops_at_committed_observation(db_session, setup_machine):
    _, _, _, machine_data = setup_machine
    machine = await db_session.get(Machine, machine_data["id"])
    start = datetime(2026, 1, 1, tzinfo=UTC)
    observed = start + timedelta(minutes=10)
    event = MachineEvent(machine_id=machine.id, state="RUNNING", started_at=start)
    db_session.add(event)
    db_session.add(
        MachineCheckpoint(machine_id=machine.id, accounted_at=observed, snapshot={}, progress={})
    )
    await db_session.commit()
    rows = await oee_series(db_session, machine, start, start + timedelta(hours=1), "day")
    assert rows[0]["run_s"] == 600
    assert rows[0]["planned_s"] == 3600
    assert rows[0]["availability"] == pytest.approx(1 / 6)
    await db_session.commit()
    await db_session.refresh(event)
    assert event.ended_at is None


@pytest.mark.parametrize("field", ["type", "duration_s", "is_active"])
async def test_alert_patch_rejects_null_required_values(client, setup_machine, field):
    _, headers, plant, _ = setup_machine
    created = await client.post(
        f"/api/v1/plants/{plant['id']}/alert-rules",
        headers=headers,
        json={"type": "MACHINE_DOWN", "duration_s": 30},
    )
    assert created.status_code == 201, created.text
    response = await client.patch(
        f"/api/v1/alert-rules/{created.json()['id']}", headers=headers, json={field: None}
    )
    assert response.status_code == 422, response.text
    assert response.json() == {"error": {"code": "VALIDATION_ERROR", "field": field}}


async def test_watchlist_unfollow_is_signed_and_idempotent(client, setup_machine):
    owner, headers, _, machine = setup_machine
    path = f"/api/v1/watchlist/{machine['id']}"
    assert (await client.put(path, headers=headers)).status_code == 204
    assert (await client.put(path, headers=headers)).status_code == 204
    listed = (await client.get("/api/v1/watchlist", headers=headers)).json()
    assert listed["total"] == 1 and listed["items"][0]["is_watched"]
    token = unfollow_token(owner["user"]["id"], machine["id"])
    response = await client.get("/api/v1/watchlist/unfollow", params={"token": token})
    assert (
        response.status_code == 303
        and "/es/app/watchlist?unfollowed=" in response.headers["location"]
    )
    assert (await client.get("/api/v1/watchlist", headers=headers)).json()["total"] == 0
    assert (
        await client.get("/api/v1/watchlist/unfollow", params={"token": "invalid"})
    ).status_code == 400


async def test_alert_deduplicates_same_machine_event_and_notifications(
    client, db_session, setup_machine
):
    owner, headers, plant, machine_data = setup_machine
    now = datetime.now(UTC)
    machine = await db_session.get(Machine, machine_data["id"])
    db_session.add(
        MachineEvent(
            machine_id=machine.id,
            state="DOWN",
            reason_code="3",
            started_at=now - timedelta(minutes=5),
        )
    )
    db_session.add(
        AlertRule(
            plant_id=plant["id"],
            machine_id=None,
            type="MACHINE_DOWN",
            duration_s=30,
            threshold=None,
            is_active=True,
        )
    )
    await db_session.commit()
    await evaluate_alerts(db_session, machine, {"state": "DOWN"}, now)
    await db_session.commit()
    await evaluate_alerts(db_session, machine, {"state": "DOWN"}, now)
    await db_session.commit()
    assert await db_session.scalar(select(func.count()).select_from(Notification)) == 1
    response = await client.get("/api/v1/notifications?unread=true&page_size=1", headers=headers)
    row = response.json()["items"][0]
    assert response.json()["total"] == 1 and row["payload"]["reason_code"] == "3"
    assert (
        await client.post(f"/api/v1/notifications/{row['id']}/read", headers=headers)
    ).status_code == 204
    assert (await client.get("/api/v1/notifications?unread=true", headers=headers)).json()[
        "total"
    ] == 0


async def test_public_schemas_do_not_expose_connection_fields(client, setup_machine):
    _, _, plant, machine = setup_machine
    response = await client.get(f"/api/v1/public/plants/{plant['slug']}/machines/{machine['slug']}")
    assert response.status_code == 200, response.text
    assert not set(response.json()) & {"host", "port", "unit_id", "is_watched", "comment"}
    assert "snapshot" in response.json() and "trend" in response.json()


async def test_event_classification_requires_catalog_or_null(client, db_session, setup_machine):
    _, headers, _, machine = setup_machine
    event = MachineEvent(machine_id=machine["id"], state="DOWN", started_at=datetime.now(UTC))
    db_session.add(event)
    db_session.add(
        DowntimeReason(code="3", label_es="Avería", label_en="Failure", category="mecanica")
    )
    await db_session.commit()
    path = f"/api/v1/events/{event.id}"
    for code in ("", "999"):
        response = await client.patch(path, headers=headers, json={"reason_code": code})
        assert response.status_code == 422, response.text
        assert response.json()["error"]["field"] == "reason_code"
    assigned = await client.patch(path, headers=headers, json={"reason_code": "3"})
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["reason"]["label_en"] == "Failure"
    cleared = await client.patch(path, headers=headers, json={"reason_code": None})
    assert cleared.status_code == 200 and cleared.json()["reason"] is None
