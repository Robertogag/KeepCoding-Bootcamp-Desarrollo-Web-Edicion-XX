import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import asyncpg
import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import delete, event, func, select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.api.layout import router
from app.db import Base, get_session
from app.errors import install_error_handlers
from app.models import Machine, MachineBoardPosition, Plant, PlantMember, User
from app.services.auth import issue_access_token

BACKEND = Path(__file__).resolve().parents[1]


async def migrate(url, *arguments):
    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "alembic",
        *arguments,
        cwd=BACKEND,
        env={**os.environ, "ENVIRONMENT": "test", "DATABASE_URL": url},
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    output, _ = await process.communicate()
    assert process.returncode == 0, output.decode(errors="replace")


@pytest.fixture(scope="module", params=["sqlite", "postgres"])
async def layout_engine(request, tmp_path_factory):
    admin = None
    database = None
    if request.param == "postgres":
        configured = os.getenv("LAYOUT_TEST_POSTGRES_URL")
        if not configured:
            pytest.skip("Set LAYOUT_TEST_POSTGRES_URL for isolated PostgreSQL constraint checks")
        target = make_url(configured)
        if (
            target.drivername != "postgresql+asyncpg"
            or target.host not in {"localhost", "127.0.0.1"}
            or target.port != 55432
            or target.database != "postgres"
        ):
            pytest.fail("Layout tests require the isolated localhost:55432/postgres instance")
        admin = await asyncpg.connect(
            target.set(drivername="postgresql").render_as_string(hide_password=False)
        )
        database = "oee_layout_test_" + uuid4().hex
        await admin.execute(f'CREATE DATABASE "{database}"')
        url = target.set(database=database).render_as_string(hide_password=False)
    else:
        path = tmp_path_factory.mktemp("layout") / "layout.sqlite"
        url = f"sqlite+aiosqlite:///{path}"
    engine = create_async_engine(url, poolclass=NullPool)
    try:
        if admin is not None:
            await migrate(url, "upgrade", "0004_injection_context")
            await migrate(url, "upgrade", "head")
            await migrate(url, "check")
        else:

            @event.listens_for(engine.sync_engine, "connect")
            def foreign_keys(connection, _):
                connection.execute("PRAGMA foreign_keys=ON")

            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
        yield engine
        if admin is not None:
            async with engine.connect() as connection:
                count_before = await connection.scalar(select(func.count()).select_from(Machine))
            await migrate(url, "downgrade", "0004_injection_context")
            await migrate(url, "upgrade", "head")
            await migrate(url, "check")
            async with engine.connect() as connection:
                assert (
                    await connection.scalar(select(func.count()).select_from(Machine))
                    == count_before
                )
    finally:
        await engine.dispose()
        if admin is not None:
            try:
                if database is not None:
                    await admin.execute(f'DROP DATABASE "{database}" WITH (FORCE)')
            finally:
                await admin.close()


@pytest.fixture
async def layout_case(layout_engine):
    factory = async_sessionmaker(layout_engine, expire_on_commit=False)
    token = uuid4().hex[:10]
    async with factory() as session:
        users = {
            role: User(
                username=f"{role}-{token}",
                email=f"{role}-{token}@example.com",
                full_name=role,
                password_hash="test-only",
            )
            for role in ("owner", "supervisor", "viewer", "outsider")
        }
        plants = [
            Plant(name="Layout", slug="layout-" + token, timezone="UTC", is_public=True),
            Plant(name="Other", slug="other-" + token, timezone="UTC"),
        ]
        session.add_all([*users.values(), *plants])
        await session.flush()
        for role in ("owner", "supervisor", "viewer"):
            session.add(PlantMember(plant_id=plants[0].id, user_id=users[role].id, role=role))
        session.add(PlantMember(plant_id=plants[1].id, user_id=users["owner"].id, role="owner"))
        machines = [
            Machine(
                plant_id=plants[index // 2].id,
                name=f"Machine {index}",
                slug=f"machine-{index}",
                host="localhost",
                ideal_cycle_s=20,
            )
            for index in range(3)
        ]
        session.add_all(machines)
        await session.commit()
        headers = {
            role: {"Authorization": "Bearer " + issue_access_token(user)}
            for role, user in users.items()
        }
        primary, secondary = (plant.id for plant in plants)
        machine_ids = [machine.id for machine in machines]
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(router, prefix="/api/v1")

    async def override():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="https://test"
    ) as client:
        yield SimpleNamespace(
            client=client,
            factory=factory,
            engine=layout_engine,
            headers=headers,
            plant_id=primary,
            other_plant_id=secondary,
            machines=machine_ids,
            path=f"/api/v1/plants/{primary}/layout",
            other_path=f"/api/v1/plants/{secondary}/layout",
        )


def position(identifier, **changes):
    return {
        "machine_id": identifier,
        "x": 0.1,
        "y": 0.2,
        "width": 0.2,
        "height": 0.3,
        "rotation": 0,
        **changes,
    }


async def save(case, positions, *, path=None, actor="owner"):
    return await case.client.put(
        path or case.path, json={"positions": positions}, headers=case.headers[actor]
    )


