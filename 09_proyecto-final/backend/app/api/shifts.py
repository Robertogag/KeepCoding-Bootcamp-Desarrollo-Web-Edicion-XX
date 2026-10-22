from datetime import time

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, Session, require_plant
from app.api.plants import patch_values
from app.errors import ApiError
from app.models import Shift
from app.schemas.common import envelope, paginate
from app.schemas.shifts import ShiftCreate, ShiftPatch

router = APIRouter(tags=["shifts"])


def shift_data(shift):
    return {
        "id": shift.id,
        "plant_id": shift.plant_id,
        "name": shift.name,
        "start_time": shift.start_time.strftime("%H:%M"),
        "end_time": shift.end_time.strftime("%H:%M"),
        "days_of_week": sorted(shift.days_of_week),
    }


def converted(values):
    return {
        key: time.fromisoformat(value) if key in {"start_time", "end_time"} else value
        for key, value in values.items()
    }


@router.get("/plants/{plant_id}/shifts")
async def list_shifts(
    plant_id: int,
    user: CurrentUser,
    session: Session,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    await require_plant(session, user, plant_id)
    rows, total = await paginate(
        select(Shift).where(Shift.plant_id == plant_id).order_by(Shift.start_time, Shift.id),
        session,
        page,
        page_size,
    )
    return envelope([shift_data(row) for row in rows], total, page, page_size)


@router.post("/plants/{plant_id}/shifts", status_code=201)
async def create_shift(plant_id: int, data: ShiftCreate, user: CurrentUser, session: Session):
    await require_plant(session, user, plant_id, {"owner", "supervisor"})
    if data.start_time == data.end_time:
        raise ApiError(422, "VALIDATION_ERROR", "end_time")
    shift = Shift(plant_id=plant_id, **converted(data.model_dump()))
    session.add(shift)
    await session.commit()
    return shift_data(shift)


async def authorized_shift(session, user, shift_id):
    shift = await session.get(Shift, shift_id)
    if shift is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, shift.plant_id, {"owner", "supervisor"})
    return shift


@router.patch("/shifts/{shift_id}")
async def edit_shift(shift_id: int, data: ShiftPatch, user: CurrentUser, session: Session):
    shift = await authorized_shift(session, user, shift_id)
    values = converted(patch_values(data))
    if values.get("start_time", shift.start_time) == values.get("end_time", shift.end_time):
        raise ApiError(422, "VALIDATION_ERROR", "end_time")
    for key, value in values.items():
        setattr(shift, key, value)
    await session.commit()
    return shift_data(shift)


@router.delete("/shifts/{shift_id}", status_code=204)
async def delete_shift(shift_id: int, user: CurrentUser, session: Session):
    shift = await authorized_shift(session, user, shift_id)
    await session.delete(shift)
    await session.commit()
