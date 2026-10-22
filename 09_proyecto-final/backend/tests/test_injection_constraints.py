import asyncio
import os
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import asyncpg
import pytest
from sqlalchemy import delete, event, select
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db import Base
from app.models import (
    DowntimeReason,
    Employee,
    InjectionRecipe,
    LineDowntime,
    LineDowntimeMachine,
    Machine,
    MachineTelemetry,
    MachineVariable,
    Mold,
    Plant,
    Product,
    ProductionLine,
    ProductionOrder,
    ProductionRun,
    Resin,
    ResinLot,
    RunEmployee,
    RunMaterial,
)

BACKEND = Path(__file__).resolve().parents[1]


async def alembic(url, *arguments):
    environment = {
        **os.environ,
        "ENVIRONMENT": "test",
        "DATABASE_URL": url,
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "alembic",
        *arguments,
        cwd=BACKEND,
        env=environment,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    output, _ = await process.communicate()
    assert process.returncode == 0, output.decode(errors="replace")


@pytest.fixture(scope="module", params=["sqlite", "postgres"])
async def constraint_engine(request, tmp_path_factory):
    admin = None
    database = None
    if request.param == "postgres":
        configured = os.getenv("INJECTION_TEST_POSTGRES_URL")
        if not configured:
            pytest.skip("Set INJECTION_TEST_POSTGRES_URL to an isolated local PostgreSQL admin DB")
        admin_url = make_url(configured)
        if (
            admin_url.drivername != "postgresql+asyncpg"
            or admin_url.host not in {"127.0.0.1", "localhost"}
            or admin_url.port != 55432
            or admin_url.database != "postgres"
        ):
            pytest.fail("Constraint tests require the isolated localhost:55432/postgres instance")
        admin = await asyncpg.connect(
            admin_url.set(drivername="postgresql").render_as_string(hide_password=False)
        )
        database = "oee_injection_test_" + uuid4().hex
        await admin.execute(f'CREATE DATABASE "{database}"')
        url = admin_url.set(database=database).render_as_string(hide_password=False)
    else:
        target = tmp_path_factory.mktemp("injection_constraints") / "test.sqlite"
        url = f"sqlite+aiosqlite:///{target}"
    engine = create_async_engine(url, poolclass=NullPool)
    try:
        if request.param == "postgres":
            await alembic(url, "upgrade", "head")
            await alembic(url, "check")
        else:

            @event.listens_for(engine.sync_engine, "connect")
            def foreign_keys(connection, _):
                connection.execute("PRAGMA foreign_keys=ON")

            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
        yield engine
        if request.param == "postgres":
            await alembic(url, "downgrade", "0003_machine_checkpoints")
            await alembic(url, "upgrade", "head")
            await alembic(url, "check")
    finally:
        await engine.dispose()
        if admin is not None:
            try:
                if database is not None:
                    await admin.execute(f'DROP DATABASE "{database}" WITH (FORCE)')
            finally:
                await admin.close()


@pytest.fixture
async def constraint_session(constraint_engine):
    async with async_sessionmaker(constraint_engine, expire_on_commit=False)() as session:
        yield session


async def graph(session):
    async def save(row):
        session.add(row)
        await session.flush()
        return row

    token = uuid4().hex[:10]
    now = datetime.now(UTC)
    plant = await save(Plant(name="Injection", slug="injection-" + token, timezone="UTC"))
    scope = {"plant_id": plant.id}
    line = await save(ProductionLine(**scope, code="L1", name="Line"))
    product = await save(Product(**scope, code="P1", name="Part", part_weight_g=Decimal("12.5")))
    mold = await save(Mold(**scope, code="M1", name="Mold", nominal_cavities=4))
    resin = await save(Resin(**scope, code="R1", name="Resin", polymer="PP", grade="G1"))
    recipe = await save(
        InjectionRecipe(
            **scope,
            code="I1",
            name="Recipe",
            product_id=product.id,
            mold_id=mold.id,
            resin_id=resin.id,
            ideal_cycle_s=20,
            active_cavities=4,
        )
    )
    order = await save(ProductionOrder(**scope, code="O1", recipe_id=recipe.id, target_pieces=100))
    machines = []
    for number in (1, 2):
        machines.append(
            await save(
                Machine(
                    **scope,
                    line_id=line.id,
                    slug=f"machine-{number}",
                    name=f"Machine {number}",
                    host="127.0.0.1",
                    port=5020,
                    unit_id=number,
                    ideal_cycle_s=20,
                )
            )
        )
    machine, other = machines
    run = await save(
        ProductionRun(
            **scope,
            order_id=order.id,
            machine_id=machine.id,
            mold_id=mold.id,
            context={"resin_id": resin.id},
            nominal_cavities=4,
            active_cavities=4,
            ideal_cycle_s=20,
            part_weight_g=Decimal("12.5"),
            started_at=now,
            ended_at=now + timedelta(seconds=10),
        )
    )
    lot = await save(ResinLot(**scope, resin_id=resin.id, lot_code="LOT1", received_kg=25))
    material = await save(RunMaterial(**scope, run_id=run.id, resin_lot_id=lot.id, consumed_kg=5))
    employee = await save(Employee(**scope, code="E1", name="Operator"))
    assignment = await save(
        RunEmployee(
            **scope,
            run_id=run.id,
            employee_id=employee.id,
            role="operator",
            started_at=now,
        )
    )
    reason = await save(
        DowntimeReason(
            code="reason-" + token, label_es="Material", label_en="Material", category="material"
        )
    )
    downtime = await save(
        LineDowntime(**scope, line_id=line.id, reason_code=reason.code, started_at=now)
    )
    for row in machines:
        await save(LineDowntimeMachine(downtime_id=downtime.id, machine_id=row.id))
        await save(
            MachineTelemetry(
                machine_id=row.id,
                sampled_at=now,
                run_id=run.id if row.id == machine.id else None,
                values={"pressure": {"value": 100, "quality": "good", "unit": "bar"}},
            )
        )
    variable = await save(
        MachineVariable(
            machine_id=machine.id,
            code="pressure",
            name="Pressure",
            unit="bar",
            address=100,
            data_type="uint16",
        )
    )
    await session.commit()
    return locals()


async def test_delete_machine_cascades_only_its_history(constraint_session):
    session = constraint_session
    data = await graph(session)
    await session.execute(delete(Machine).where(Machine.id == data["machine"].id))
    await session.commit()
    session.expunge_all()
    for key in ("machine", "run", "material", "assignment", "variable"):
        row = data[key]
        assert await session.get(type(row), row.id) is None
    for key in (
        "plant",
        "line",
        "product",
        "mold",
        "resin",
        "recipe",
        "order",
        "lot",
        "employee",
        "downtime",
        "other",
    ):
        row = data[key]
        assert await session.get(type(row), row.id) is not None
    assert await session.get(MachineTelemetry, (data["machine"].id, data["now"])) is None
    assert await session.get(MachineTelemetry, (data["other"].id, data["now"])) is not None
    assert await session.get(LineDowntimeMachine, (data["downtime"].id, data["machine"].id)) is None
    assert (
        await session.get(LineDowntimeMachine, (data["downtime"].id, data["other"].id)) is not None
    )


async def test_delete_plant_cascades_complete_injection_graph(constraint_session):
    session = constraint_session
    data = await graph(session)
    other = Plant(name="Other", slug="other-" + uuid4().hex[:10], timezone="UTC")
    session.add(other)
    await session.commit()
    await session.execute(delete(Plant).where(Plant.id == data["plant"].id))
    await session.commit()
    session.expunge_all()
    for key in (
        "plant",
        "line",
        "product",
        "mold",
        "resin",
        "recipe",
        "order",
        "lot",
        "employee",
        "downtime",
        "machine",
        "other",
        "run",
        "material",
        "assignment",
        "variable",
    ):
        row = data[key]
        assert await session.get(type(row), row.id) is None
    assert await session.get(MachineTelemetry, (data["machine"].id, data["now"])) is None
    assert await session.get(LineDowntimeMachine, (data["downtime"].id, data["machine"].id)) is None
    assert await session.get(DowntimeReason, data["reason"].code) is not None
    assert await session.get(Plant, other.id) is not None


async def test_referenced_catalogs_cannot_be_deleted_individually(constraint_session):
    session = constraint_session
    data = await graph(session)
    for key in ("line", "product", "mold", "resin", "recipe", "order", "lot", "employee"):
        row = data[key]
        with pytest.raises(IntegrityError):
            async with session.begin_nested():
                await session.execute(delete(type(row)).where(type(row).id == row.id))


async def test_recipe_cannot_reference_a_product_in_another_plant(constraint_session):
    session = constraint_session
    data = await graph(session)
    other = Plant(name="Other", slug="other-" + uuid4().hex[:10], timezone="UTC")
    session.add(other)
    await session.flush()
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(
                InjectionRecipe(
                    plant_id=other.id,
                    code="CROSS",
                    name="Cross plant",
                    product_id=data["product"].id,
                    mold_id=data["mold"].id,
                    resin_id=data["resin"].id,
                    ideal_cycle_s=20,
                    active_cavities=4,
                )
            )
            await session.flush()


async def test_downtime_membership_is_preserved_after_machine_moves(constraint_session):
    session = constraint_session
    data = await graph(session)
    data["machine"].line_id = None
    data["machine"].is_active = False
    await session.commit()
    affected = set(
        await session.scalars(
            select(LineDowntimeMachine.machine_id).where(
                LineDowntimeMachine.downtime_id == data["downtime"].id
            )
        )
    )
    assert affected == {data["machine"].id, data["other"].id}
    await session.execute(delete(LineDowntime).where(LineDowntime.id == data["downtime"].id))
    await session.commit()
    assert (
        list(
            await session.scalars(
                select(LineDowntimeMachine).where(
                    LineDowntimeMachine.downtime_id == data["downtime"].id
                )
            )
        )
        == []
    )
