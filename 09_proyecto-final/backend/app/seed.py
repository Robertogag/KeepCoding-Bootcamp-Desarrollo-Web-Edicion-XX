"""Idempotent demo setup. Run after migrations with ``python -m app.seed``."""

import argparse
import asyncio
import logging
import os
import random
from datetime import UTC, datetime, time, timedelta
from pathlib import Path

import yaml
from sqlalchemy import insert, select, text

from app.config import settings
from app.db import SessionLocal
from app.models import (
    DowntimeReason,
    InjectionRecipe,
    Machine,
    MachineEvent,
    MachineVariable,
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
    ResinLot,
    Shift,
    User,
)
from app.schemas.common import slugify
from app.services.auth import hash_password

REASONS = [
    ("1", "Falla mecánica", "Mechanical failure", "mecanica"),
    ("2", "Falla eléctrica", "Electrical failure", "electrica"),
    ("3", "Falta de material", "Material shortage", "material"),
    ("4", "Ajuste de calidad", "Quality adjustment", "calidad"),
    ("5", "Cambio de modelo", "Product changeover", "organizacional"),
    ("6", "Mantenimiento", "Maintenance", "mecanica"),
    ("7", "Cambio de herramienta", "Tool change", "mecanica"),
    ("8", "Falla de sensor", "Sensor failure", "electrica"),
    ("9", "Material defectuoso", "Defective material", "material"),
    ("10", "Inspección de calidad", "Quality inspection", "calidad"),
    ("11", "Falta de operador", "Operator unavailable", "organizacional"),
    ("12", "Otro paro", "Other downtime", "otro"),
]
LEGACY_DEMO_NAMES = {
    1: "Inyectora 01",
    2: "Inyectora 02",
    3: "Prensa 01",
    4: "Prensa 02",
    5: "Ensamble 01",
    6: "Ensamble 02",
    7: "Empaque 01",
    8: "CNC 01",
}


def profiles_path(config_path=None):
    if config_path:
        return Path(config_path)
    configured = os.environ.get("SIMULATOR_CONFIG")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[2] / "simulator" / "machines.yaml"


def historical_rows(machine_id, profile, start, end):
    """Generate actual cycle timestamps plus matching minute totals and state intervals.

    Uses the simulator's Gaussian cycle jitter, exponential failures/repairs,
    per-cycle scrap, micro-stop and idle probabilities. Event-driven generation
    avoids replaying seven days at the live simulator's 100 ms resolution.

    This legacy history deliberately uses one piece per shot, matching the
    pre-injection machine ideal cycle. New four-cavity context starts only now;
    existing historical counters and standards are never reinterpreted.
    """
    rng = random.Random(42 + profile["unit_id"])
    minutes = {}
    samples = []
    events = []

    def minute(instant):
        key = instant.replace(second=0, microsecond=0)
        if key not in minutes:
            minutes[key] = dict(
                machine_id=machine_id,
                bucket_start=key,
                good=0,
                reject=0,
                run_s=0.0,
                idle_s=0.0,
                down_s=0.0,
                offline_s=0.0,
            )
        return minutes[key]

    def interval(left, right, state, reason=None):
        if right <= left:
            return
        if (
            events
            and events[-1]["ended_at"] == left
            and events[-1]["state"] == state
            and events[-1]["reason_code"] == reason
        ):
            events[-1]["ended_at"] = right
        else:
            events.append(
                dict(
                    machine_id=machine_id,
                    state=state,
                    reason_code=reason,
                    started_at=left,
                    ended_at=right,
                )
            )
        cursor = left
        while cursor < right:
            boundary = min(right, cursor.replace(second=0, microsecond=0) + timedelta(minutes=1))
            minute(cursor)[{"RUNNING": "run_s", "IDLE": "idle_s", "DOWN": "down_s"}[state]] += (
                boundary - cursor
            ).total_seconds()
            cursor = boundary

    def cycle():
        return max(
            0.1,
            rng.gauss(profile["ideal_cycle_s"], profile["ideal_cycle_s"] * profile["cycle_jitter"]),
        )

    cursor = start
    next_cycle = cycle()
    failure_remaining = rng.expovariate(1 / (profile["mtbf_min"] * 60))
    while cursor < end:
        running = min(next_cycle, failure_remaining, (end - cursor).total_seconds())
        boundary = cursor + timedelta(seconds=running)
        interval(cursor, boundary, "RUNNING")
        cursor = boundary
        next_cycle -= running
        failure_remaining -= running
        if cursor >= end:
            break
        stop_duration = 0.0
        stop_state = "DOWN"
        reason = None
        if failure_remaining <= 1e-6:
            reason = str(rng.randint(1, 12))
            stop_duration = max(1, rng.expovariate(1 / (profile["mttr_min"] * 60)))
            failure_remaining = rng.expovariate(1 / (profile["mtbf_min"] * 60))
        elif next_cycle <= 1e-6:
            reject = int(rng.random() < profile["scrap_rate"])
            samples.append(
                dict(machine_id=machine_id, sampled_at=cursor, good=1 - reject, reject=reject)
            )
            minute(cursor)["good"] += 1 - reject
            minute(cursor)["reject"] += reject
            next_cycle = cycle()
            if rng.random() < profile["micro_stop_prob"]:
                stop_duration = rng.uniform(2, 15)
                reason = str(rng.randint(1, 12))
            elif rng.random() < profile["idle_prob"]:
                stop_duration = rng.uniform(15, 90)
                stop_state = "IDLE"
        if stop_duration:
            boundary = min(end, cursor + timedelta(seconds=stop_duration))
            interval(cursor, boundary, stop_state, reason)
            cursor = boundary
    return list(minutes.values()), samples, events


