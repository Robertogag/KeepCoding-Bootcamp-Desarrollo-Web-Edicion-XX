"""SQLite and opt-in disposable PostgreSQL tests for SQL process aggregation.

TELEMETRY_TEST_POSTGRES_URL must point to localhost:55432/postgres, never an
application database. The fixture creates and removes only its own UUID database.
"""

import os
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import asyncpg
import pytest
from pydantic import ValidationError
from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db import Base
from app.errors import ApiError
from app.models import (
    InjectionRecipe,
    Machine,
    MachineTelemetry,
    Mold,
    Plant,
    Product,
    ProductionOrder,
    ProductionRun,
    Resin,
)
from app.schemas.telemetry import TelemetrySeriesQuery
from app.services.telemetry_series import bucket_size, telemetry_series

START = datetime(2026, 10, 21, 12, tzinfo=UTC)


@pytest.fixture(scope="module", params=["sqlite", "postgres"])
async def telemetry_engine(request, tmp_path_factory):
    admin = None
    database = None
    if request.param == "postgres":
        configured = os.getenv("TELEMETRY_TEST_POSTGRES_URL")
        if not configured:
            pytest.skip("Set TELEMETRY_TEST_POSTGRES_URL for isolated PostgreSQL JSON tests")
        admin_url = make_url(configured)
        if (
            admin_url.drivername != "postgresql+asyncpg"
            or admin_url.host not in {"127.0.0.1", "localhost"}
            or admin_url.port != 55432
            or admin_url.database != "postgres"
        ):
            pytest.fail("Telemetry tests require isolated localhost:55432/postgres")
        admin = await asyncpg.connect(
            admin_url.set(drivername="postgresql").render_as_string(hide_password=False)
        )
        database = "oee_telemetry_test_" + uuid4().hex
        await admin.execute(f'CREATE DATABASE "{database}"')
        url = admin_url.set(database=database).render_as_string(hide_password=False)
    else:
        target = tmp_path_factory.mktemp("telemetry_series") / "series.db"
        url = f"sqlite+aiosqlite:///{target}"
    engine = create_async_engine(url, poolclass=NullPool)
    try:
        if request.param == "sqlite":

            @event.listens_for(engine.sync_engine, "connect")
            def foreign_keys(connection, _):
                connection.execute("PRAGMA foreign_keys=ON")

        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        yield engine
    finally:
        await engine.dispose()
        if admin is not None:
            try:
                if database is not None:
                    await admin.execute(f'DROP DATABASE "{database}"')
            finally:
                await admin.close()


@pytest.fixture
async def telemetry_session(telemetry_engine):
    async with async_sessionmaker(telemetry_engine, expire_on_commit=False)() as session:
        yield session
        await session.rollback()


async def machine_row(session):
    plant = Plant(name="Series", slug=uuid4().hex, timezone="UTC", is_public=False)
    session.add(plant)
    await session.flush()
    machine = Machine(
        plant_id=plant.id,
        name="Test",
        slug="test",
        host="127.0.0.1",
        port=5020,
        unit_id=1,
        ideal_cycle_s=20,
    )
    session.add(machine)
    await session.flush()
    return machine


async def run_row(session, machine):
    product = Product(plant_id=machine.plant_id, code=uuid4().hex, name="Part", part_weight_g=10)
    mold = Mold(plant_id=machine.plant_id, code=uuid4().hex, name="Mold", nominal_cavities=4)
    resin = Resin(
        plant_id=machine.plant_id, code=uuid4().hex, name="Resin", polymer="PP", grade="G"
    )
    session.add_all([product, mold, resin])
    await session.flush()
    recipe = InjectionRecipe(
        plant_id=machine.plant_id,
        code=uuid4().hex,
        name="Recipe",
        product_id=product.id,
        mold_id=mold.id,
        resin_id=resin.id,
        active_cavities=4,
        ideal_cycle_s=20,
    )
    session.add(recipe)
    await session.flush()
    order = ProductionOrder(
        plant_id=machine.plant_id, code=uuid4().hex, recipe_id=recipe.id, target_pieces=100
    )
    session.add(order)
    await session.flush()
    run = ProductionRun(
        plant_id=machine.plant_id,
        machine_id=machine.id,
        mold_id=mold.id,
        order_id=order.id,
        context={},
        nominal_cavities=4,
        active_cavities=4,
        ideal_cycle_s=20,
        part_weight_g=10,
        started_at=START,
    )
    session.add(run)
    await session.flush()
    return run


def measurement(value, quality="good", unit="bar", version="v1", **extra):
    return dict(value=value, quality=quality, unit=unit, map_version=version, raw=None, **extra)


