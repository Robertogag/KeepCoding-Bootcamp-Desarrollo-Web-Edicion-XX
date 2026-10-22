from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select, update

from app.api.deps import current_user
from app.api.events import page_result
from app.db import get_session
from app.errors import ApiError
from app.models import Notification
from app.services.oee import iso

router = APIRouter(tags=["notifications"])


def notification_data(notification):
    return dict(
        id=notification.id,
        type=notification.type,
        created_at=iso(notification.created_at),
        read_at=iso(notification.read_at),
        payload=notification.payload,
    )


@router.get("/notifications")
async def notifications(
    unread: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session=Depends(get_session),
    user=Depends(current_user),
):
    query = select(Notification).where(Notification.user_id == user.id)
    if unread:
        query = query.where(Notification.read_at.is_(None))
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return page_result([notification_data(row) for row in rows], page, page_size, total)


@router.post("/notifications/read-all", status_code=204)
async def read_all(session=Depends(get_session), user=Depends(current_user)):
    await session.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
    await session.commit()
    return Response(status_code=204)


@router.post("/notifications/{notification_id}/read", status_code=204)
async def read_one(notification_id: int, session=Depends(get_session), user=Depends(current_user)):
    notification = await session.get(Notification, notification_id)
    if notification is None or notification.user_id != user.id:
        raise ApiError(404, "NOT_FOUND")
    notification.read_at = notification.read_at or datetime.now(UTC)
    await session.commit()
    return Response(status_code=204)