async def insert_batches(session, model, rows):
    for offset in range(0, len(rows), 2000):
        await session.execute(insert(model), rows[offset : offset + 2000])


async def demo_catalog(session, model, plant_id, code, **values):
    """Create missing demo records without replacing user edits."""
    row = await session.scalar(select(model).where(model.plant_id == plant_id, model.code == code))
    if row is None:
        row = model(plant_id=plant_id, code=code, **values)
        session.add(row)
        await session.flush()
    return row


async def seed_injection(session, plant, user, machines, configuration, now):
    """Add current injection context; never backdate runs or manufacture telemetry."""
    resin = await demo_catalog(
        session,
        Resin,
        plant.id,
        "DEMO-PP",
        name="DEMO - Polipropileno",
        polymer="PP",
        grade="DEMO",
        manufacturer="Simulador",
    )
    lot = await session.scalar(
        select(ResinLot).where(ResinLot.resin_id == resin.id, ResinLot.lot_code == "DEMO-LOT-001")
    )
    if lot is None:
        session.add(
            ResinLot(
                plant_id=plant.id,
                resin_id=resin.id,
                lot_code="DEMO-LOT-001",
                received_kg=1000,
                received_at=now,
            )
        )
    runs_created = 0
    for machine, profile in machines:
        unit = profile["unit_id"]
        line_number = (unit - 1) // 4 + 1
        line = await demo_catalog(
            session,
            ProductionLine,
            plant.id,
            f"DEMO-L{line_number:02}",
            name=f"DEMO - Linea de inyeccion {line_number}",
        )
        if machine.line_id is None:
            machine.line_id = line.id
        assigned_line = (
            line
            if machine.line_id == line.id
            else await session.get(ProductionLine, machine.line_id)
        )
        cavities = profile.get("active_cavities", 1)
        product = await demo_catalog(
            session,
            Product,
            plant.id,
            f"DEMO-P{unit:02}",
            name=f"DEMO - Pieza {unit:02}",
            part_weight_g=10 + unit,
            description="Producto ficticio para demostracion de inyeccion",
        )
        mold = await demo_catalog(
            session,
            Mold,
            plant.id,
            f"DEMO-M{unit:02}",
            name=f"DEMO - Molde {unit:02}",
            nominal_cavities=cavities,
        )
        recipe = await demo_catalog(
            session,
            InjectionRecipe,
            plant.id,
            f"DEMO-R{unit:02}",
            name=f"DEMO - Receta {unit:02}",
            product_id=product.id,
            mold_id=mold.id,
            resin_id=resin.id,
            active_cavities=cavities,
            ideal_cycle_s=profile["ideal_cycle_s"],
        )
        order = await demo_catalog(
            session,
            ProductionOrder,
            plant.id,
            f"DEMO-OP{unit:02}",
            recipe_id=recipe.id,
            target_pieces=40000,
            status="planned",
        )
        previous = await session.scalar(
            select(ProductionRun.id).where(ProductionRun.order_id == order.id).limit(1)
        )
        occupied = await session.scalar(
            select(ProductionRun.id)
            .where(
                ProductionRun.ended_at.is_(None),
                (ProductionRun.machine_id == machine.id) | (ProductionRun.mold_id == mold.id),
            )
            .limit(1)
        )
        # Closed demo orders/runs and occupied equipment are deliberately not reopened.
        if (
            previous is None
            and occupied is None
            and order.status == "planned"
            and recipe.active_cavities <= mold.nominal_cavities
            and all(
                item.is_active for item in (machine, assigned_line, product, mold, resin, recipe)
            )
            and order.recipe_id == recipe.id
            and (recipe.product_id, recipe.mold_id, recipe.resin_id)
            == (product.id, mold.id, resin.id)
            and recipe.active_cavities == cavities
            and float(recipe.ideal_cycle_s) == float(profile["ideal_cycle_s"])
        ):
            context = dict(
                recipe_id=recipe.id,
                recipe_code=recipe.code,
                product_id=product.id,
                product_code=product.code,
                product_name=product.name,
                mold_code=mold.code,
                mold_name=mold.name,
                resin_id=resin.id,
                resin_code=resin.code,
                resin_name=resin.name,
                polymer=resin.polymer,
                grade=resin.grade,
                line_id=machine.line_id,
                line_code=assigned_line.code,
                line_name=assigned_line.name,
                counter_unit="pieces",
                cycle_unit="seconds_per_shot",
                demo_source=configuration.get("map_version", "custom-v1"),
            )
            session.add(
                ProductionRun(
                    plant_id=plant.id,
                    order_id=order.id,
                    machine_id=machine.id,
                    mold_id=mold.id,
                    context=context,
                    nominal_cavities=mold.nominal_cavities,
                    active_cavities=recipe.active_cavities,
                    ideal_cycle_s=recipe.ideal_cycle_s,
                    part_weight_g=product.part_weight_g,
                    started_by=user.id,
                    started_at=now,
                )
            )
            order.status = "running"
            runs_created += 1
        for variable in configuration.get("process_variables", []):
            existing = await session.scalar(
                select(MachineVariable.id).where(
                    MachineVariable.machine_id == machine.id,
                    MachineVariable.code == variable["code"],
                )
            )
            if existing is None:
                session.add(
                    MachineVariable(
                        machine_id=machine.id,
                        code=variable["code"],
                        name=variable["name"],
                        unit=variable["unit"],
                        address=variable["address"],
                        data_type=variable.get("data_type", "float32"),
                        word_order="big",
                        byte_order="big",
                        scale=1,
                        offset=0,
                        map_version=configuration.get("map_version", "custom-v1"),
                    )
                )
    await session.flush()
    return runs_created