async def frames(session, machine, entries):
    for seconds, values, *run in entries:
        session.add(
            MachineTelemetry(
                machine_id=machine.id,
                sampled_at=START + timedelta(seconds=seconds),
                source="modbus",
                values=values,
                run_id=run[0] if run else None,
            )
        )
    await session.flush()


def query(seconds=30, **changes):
    values = dict(
        start=START, end=START + timedelta(seconds=seconds), codes=["pressure"], bucket_s=10
    )
    values.update(changes)
    return TelemetrySeriesQuery(**values)


async def test_sql_quality_half_open_windows_and_empty_buckets(telemetry_session):
    session = telemetry_session
    machine = await machine_row(session)
    await frames(
        session,
        machine,
        [
            (-1, {"pressure": measurement(1000)}),
            (0, {"pressure": measurement(10)}),
            (1, {"pressure": measurement(30)}),
            (2, {"pressure": measurement(900, "bad")}),
            (3, {"pressure": measurement(800, "stale")}),
            (4, {"pressure": measurement(None, "unavailable")}),
            (5, {"other": measurement(5)}),
            (30, {"pressure": measurement(2000)}),
        ],
    )
    result = await telemetry_series(session, machine.id, query())
    known = next(series for series in result.series if series.unit == "bar")
    missing = next(series for series in result.series if series.unit is None)
    first = known.points[0]
    assert (first.avg, first.min, first.max, first.first, first.last) == (20, 10, 30, 10, 30)
    assert first.first_at == START and first.last_at == START + timedelta(seconds=1)
    assert first.counts.model_dump() == dict(good=2, bad=1, stale=1, unavailable=1, missing=0)
    assert missing.points[0].counts.missing == 1 and missing.points[0].avg is None
    for point in known.points[1:]:
        assert point.avg is None and point.first is None and point.last is None
        assert sum(point.counts.model_dump().values()) == 0
    assert result.total_points == 6


async def test_units_versions_and_mapping_edits_never_mix(telemetry_session):
    session = telemetry_session
    machine = await machine_row(session)
    common = dict(
        id=1,
        address=9,
        data_type="float32",
        word_order="big",
        byte_order="big",
        scale=1,
        offset=0,
        map_version="custom-v1",
    )
    await frames(
        session,
        machine,
        [
            (0, {"pressure": measurement(10, unit="bar", version="v1")}),
            (1, {"pressure": measurement(20, unit="MPa", version="v1")}),
            (2, {"pressure": measurement(30, unit="bar", version="v2")}),
            (3, {"pressure": measurement(40, mapping=common)}),
            (4, {"pressure": measurement(50, mapping={**common, "scale": 0.1})}),
            (5, {"pressure": measurement(60, mapping=dict(reversed(list(common.items()))))}),
        ],
    )
    result = await telemetry_series(session, machine.id, query())
    assert len(result.series) == 5
    assert sorted(series.points[0].avg for series in result.series) == pytest.approx(
        [10, 20, 30, 50, 50]
    )
    configured = [series for series in result.series if series.map_version == "custom-v1"]
    assert len({series.mapping_key for series in configured}) == 2
    assert sorted(series.points[0].counts.good for series in configured) == [1, 2]


async def test_microsecond_bucket_boundaries_and_invalid_good_values(telemetry_session):
    session = telemetry_session
    machine = await machine_row(session)
    await frames(
        session,
        machine,
        [
            (9.999999, {"pressure": measurement(1)}),
            (10, {"pressure": measurement(3)}),
            (11, {"pressure": measurement("123")}),
            (12, {"pressure": measurement(None)}),
            (13, {"pressure": measurement(True)}),
        ],
    )
    result = await telemetry_series(session, machine.id, query())
    points = result.series[0].points
    assert points[0].avg == 1 and points[1].avg == 3
    assert points[1].counts.good == 1 and points[1].counts.bad == 3


async def test_finite_extreme_values_do_not_overflow_average(telemetry_session):
    session = telemetry_session
    machine = await machine_row(session)
    await frames(
        session,
        machine,
        [(0, {"pressure": measurement(1e308)}), (1, {"pressure": measurement(1e308)})],
    )
    result = await telemetry_series(session, machine.id, query())
    assert result.series[0].points[0].avg == pytest.approx(1e308)


async def test_run_filter_is_applied_before_sql_aggregation(telemetry_session):
    session = telemetry_session
    machine = await machine_row(session)
    run = await run_row(session, machine)
    await frames(
        session,
        machine,
        [(0, {"pressure": measurement(5)}, run.id), (1, {"pressure": measurement(100)})],
    )
    result = await telemetry_series(session, machine.id, query(run_id=run.id))
    assert result.series[0].points[0].avg == 5
    assert result.series[0].points[0].counts.good == 1


