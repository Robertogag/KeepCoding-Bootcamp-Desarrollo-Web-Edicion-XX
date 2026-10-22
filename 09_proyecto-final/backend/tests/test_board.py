import json
from datetime import UTC, datetime, time, timedelta

import pytest
from sqlalchemy import event

from app.models import (
    DowntimeReason,
    InjectionRecipe,
    LineDowntime,
    LineDowntimeMachine,
    Machine,
    MachineBoardPosition,
    MachineCheckpoint,
    MachineEvent,
    Mold,
    Plant,
    PlantMember,
    Product,
    ProductionLine,
    ProductionMinute,
    ProductionOrder,
    ProductionRun,
    ProductionSample,
    Resin,
    Shift,
)
from app.schemas.board import PlantBoard
from app.services import oee
from app.services.board import plant_board

NOW = datetime(2026, 1, 7, 0, 2, tzinfo=UTC)
START = NOW - timedelta(minutes=2)


def reading(state="RUNNING", since=START):
    return dict(
        state=state, since=oee.iso(since), good=120, reject=3, alarm_code=0, last_cycle_s=20
    )


@pytest.fixture
def cache(monkeypatch):
    values = {"collector:heartbeat": oee.iso(NOW)}

    class Cache:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, key):
            return values.get(key)

    monkeypatch.setattr(oee.Redis, "from_url", lambda *args, **kwargs: Cache())
    return values


@pytest.fixture
async def setup_board(client, register, auth_headers, db_session, cache):
    owner = await register()
    headers = auth_headers(owner)
    response = await client.post(
        "/api/v1/plants",
        json={"name": "Board Plant", "timezone": "UTC", "is_public": True},
        headers=headers,
    )
    assert response.status_code == 201
    plant = await db_session.get(Plant, response.json()["id"])
    lines = [
        ProductionLine(plant_id=plant.id, code="L1", name="Line one"),
        ProductionLine(plant_id=plant.id, code="L2", name="Line two"),
    ]
    db_session.add_all(lines)
    await db_session.flush()
    machines = []
    for index, state in enumerate(("RUNNING", "IDLE", "DOWN", "OFFLINE")):
        machine = Machine(
            plant_id=plant.id,
            line_id=lines[0].id,
            name=f"Machine {index}",
            slug=f"machine-{index}",
            host="secret.internal",
            port=5020,
            unit_id=index + 1,
            ideal_cycle_s=30,
            is_active=index != 3,
        )
        db_session.add(machine)
        await db_session.flush()
        machines.append(machine)
        snapshot = reading(state)
        cache[f"machine:{machine.id}:snapshot"] = json.dumps(snapshot)
        db_session.add(
            MachineCheckpoint(
                machine_id=machine.id, accounted_at=NOW, snapshot=snapshot, progress={}
            )
        )
    db_session.add(
        MachineBoardPosition(
            machine_id=machines[0].id,
            x=0.1,
            y=0.2,
            width=0.2,
            height=0.1,
            rotation=90,
            updated_at=NOW,
        )
    )
    db_session.add(
        DowntimeReason(
            code="material", label_es="Sin material", label_en="No material", category="material"
        )
    )
    db_session.add(
        MachineEvent(
            machine_id=machines[2].id,
            state="DOWN",
            started_at=START,
            reason_code="material",
            comment="Waiting",
            classified_by=owner["user"]["id"],
        )
    )
    await db_session.commit()
    return dict(
        plant=plant,
        machines=machines,
        lines=lines,
        owner=owner,
        headers=headers,
        path=f"/api/v1/plants/{plant.id}/board",
    )