async def read(case, *, path=None, actor="owner"):
    return await case.client.get(path or case.path, headers=case.headers[actor])


async def test_empty_layout_replace_order_and_reset_are_plant_scoped(layout_case):
    case = layout_case
    assert (await read(case)).json() == {"plant_id": case.plant_id, "positions": []}
    response = await save(
        case, [position(case.machines[1], rotation=270), position(case.machines[0])]
    )
    assert response.status_code == 200, response.text
    rows = response.json()["positions"]
    assert [row["machine_id"] for row in rows] == case.machines[:2]
    assert all(
        datetime.fromisoformat(row["updated_at"]).utcoffset().total_seconds() == 0 for row in rows
    )
    assert rows == (await read(case)).json()["positions"]
    other = await save(case, [position(case.machines[2])], path=case.other_path)
    response = await save(case, [position(case.machines[0], x=0.5, rotation=90)])
    assert response.status_code == 200 and len(response.json()["positions"]) == 1
    assert response.json()["positions"][0]["x"] == 0.5
    response = await save(case, [])
    assert response.status_code == 200 and response.json()["positions"] == []
    assert (await read(case, path=case.other_path)).json() == other.json()


async def test_layout_requires_membership_and_write_roles_even_for_public_plant(layout_case):
    case = layout_case
    for actor in ("owner", "supervisor", "viewer"):
        assert (await read(case, actor=actor)).status_code == 200
    assert (await read(case, actor="outsider")).status_code == 404
    assert (await case.client.get(case.path)).status_code == 401
    for actor, status in (("owner", 200), ("supervisor", 200), ("viewer", 403), ("outsider", 404)):
        response = await save(case, [position(case.machines[0])], actor=actor)
        assert response.status_code == status, response.text
    assert (await case.client.put(case.path, json={"positions": []})).status_code == 401
    assert len((await read(case)).json()["positions"]) == 1


@pytest.mark.parametrize("invalid", ["duplicate", "foreign", "missing"])
async def test_invalid_machine_ids_leave_existing_positions_unchanged(layout_case, invalid):
    case = layout_case
    before = await save(case, [position(case.machines[0])])
    wrong_id = (
        case.machines[0]
        if invalid == "duplicate"
        else case.machines[2]
        if invalid == "foreign"
        else 2_000_000_000
    )
    response = await save(case, [position(case.machines[0], x=0.4), position(wrong_id)])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert (await read(case)).json() == before.json()


@pytest.mark.parametrize(
    "changes",
    [
        {"x": -0.1},
        {"y": 1.1},
        {"width": 0},
        {"height": -0.1},
        {"x": 0.9, "width": 0.2},
        {"y": 0.8, "height": 0.3},
        {"rotation": 45},
        {"rotation": True},
        {"machine_id": True},
        {"x": "0.2"},
        {"x": float("nan")},
        {"width": float("inf")},
        {"updated_at": "2026-10-01T00:00:00Z"},
    ],
)
async def test_layout_rejects_invalid_bounds_numbers_and_extra_fields(layout_case, changes):
    case = layout_case
    response = await case.client.put(
        case.path,
        content=json.dumps({"positions": [position(case.machines[0], **changes)]}),
        headers={**case.headers["owner"], "Content-Type": "application/json"},
    )
    assert response.status_code == 422, response.text
    assert (await read(case)).json()["positions"] == []


async def test_database_enforces_geometry_and_cascades_machine_and_plant(layout_case):
    case = layout_case
    async with case.factory() as session:
        for changes in ({"x": -1}, {"width": 0}, {"x": 0.9}, {"rotation": 45}):
            with pytest.raises(IntegrityError):
                async with session.begin_nested():
                    session.add(MachineBoardPosition(**position(case.machines[0], **changes)))
                    await session.flush()
    await save(case, [position(identifier) for identifier in case.machines[:2]])
    other = await save(case, [position(case.machines[2])], path=case.other_path)
    async with case.factory() as session:
        await session.execute(delete(Machine).where(Machine.id == case.machines[0]))
        await session.commit()
        assert await session.get(MachineBoardPosition, case.machines[0]) is None
        assert await session.get(MachineBoardPosition, case.machines[1]) is not None
        await session.execute(delete(Plant).where(Plant.id == case.plant_id))
        await session.commit()
        session.expire_all()
        assert await session.get(MachineBoardPosition, case.machines[1]) is None
    assert (await read(case, path=case.other_path)).json() == other.json()


async def test_concurrent_replacements_never_merge_two_layouts(layout_case):
    case = layout_case
    if case.engine.dialect.name != "postgresql":
        pytest.skip("Concurrent row locking is checked on PostgreSQL")
    layouts = [
        [position(case.machines[0], x=0.0), position(case.machines[1], x=0.3)],
        [position(case.machines[0], y=0.0), position(case.machines[1], y=0.5)],
    ]
    async with asyncio.timeout(10):
        responses = await asyncio.gather(*(save(case, rows) for rows in layouts))
    assert all(response.status_code == 200 for response in responses)
    final = (await read(case)).json()["positions"]
    assert [
        {key: value for key, value in row.items() if key != "updated_at"} for row in final
    ] in layouts