async def test_total_response_limit_is_explicit_not_truncation(telemetry_session):
    session = telemetry_session
    machine = await machine_row(session)
    await frames(
        session,
        machine,
        [(second, {"pressure": measurement(second, version=f"v{second}")}) for second in range(13)],
    )
    with pytest.raises(ApiError) as error:
        await telemetry_series(
            session, machine.id, query(seconds=2000, max_points=2000, bucket_s=1)
        )
    assert error.value.status_code == 422 and error.value.field == "max_points"


async def test_no_data_is_explicit_null_series_and_no_fake_samples(telemetry_session):
    machine = await machine_row(telemetry_session)
    result = await telemetry_series(
        telemetry_session, machine.id, query(codes=["pressure", "temperature"])
    )
    assert [series.code for series in result.series] == ["pressure", "temperature"]
    assert all(series.unit is None and series.map_version is None for series in result.series)
    assert all(
        point.avg is None and sum(point.counts.model_dump().values()) == 0
        for series in result.series
        for point in series.points
    )


def test_friendly_bucket_guarantees_max_points_and_validates_explicit_width():
    filters = query(seconds=31 * 86400, bucket_s=None, max_points=600)
    width, count = bucket_size(filters)
    assert width > 0 and count <= 600
    with pytest.raises(ApiError) as error:
        bucket_size(query(seconds=11, bucket_s=1, max_points=10))
    assert error.value.field == "bucket_s"


@pytest.mark.parametrize(
    "changes",
    [
        {"start": datetime(2026, 10, 21)},
        {"end": START},
        {"end": START + timedelta(days=31, microseconds=1)},
        {"max_points": 9},
        {"max_points": 2001},
        {"codes": []},
        {"codes": ["a"] * 13},
        {"codes": ["a", "a"]},
        {"codes": ["pressure' OR 1=1"]},
    ],
)
def test_query_limits(changes):
    with pytest.raises(ValidationError):
        query(**changes)


@pytest.fixture
async def api_machine(client, register, auth_headers, db_session):
    owner = await register()
    headers = auth_headers(owner)
    plant_response = await client.post(
        "/api/v1/plants", headers=headers, json={"name": "Telemetry", "timezone": "UTC"}
    )
    plant = plant_response.json()
    response = await client.post(
        f"/api/v1/plants/{plant['id']}/machines",
        headers=headers,
        json={
            "name": "Injection",
            "host": "127.0.0.1",
            "port": 5020,
            "unit_id": 1,
            "ideal_cycle_s": 20,
        },
    )
    assert response.status_code == 201, response.text
    machine = await db_session.get(Machine, response.json()["id"])
    return machine, headers


def api_params(**extra):
    return {
        "from": START.isoformat(),
        "to": (START + timedelta(seconds=30)).isoformat(),
        "codes": ["pressure", "temperature"],
        "bucket_s": 10,
        **extra,
    }


async def test_api_repeated_codes_typed_response_and_tenant_permissions(
    client, register, auth_headers, api_machine, db_session
):
    machine, headers = api_machine
    await frames(db_session, machine, [(0, {"pressure": measurement(10)})])
    path = f"/api/v1/machines/{machine.id}/telemetry/series"
    response = await client.get(path, headers=headers, params=api_params())
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["requested_codes"] == ["pressure", "temperature"]
    assert payload["from"].endswith("Z") and payload["bucket_s"] == 10
    assert payload["max_points"] == 600 and payload["total_points"] == 6
    assert (await client.get(path, params=api_params())).status_code == 401
    outsider = await register("outsider")
    assert (
        await client.get(path, headers=auth_headers(outsider), params=api_params())
    ).status_code == 404


async def test_api_run_id_must_belong_to_requested_machine(client, api_machine, db_session):
    machine, headers = api_machine
    run = await run_row(db_session, machine)
    other_machine = await machine_row(db_session)
    other_run = await run_row(db_session, other_machine)
    await frames(
        db_session,
        machine,
        [(0, {"pressure": measurement(5)}, run.id), (1, {"pressure": measurement(100)})],
    )
    path = f"/api/v1/machines/{machine.id}/telemetry/series"
    response = await client.get(path, headers=headers, params=api_params(run_id=run.id))
    assert response.status_code == 200, response.text
    assert response.json()["series"][0]["points"][0]["avg"] == 5
    for run_id in (other_run.id, 999999):
        assert (
            await client.get(path, headers=headers, params=api_params(run_id=run_id))
        ).status_code == 404


async def test_api_bad_ranges_and_excess_points_return_validation_error(client, api_machine):
    machine, headers = api_machine
    path = f"/api/v1/machines/{machine.id}/telemetry/series"
    for changes in (
        {"from": "2026-10-21T12:00:00"},
        {"max_points": 9},
        {"max_points": 10, "bucket_s": 1},
        {"codes": "pressure,temperature"},
    ):
        response = await client.get(path, headers=headers, params=api_params(**changes))
        assert response.status_code == 422, response.text
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