async def seed(
    session, days=7, now=None, config_path=None, *, dry_run=False, owner=None, commit=True
):
    if owner is None and settings.environment == "production":
        raise ValueError("Production demo requires an explicitly provisioned private owner")
    if not 0 <= days <= 30:
        raise ValueError(
            "Demo history requires between 0 and 30 days; 0 creates only configuration"
        )
    if session.bind.dialect.name == "postgresql":
        # Serializes concurrent seed invocations without touching application data.
        await session.execute(text("SELECT pg_advisory_xact_lock(78401121)"))
    configuration = yaml.safe_load(profiles_path(config_path).read_text(encoding="utf-8"))
    profiles = configuration["machines"]
    current_time = (now or datetime.now(UTC)).astimezone(UTC)
    end = (now or datetime.now(UTC)).astimezone(UTC).replace(second=0, microsecond=0)
    start = end - timedelta(days=days)
    user = owner or await session.scalar(select(User).where(User.username == "demo"))
    if user is None:
        user = User(
            username="demo",
            email="demo@example.com",
            full_name="Usuario Demo",
            language="es",
            password_hash=hash_password("Demo1234!"),
        )
        session.add(user)
        await session.flush()
    plant = await session.scalar(select(Plant).where(Plant.slug == "planta-demo-slp"))
    if plant is None:
        plant = Plant(
            slug="planta-demo-slp",
            name="Planta Demo Inyeccion SLP",
            timezone="America/Mexico_City",
            is_public=True,
        )
        session.add(plant)
        await session.flush()
        session.add(PlantMember(plant_id=plant.id, user_id=user.id, role="owner"))
    else:
        membership = await session.get(PlantMember, (plant.id, user.id))
        if membership is None or membership.role != "owner":
            raise ValueError(
                "Existing demo plant does not belong to the seed owner; no data changed"
            )
    for code, label_es, label_en, category in REASONS:
        if await session.get(DowntimeReason, code) is None:
            session.add(
                DowntimeReason(code=code, label_es=label_es, label_en=label_en, category=category)
            )
    shifts = (await session.scalars(select(Shift).where(Shift.plant_id == plant.id))).all()
    if not shifts:
        for name, beginning, ending in [
            ("Turno 1", 6, 14),
            ("Turno 2", 14, 22),
            ("Turno 3", 22, 6),
        ]:
            session.add(
                Shift(
                    plant_id=plant.id,
                    name=name,
                    start_time=time(beginning),
                    end_time=time(ending),
                    days_of_week=list(range(1, 8)),
                )
            )
    seeded = 0
    demo_machines = []
    for profile in profiles:
        slug = slugify(profile["name"])
        machine = await session.scalar(
            select(Machine).where(Machine.plant_id == plant.id, Machine.slug == slug)
        )
        if machine is None:
            # The earlier demo used mixed machine names. Reuse its unit IDs, preserving
            # IDs, slugs, host settings and history instead of creating duplicate equipment.
            legacy = list(
                await session.scalars(
                    select(Machine).where(
                        Machine.plant_id == plant.id,
                        Machine.unit_id == profile["unit_id"],
                        Machine.brand == "Demo",
                        Machine.model == "Modbus TCP",
                    )
                )
            )
            if len(legacy) > 1:
                raise ValueError("Ambiguous demo unit ID; no data changed")
            machine = legacy[0] if legacy else None
        if machine is None:
            machine = Machine(
                plant_id=plant.id,
                slug=slug,
                name=profile["name"],
                brand="Demo",
                model="Modbus TCP",
                host="simulator",
                port=5020,
                unit_id=profile["unit_id"],
                ideal_cycle_s=profile["ideal_cycle_s"],
                is_active=True,
            )
            session.add(machine)
            await session.flush()
        if (
            machine.brand == "Demo"
            and machine.model == "Modbus TCP"
            and machine.unit_id == profile["unit_id"]
            and machine.name == LEGACY_DEMO_NAMES.get(profile["unit_id"])
        ):
            machine.name = profile["name"]
        demo_machines.append((machine, profile))
        if days == 0:
            continue
        existing = await session.scalar(
            select(ProductionMinute.machine_id)
            .where(ProductionMinute.machine_id == machine.id)
            .limit(1)
        )
        has_events = await session.scalar(
            select(MachineEvent.id).where(MachineEvent.machine_id == machine.id).limit(1)
        )
        has_samples = await session.scalar(
            select(ProductionSample.machine_id)
            .where(ProductionSample.machine_id == machine.id)
            .limit(1)
        )
        if existing is not None or has_events is not None or has_samples is not None:
            continue
        minutes, samples, events = historical_rows(machine.id, profile, start, end)
        await insert_batches(session, ProductionMinute, minutes)
        await insert_batches(session, ProductionSample, samples)
        await insert_batches(session, MachineEvent, events)
        seeded += 1
    runs_created = await seed_injection(
        session, plant, user, demo_machines, configuration, current_time
    )
    plant_id = plant.id
    if dry_run:
        await session.rollback()
    elif commit:
        await session.commit()
    return {
        "plant_id": plant_id,
        "history_machines_created": seeded,
        "history_days": days,
        "injection_runs_created": runs_created,
        "history_mode": "legacy_single_cavity",
        "dry_run": dry_run,
    }


async def main(days, dry_run=False):
    async with SessionLocal() as session:
        result = await seed(session, days=days, dry_run=dry_run)
    logging.basicConfig(level=logging.INFO)
    logging.getLogger(__name__).info("Demo seed completed: %s", result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument(
        "--dry-run", action="store_true", help="Validate and report changes, then roll back"
    )
    args = parser.parse_args()
    asyncio.run(main(args.days, args.dry_run))
