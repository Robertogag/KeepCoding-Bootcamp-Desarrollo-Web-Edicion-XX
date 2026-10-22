from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import current_user, require_machine
from app.api.events import page_result
from app.api.machines import machine_data
from app.config import settings
from app.db import get_session
from app.errors import ApiError
from app.models import Machine, Plant, PlantMember, User, Watchlist
from app.services.follow_tokens import verify_unfollow

router = APIRouter(tags=["watchlist"])


@router.get("/watchlist")
async def watchlist(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session=Depends(get_session),
    user=Depends(current_user),
):
    query = (
        select(Machine)
        .join(Watchlist, Watchlist.machine_id == Machine.id)
        .join(PlantMember, PlantMember.plant_id == Machine.plant_id)
        .where(Watchlist.user_id == user.id, PlantMember.user_id == user.id)
    )
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    machines = await session.scalars(
        query.order_by(Machine.name, Machine.id).offset((page - 1) * page_size).limit(page_size)
    )
    items = []
    for machine in machines:
        plant = await session.get(Plant, machine.plant_id)
        item = await machine_data(session, machine, user)
        item["plant"] = {key: getattr(plant, key) for key in ("id", "slug", "name", "timezone")}
        items.append(item)
    return page_result(items, page, page_size, total)


@router.get("/watchlist/unfollow")
async def unfollow(token: str, session=Depends(get_session)):
    user_id, machine_id = verify_unfollow(token)
    user = await session.get(User, user_id)
    if user is None:
        raise ApiError(400, "INVALID_TOKEN")
    await session.execute(
        delete(Watchlist).where(Watchlist.user_id == user_id, Watchlist.machine_id == machine_id)
    )
    await session.commit()
    return RedirectResponse(
        f"{settings.frontend_url}/{user.language}/app/watchlist?unfollowed={machine_id}",
        status_code=303,
    )


@router.put("/watchlist/{machine_id}", status_code=204)
async def follow(machine_id: int, session=Depends(get_session), user=Depends(current_user)):
    await require_machine(session, user, machine_id)
    if await session.get(Watchlist, (user.id, machine_id)) is None:
        session.add(Watchlist(user_id=user.id, machine_id=machine_id))
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
    return Response(status_code=204)


@router.delete("/watchlist/{machine_id}", status_code=204)
async def remove(machine_id: int, session=Depends(get_session), user=Depends(current_user)):
    await require_machine(session, user, machine_id)
    await session.execute(
        delete(Watchlist).where(Watchlist.user_id == user.id, Watchlist.machine_id == machine_id)
    )
    await session.commit()
    return Response(status_code=204)
