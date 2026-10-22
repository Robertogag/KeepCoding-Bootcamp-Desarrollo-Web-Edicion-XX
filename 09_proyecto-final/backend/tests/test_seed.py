from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models import (
    DowntimeReason,
    InjectionRecipe,
    Machine,
    MachineEvent,
    MachineTelemetry,
    MachineVariable,
    Mold,
    Plant,
    ProductionLine,
    ProductionMinute,
    ProductionOrder,
    ProductionRun,
    ProductionSample,
    Resin,
    Shift,
    User,
)
from app.seed import historical_rows, seed
from app.services.auth import verify_password


async def test_seed_generates_consistent_history_and_is_idempotent(db_session):
    instant = datetime(2026, 10, 21, 18, tzinfo=UTC)
    result = await seed(db_session, days=1, now=instant)
    assert result["history_machines_created"] == 8
    assert result["injection_runs_created"] == 8
    assert await db_session.scalar(select(func.count()).select_from(MachineVariable)) == 96
    assert await db_session.scalar(select(func.count()).select_from(MachineTelemetry)) == 0
    runs = list(await db_session.scalars(select(ProductionRun)))
    expected_cavities = {1: 4, 2: 2, 3: 1, 4: 4, 5: 2, 6: 1, 7: 4, 8: 2}
    actual_cavities = {}
    for run in runs:
        machine = await db_session.get(Machine, run.machine_id)
        order = await db_session.get(ProductionOrder, run.order_id)
        recipe = await db_session.get(InjectionRecipe, order.recipe_id)
        mold = await db_session.get(Mold, run.mold_id)
        cavities = expected_cavities[machine.unit_id]
        assert run.active_cavities == recipe.active_cavities == mold.nominal_cavities == cavities
        assert recipe.mold_id == run.mold_id and run.context["recipe_id"] == recipe.id
        assert run.ideal_cycle_s == recipe.ideal_cycle_s == machine.ideal_cycle_s
        assert run.started_at == instant
        actual_cavities[machine.unit_id] = run.active_cavities
    assert actual_cavities == expected_cavities
    assert all(run.context["counter_unit"] == "pieces" for run in runs)
    assert all(run.context["mold_name"].startswith("DEMO - Molde ") for run in runs)
    assert all(run.context["resin_name"] == "DEMO - Polipropileno" for run in runs)
    assert all(run.context["line_name"].startswith("DEMO - Linea de inyeccion ") for run in runs)
    assert await db_session.scalar(select(func.count()).select_from(Machine)) == 8
    assert await db_session.scalar(select(func.count()).select_from(Shift)) == 3
    assert await db_session.scalar(select(func.count()).select_from(DowntimeReason)) == 12
    assert (await db_session.get(DowntimeReason, "1")).label_es == "Falla mecánica"
    assert await db_session.scalar(select(func.count()).select_from(ProductionMinute)) == 8 * 1440
    account = await db_session.scalar(select(User).where(User.username == "demo"))
    assert verify_password(account.password_hash, "Demo1234!")
    before = await db_session.scalar(select(func.count()).select_from(ProductionSample))
    count_minutes = await db_session.execute(
        select(func.sum(ProductionMinute.good), func.sum(ProductionMinute.reject))
    )
    count_samples = await db_session.execute(
        select(func.sum(ProductionSample.good), func.sum(ProductionSample.reject))
    )
    assert count_minutes.one() == count_samples.one()
    assert await db_session.scalar(select(func.max(MachineEvent.ended_at))) == instant
    plant = await db_session.get(Plant, result["plant_id"])
    plant.name = "User-customized demo"
    await db_session.commit()
    repeated = await seed(db_session, days=1, now=instant)
    assert repeated["history_machines_created"] == 0
    assert repeated["injection_runs_created"] == 0
    assert plant.name == "User-customized demo"
    assert await db_session.scalar(select(func.count()).select_from(ProductionSample)) == before