async def add_run(session, setup, *, started_at=START, ended_at=None, cycle=20, code="OP1"):
    plant, machine = setup["plant"], setup["machines"][0]
    product = Product(plant_id=plant.id, code="P" + code, name="Frozen product", part_weight_g=12.5)
    mold = Mold(plant_id=plant.id, code="M" + code, name="Frozen mold", nominal_cavities=4)
    resin = Resin(
        plant_id=plant.id, code="R" + code, name="Private resin", polymer="PP", grade="G1"
    )
    session.add_all([product, mold, resin])
    await session.flush()
    recipe = InjectionRecipe(
        plant_id=plant.id,
        code="RE" + code,
        name="Recipe",
        product_id=product.id,
        mold_id=mold.id,
        resin_id=resin.id,
        ideal_cycle_s=cycle,
        active_cavities=4,
    )
    session.add(recipe)
    await session.flush()
    order = ProductionOrder(
        plant_id=plant.id, code=code, recipe_id=recipe.id, target_pieces=100, status="running"
    )
    session.add(order)
    await session.flush()
    run = ProductionRun(
        plant_id=plant.id,
        machine_id=machine.id,
        order_id=order.id,
        mold_id=mold.id,
        nominal_cavities=4,
        active_cavities=4,
        ideal_cycle_s=cycle,
        part_weight_g=12.5,
        started_at=started_at,
        ended_at=ended_at,
        started_by=setup["owner"]["user"]["id"],
        context={
            "product_id": product.id,
            "product_code": product.code,
            "product_name": product.name,
            "mold_code": mold.code,
            "mold_name": mold.name,
            "resin_id": resin.id,
            "resin_name": resin.name,
        },
    )
    session.add(run)
    await session.flush()
    return run


async def test_board_counts_context_privacy_and_line_stop_preserve_observed_state(
    client,
    setup_board,
    db_session,
):
    setup = setup_board
    run = await add_run(db_session, setup)
    stop = LineDowntime(
        plant_id=setup["plant"].id,
        line_id=setup["lines"][0].id,
        reason_code="material",
        planned=True,
        comment="Manual line stop",
        started_at=START,
    )
    db_session.add(stop)
    await db_session.flush()
    db_session.add(LineDowntimeMachine(downtime_id=stop.id, machine_id=setup["machines"][0].id))
    # Current assignment may differ; historical membership must still target Machine 0.
    setup["machines"][0].line_id = setup["lines"][1].id
    await db_session.commit()
    response = await client.get(setup["path"], headers=setup["headers"])
    assert response.status_code == 200, response.text
    data = response.json()
    PlantBoard.model_validate(data)
    assert response.headers["cache-control"] == "private, no-store"
    assert data["summary"]["states"] == dict(RUNNING=1, IDLE=1, DOWN=1, OFFLINE=1)
    assert data["summary"]["machine_count"] == 4
    assert data["summary"]["active_machine_count"] == 3
    assert data["summary"]["active_runs"] == 1
    assert data["summary"]["without_active_run"] == 2
    assert data["summary"]["line_stops"] == 1
    machine = data["machines"][0]
    assert machine["snapshot"]["state"] == "RUNNING"
    assert machine["line_id"] == setup["lines"][1].id
    assert machine["position"]["rotation"] == 90
    assert machine["observed_at"] == oee.iso(NOW)
    assert machine["current_run"]["id"] == run.id
    assert machine["current_run"]["ideal_seconds_per_piece"] == 5
    assert data["machines"][1]["position"] is None
    assert data["machines"][1]["current_run"] is None
    manual = next(row for row in data["stops"] if row["kind"] == "line")
    assert manual["affected_machine_ids"] == [machine["id"]]
    assert manual["line_id"] == setup["lines"][0].id and manual["planned"] is True
    observed = next(row for row in data["stops"] if row["kind"] == "machine")
    assert observed["reason_code"] == "material" and observed["label_en"] == "No material"
    assert observed["comment"] == "Waiting" and observed["planned"] is None
    assert data["scheduled_now"] is True
    forbidden = {
        "host",
        "port",
        "unit_id",
        "email",
        "full_name",
        "classified_by",
        "started_by",
        "ended_by",
        "materials",
        "employees",
        "resin_id",
        "resin_name",
        "responsible",
        "owner",
    }

    def check(value):
        if isinstance(value, dict):
            assert not forbidden.intersection(value)
            for item in value.values():
                check(item)
        elif isinstance(value, list):
            for item in value:
                check(item)

    check(data)


