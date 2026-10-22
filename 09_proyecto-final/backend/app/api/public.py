from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import Session
from app.errors import ApiError
from app.models import Machine, Plant
from app.schemas.common import envelope, paginate, utc_iso
from app.services.images import photo_urls
from app.services.oee import machine_snapshot, oee_series, plant_summary

router = APIRouter(prefix="/public", tags=["public"])


async def public_machine_data(session, machine):
    return {
        "id": machine.id,
        "slug": machine.slug,
        "name": machine.name,
        "brand": machine.brand,
        "model": machine.model,
        "photo": photo_urls(machine, public=True),
        "snapshot": await machine_snapshot(session, machine),
    }


async def public_plant(session, slug):
    plant = await session.scalar(select(Plant).where(Plant.slug == slug, Plant.is_public.is_(True)))
    if plant is None:
        raise ApiError(404, "NOT_FOUND")
    return plant


async def metrics(session, plant):
    result = (await plant_summary(session, plant))["plant"]
    return {key: result[key] for key in ("availability", "performance", "quality", "oee")}


@router.get("/plants")
async def list_public(
    session: Session, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)
):
    rows, total = await paginate(
        select(Plant)
        .where(Plant.is_public.is_(True))
        .order_by(Plant.created_at.desc(), Plant.id.desc()),
        session,
        page,
        page_size,
    )
    items = []
    for plant in rows:
        count = await session.scalar(
            select(func.count()).select_from(Machine).where(Machine.plant_id == plant.id)
        )
        items.append(
            {
                "id": plant.id,
                "slug": plant.slug,
                "name": plant.name,
                "timezone": plant.timezone,
                "created_at": utc_iso(plant.created_at),
                "machine_count": count,
                "oee_today": await metrics(session, plant),
            }
        )
    return envelope(items, total, page, page_size)


@router.get("/plants/{plant_slug}")
async def get_public(plant_slug: str, session: Session):
    plant = await public_plant(session, plant_slug)
    machines = (
        await session.scalars(
            select(Machine).where(Machine.plant_id == plant.id).order_by(Machine.name, Machine.id)
        )
    ).all()
    return {
        "id": plant.id,
        "slug": plant.slug,
        "name": plant.name,
        "timezone": plant.timezone,
        "oee_today": await metrics(session, plant),
        "machines": [await public_machine_data(session, machine) for machine in machines],
    }


@router.get("/plants/{plant_slug}/machines/{machine_slug}")
async def get_public_machine(plant_slug: str, machine_slug: str, session: Session):
    plant = await public_plant(session, plant_slug)
    machine = await session.scalar(
        select(Machine).where(Machine.plant_id == plant.id, Machine.slug == machine_slug)
    )
    if machine is None:
        raise ApiError(404, "NOT_FOUND")
    now = datetime.now(UTC)
    return {
        **await public_machine_data(session, machine),
        "ideal_cycle_s": machine.ideal_cycle_s,
        "plant": {
            "id": plant.id,
            "slug": plant.slug,
            "name": plant.name,
            "timezone": plant.timezone,
        },
        "trend": await oee_series(session, machine, now - timedelta(hours=12), now, "hour"),
    }