async def test_seed_reuses_legacy_unit_without_replacing_custom_settings_or_closed_run(db_session):
    instant = datetime(2026, 10, 21, 18, tzinfo=UTC)
    await seed(db_session, days=0, now=instant)
    machine = await db_session.scalar(select(Machine).where(Machine.unit_id == 3))
    machine.slug, machine.name, machine.host = "prensa-01", "Prensa personalizada", "192.0.2.20"
    machine.port = 1502
    variable = await db_session.scalar(
        select(MachineVariable).where(
            MachineVariable.machine_id == machine.id, MachineVariable.code == "filling_time_s"
        )
    )
    variable.address, variable.scale, variable.map_version = 200, 0.01, "custom-v2"
    run = await db_session.scalar(
        select(ProductionRun).where(ProductionRun.machine_id == machine.id)
    )

    run.ended_at = instant + timedelta(seconds=1)
    await db_session.commit()
    result = await seed(db_session, days=0, now=instant + timedelta(hours=1))
    assert result["injection_runs_created"] == 0
    assert await db_session.scalar(select(func.count()).select_from(Machine)) == 8
    assert machine.name == "Prensa personalizada" and machine.host == "192.0.2.20"
    assert machine.port == 1502
    assert (
        variable.address == 200 and variable.scale == 0.01 and variable.map_version == "custom-v2"
    )
    assert run.ended_at == instant + timedelta(seconds=1)
    assert await db_session.scalar(select(func.count()).select_from(Mold)) == 8


async def test_seed_renames_only_known_legacy_demo_names_without_changing_identity(db_session):
    instant = datetime(2026, 10, 21, 18, tzinfo=UTC)
    await seed(db_session, days=0, now=instant)
    machine = await db_session.scalar(select(Machine).where(Machine.unit_id == 8))
    machine.slug, machine.name, machine.host = "cnc-01", "CNC 01", "127.0.0.1"
    machine.ideal_cycle_s = 77
    original_id = machine.id
    await db_session.commit()
    await seed(db_session, days=0, now=instant)
    assert machine.id == original_id and machine.slug == "cnc-01"
    assert machine.name == "Inyectora 08" and machine.host == "127.0.0.1"
    assert machine.ideal_cycle_s == 77
    assert await db_session.scalar(select(func.count()).select_from(Machine)) == 8


async def test_seed_dry_run_rolls_back_configuration(db_session):
    result = await seed(db_session, days=0, dry_run=True)
    assert result["dry_run"] and result["injection_runs_created"] == 8
    for model in (Machine, Plant, ProductionRun, MachineVariable):
        assert await db_session.scalar(select(func.count()).select_from(model)) == 0


async def test_seed_preserves_inactive_catalog_and_freezes_actual_assigned_line(db_session):
    instant = datetime(2026, 10, 21, 18, tzinfo=UTC)
    await seed(db_session, days=0, now=instant)
    machine = await db_session.scalar(select(Machine).where(Machine.unit_id == 1))
    run = await db_session.scalar(
        select(ProductionRun).where(ProductionRun.machine_id == machine.id)
    )
    order = await db_session.get(ProductionOrder, run.order_id)
    recipe = await db_session.get(InjectionRecipe, order.recipe_id)
    resin = await db_session.get(Resin, recipe.resin_id)
    await db_session.delete(run)
    order.status, resin.is_active = "planned", False
    custom_line = ProductionLine(
        plant_id=machine.plant_id, code="CUSTOM", name="Linea personalizada"
    )
    db_session.add(custom_line)
    await db_session.flush()
    machine.line_id = custom_line.id
    await db_session.commit()
    result = await seed(db_session, days=0, now=instant)
    assert result["injection_runs_created"] == 0 and not resin.is_active
    resin.is_active = True
    await db_session.commit()
    result = await seed(db_session, days=0, now=instant)
    assert result["injection_runs_created"] == 1
    run = await db_session.scalar(
        select(ProductionRun).where(ProductionRun.machine_id == machine.id)
    )
    assert run.context["line_id"] == custom_line.id and run.context["line_code"] == "CUSTOM"
    assert run.context["line_name"] == "Linea personalizada"
    frozen_context = dict(run.context)
    custom_line.name = "Nombre posterior"
    resin.name = "Resina posterior"
    mold = await db_session.get(Mold, run.mold_id)
    mold.name = "Molde posterior"
    await db_session.commit()
    await seed(db_session, days=0, now=instant + timedelta(hours=1))
    assert run.context == frozen_context


def test_new_history_preserves_legacy_single_cavity_standard_before_injection_run():
    profile = dict(
        unit_id=1,
        ideal_cycle_s=1,
        cycle_jitter=0,
        scrap_rate=0,
        mtbf_min=1e20,
        mttr_min=1,
        micro_stop_prob=0,
        idle_prob=0,
        active_cavities=4,
    )
    start = datetime(2026, 10, 21, 18, tzinfo=UTC)
    minutes, samples, _ = historical_rows(1, profile, start, start + timedelta(seconds=3.1))
    assert sum(row["good"] for row in samples) == 3
    assert all(row["good"] == 1 for row in samples)
    from app.services.oee import ratios

    run_s = sum(row["run_s"] for row in minutes)
    assert ratios(1, 3, 0, run_s, run_s)["performance"] == pytest.approx(3 / 3.1)