async def test_board_permissions_include_viewers_and_exclude_public_visitors(
    client,
    setup_board,
    register,
    auth_headers,
    db_session,
):
    setup = setup_board
    viewer = await register("viewer")
    outsider = await register("outsider")
    db_session.add(
        PlantMember(plant_id=setup["plant"].id, user_id=viewer["user"]["id"], role="viewer")
    )
    await db_session.commit()
    assert (await client.get(setup["path"], headers=auth_headers(viewer))).status_code == 200
    assert (await client.get(setup["path"], headers=auth_headers(outsider))).status_code == 404
    assert (await client.get(setup["path"])).status_code == 401
    assert (await client.get("/api/v1/public/plants/board-plant/board")).status_code == 404


async def test_empty_board_has_no_invented_context(
    client, register, auth_headers, db_session, cache
):
    owner = await register()
    headers = auth_headers(owner)
    response = await client.post(
        "/api/v1/plants", json={"name": "Empty", "timezone": "UTC"}, headers=headers
    )
    plant_id = response.json()["id"]
    response = await client.get(f"/api/v1/plants/{plant_id}/board", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["machines"] == data["stops"] == data["lines"] == []
    assert data["summary"]["machine_count"] == data["summary"]["active_runs"] == 0
    assert data["summary"]["without_active_run"] == 0
    assert all(value is None for value in data["summary"]["oee_today"].values())


async def test_down_snapshot_without_matching_event_never_invents_reason(
    setup_board, db_session, cache
):
    setup = setup_board
    machine = setup["machines"][1]
    cache[f"machine:{machine.id}:snapshot"] = json.dumps(reading("DOWN"))
    data = await plant_board(db_session, setup["plant"], now=NOW)
    stop = next(row for row in data["stops"] if row["machine_id"] == machine.id)
    assert stop["id"] is None and stop["elapsed_s"] == 120
    for key in ("reason_code", "label_es", "label_en", "comment", "planned"):
        assert stop[key] is None


async def test_scheduled_now_uses_plant_timezone_and_overnight_shifts(setup_board, db_session):
    setup = setup_board
    setup["plant"].timezone = "America/Mexico_City"
    db_session.add(
        Shift(
            plant_id=setup["plant"].id,
            name="Monday night",
            start_time=time(22),
            end_time=time(6),
            days_of_week=[1],
        )
    )
    await db_session.commit()
    for when, expected in (
        (datetime(2026, 1, 6, 8, tzinfo=UTC), True),
        (datetime(2026, 1, 6, 12, tzinfo=UTC), False),
        (datetime(2026, 1, 5, 23, tzinfo=UTC), False),
    ):
        data = await plant_board(db_session, setup["plant"], now=when)
        assert data["scheduled_now"] is expected
        assert data["summary"]["without_active_run"] == 3


@pytest.mark.parametrize("unknown_standard", [False, True])
async def test_board_oee_matches_existing_services_with_run_changes_and_overlapping_stops(
    setup_board,
    db_session,
    cache,
    monkeypatch,
    unknown_standard,
):
    setup = setup_board
    machine = setup["machines"][0]
    boundary = START + timedelta(seconds=30 if unknown_standard else 60)
    await add_run(db_session, setup, ended_at=boundary, cycle=20, code="OLD")
    await add_run(db_session, setup, started_at=boundary, cycle=10, code="NEW")
    db_session.add_all(
        [
            MachineEvent(
                machine_id=machine.id,
                state="RUNNING",
                started_at=START,
                ended_at=START + timedelta(seconds=45),
            ),
            MachineEvent(
                machine_id=machine.id,
                state="DOWN",
                started_at=START + timedelta(seconds=45),
                ended_at=START + timedelta(seconds=60),
            ),
            MachineEvent(
                machine_id=machine.id, state="RUNNING", started_at=START + timedelta(seconds=60)
            ),
            ProductionMinute(
                machine_id=machine.id, bucket_start=START, good=6, reject=0, run_s=45, down_s=15
            ),
            ProductionMinute(
                machine_id=machine.id,
                bucket_start=START + timedelta(minutes=1),
                good=6,
                reject=0,
                run_s=60,
            ),
        ]
    )
    stop = LineDowntime(
        plant_id=setup["plant"].id,
        line_id=setup["lines"][0].id,
        reason_code="material",
        started_at=START + timedelta(seconds=30),
        ended_at=START + timedelta(seconds=75),
    )
    db_session.add(stop)
    await db_session.flush()
    db_session.add(LineDowntimeMachine(downtime_id=stop.id, machine_id=machine.id))
    await db_session.commit()
    original_window = oee.day_window
    monkeypatch.setattr(
        oee, "day_window", lambda plant, day=None: original_window(plant, day, now=NOW)
    )
    board = await plant_board(db_session, setup["plant"], now=NOW)
    expected = await oee.plant_summary(db_session, setup["plant"])
    assert board["summary"]["oee_today"] == {key: expected["plant"][key] for key in oee.METRICS}
    for row, item in zip(setup["machines"], board["machines"], strict=True):
        assert item["snapshot"] == await oee.machine_snapshot(db_session, row)
    snapshot = board["machines"][0]["snapshot"]
    if unknown_standard:
        assert snapshot["oee_today"]["performance"] is None
        assert board["summary"]["oee_today"]["oee"] is None
    else:
        assert snapshot["oee_today"]["availability"] == pytest.approx(75 / 120)
        assert snapshot["oee_today"]["performance"] == pytest.approx(45 / 75)


async def test_board_context_query_count_does_not_grow_per_machine(setup_board, db_session, cache):
    setup = setup_board
    queries = []
    engine = db_session.bind.sync_engine

    def count_queries(connection, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            queries.append(statement)

    event.listen(engine, "before_cursor_execute", count_queries)
    try:
        await plant_board(db_session, setup["plant"], now=NOW)
        first = len(queries)
        for index in range(4, 8):
            machine = Machine(
                plant_id=setup["plant"].id,
                name=f"Machine {index}",
                slug=f"machine-{index}",
                host="secret.internal",
                unit_id=index + 1,
                ideal_cycle_s=20,
            )
            db_session.add(machine)
            await db_session.flush()
            cache[f"machine:{machine.id}:snapshot"] = json.dumps(reading())
        await db_session.commit()
        queries.clear()
        await plant_board(db_session, setup["plant"], now=NOW)
        assert len(queries) == first
    finally:
        event.remove(engine, "before_cursor_execute", count_queries)


async def test_board_combines_complete_minutes_and_exact_mid_minute_mold_change(
    setup_board, db_session
):
    setup = setup_board
    machine = setup["machines"][0]
    boundary = START + timedelta(seconds=90)
    await add_run(db_session, setup, ended_at=boundary, cycle=20, code="BEFORE")
    await add_run(db_session, setup, started_at=boundary, cycle=8, code="AFTER")
    db_session.add_all(
        [
            MachineEvent(machine_id=machine.id, state="RUNNING", started_at=START),
            ProductionMinute(machine_id=machine.id, bucket_start=START, good=8, reject=0),
            ProductionMinute(
                machine_id=machine.id,
                bucket_start=START + timedelta(minutes=1),
                good=6,
                reject=0,
            ),
            *[
                ProductionSample(
                    machine_id=machine.id,
                    sampled_at=START + timedelta(seconds=second),
                    good=pieces,
                    reject=0,
                )
                for second, pieces in [(10, 8), (70, 3), (90, 3)]
            ],
        ]
    )
    await db_session.commit()
    board = await plant_board(db_session, setup["plant"], now=NOW)
    snapshot = board["machines"][0]["snapshot"]["oee_today"]
    # First eight pieces and the next three use 20/4 s; the final three use 8/4 s.
    assert snapshot["performance"] == pytest.approx((8 * 5 + 3 * 5 + 3 * 2) / 120)
    assert snapshot["availability"] == 1
    assert snapshot["quality"] == 1


def test_board_openapi_reuses_snapshot_without_public_board():
    from app.main import app

    schema = app.openapi()
    assert "/api/v1/plants/{plant_id}/board" in schema["paths"]
    machine = schema["components"]["schemas"]["BoardMachine"]["properties"]
    assert machine["snapshot"] == {"$ref": "#/components/schemas/Snapshot"}
    assert not {"host", "port", "unit_id"}.intersection(machine)
    assert not any("/public/" in path and path.endswith("/board") for path in schema["paths"])
