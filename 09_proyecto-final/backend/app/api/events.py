from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select

from app.api.deps import current_user, require_machine
from app.db import get_session
from app.errors import ApiError
from app.models import DowntimeReason, MachineEvent, User
from app.services.oee import iso

router = APIRouter(tags=["events"])


def page_result(items, page, page_size, total):
    return dict(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        has_next=page * page_size < total,
        has_prev=page > 1 and (page - 2) * page_size < total,
    )


def reason_data(reason):
    return {key: getattr(reason, key) for key in ("code", "label_es", "label_en", "category")}


async def event_data(session, event):
    reason = await session.get(DowntimeReason, event.reason_code) if event.reason_code else None
    classifier = await session.get(User, event.classified_by) if event.classified_by else None
    return dict(
        id=event.id,
        machine_id=event.machine_id,
        state=event.state,
        reason_code=event.reason_code,
        reason=reason_data(reason) if reason else None,
        comment=event.comment,
        classified_by=dict(id=classifier.id, username=classifier.username) if classifier else None,
        started_at=iso(event.started_at),
        ended_at=iso(event.ended_at),
    )


@router.get("/machines/{machine_id}/events")
async def events(
    machine_id: int,
    start: datetime | None = Query(None, alias="from"),
    end: datetime | None = Query(None, alias="to"),
    state: Literal["RUNNING", "IDLE", "DOWN", "OFFLINE"] | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session=Depends(get_session),
    user=Depends(current_user),
):
    await require_machine(session, user, machine_id)
    if start and start.tzinfo is None:
        raise ApiError(422, "VALIDATION_ERROR", "from")
    if end and (end.tzinfo is None or (start and end <= start)):
        raise ApiError(422, "VALIDATION_ERROR", "to")
    query = select(MachineEvent).where(MachineEvent.machine_id == machine_id)
    if start:
        query = query.where(or_(MachineEvent.ended_at.is_(None), MachineEvent.ended_at > start))
    if end:
        query = query.where(MachineEvent.started_at < end)
    if state:
        query = query.where(MachineEvent.state == state)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(MachineEvent.started_at.desc(), MachineEvent.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return page_result([await event_data(session, row) for row in rows], page, page_size, total)


class EventUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason_code: str | None = None
    comment: str | None = Field(None, max_length=500)


@router.patch("/events/{event_id}")
async def classify(
    event_id: int, body: EventUpdate, session=Depends(get_session), user=Depends(current_user)
):
    event = await session.get(MachineEvent, event_id)
    if event is None:
        raise ApiError(404, "NOT_FOUND")
    await require_machine(session, user, event.machine_id, roles=("owner", "supervisor"))
    if body.reason_code is not None and await session.get(DowntimeReason, body.reason_code) is None:
        raise ApiError(422, "VALIDATION_ERROR", "reason_code")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    event.classified_by = user.id
    await session.commit()
    return await event_data(session, event)


@router.get("/downtime-reasons")
async def reasons(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session=Depends(get_session),
    user=Depends(current_user),
):
    total = await session.scalar(select(func.count()).select_from(DowntimeReason))
    rows = await session.scalars(
        select(DowntimeReason)
        .order_by(DowntimeReason.code)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return page_result([reason_data(row) for row in rows], page, page_size, total)
