from fastapi import APIRouter, Query
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, Session, require_plant
from app.errors import ApiError
from app.models import Machine, Plant, PlantMember, User, Watchlist
from app.schemas.common import envelope, paginate, slugify, utc_iso
from app.schemas.plants import MemberCreate, MemberPatch, PlantCreate, PlantPatch
from app.services.images import delete_photo
from app.services.oee import plant_summary

router = APIRouter(tags=["plants"])


async def plant_data(session, plant, user):
    role = await session.scalar(
        select(PlantMember.role).where(
            PlantMember.plant_id == plant.id, PlantMember.user_id == user.id
        )
    )
    count = await session.scalar(
        select(func.count()).select_from(Machine).where(Machine.plant_id == plant.id)
    )
    summary = await plant_summary(session, plant)
    return {
        "id": plant.id,
        "slug": plant.slug,
        "name": plant.name,
        "timezone": plant.timezone,
        "is_public": plant.is_public,
        "role": role,
        "created_at": utc_iso(plant.created_at),
        "machine_count": count,
        "oee_today": {
            key: summary["plant"][key] for key in ("availability", "performance", "quality", "oee")
        },
    }


async def lock_owner_plant(session, user, plant_id):
    await require_plant(session, user, plant_id, {"owner"})
    plant = await session.scalar(select(Plant).where(Plant.id == plant_id).with_for_update())
    if plant is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, plant_id, {"owner"})
    return plant


def patch_values(data):
    values = data.model_dump(exclude_unset=True)
    for field, value in values.items():
        if value is None:
            raise ApiError(422, "VALIDATION_ERROR", field)
    return values


@router.get("/plants")
async def list_plants(
    user: CurrentUser,
    session: Session,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = (
        select(Plant)
        .join(PlantMember, PlantMember.plant_id == Plant.id)
        .where(PlantMember.user_id == user.id)
        .order_by(Plant.created_at.desc(), Plant.id.desc())
    )
    plants, total = await paginate(query, session, page, page_size)
    return envelope(
        [await plant_data(session, plant, user) for plant in plants], total, page, page_size
    )


@router.post("/plants", status_code=201)
async def create_plant(data: PlantCreate, user: CurrentUser, session: Session):
    plant = Plant(**data.model_dump(), slug=slugify(data.name))
    session.add(plant)
    try:
        await session.flush()
        session.add(PlantMember(plant_id=plant.id, user_id=user.id, role="owner"))
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "SLUG_TAKEN", "name") from None
    return await plant_data(session, plant, user)


@router.get("/plants/{plant_id}")
async def get_plant(plant_id: int, user: CurrentUser, session: Session):
    return await plant_data(session, await require_plant(session, user, plant_id), user)


@router.patch("/plants/{plant_id}")
async def edit_plant(plant_id: int, data: PlantPatch, user: CurrentUser, session: Session):
    plant = await lock_owner_plant(session, user, plant_id)
    for field, value in patch_values(data).items():
        setattr(plant, field, value)
    await session.commit()
    return await plant_data(session, plant, user)


@router.delete("/plants/{plant_id}", status_code=204)
async def delete_plant(plant_id: int, user: CurrentUser, session: Session):
    plant = await lock_owner_plant(session, user, plant_id)
    photos = (
        await session.scalars(select(Machine.photo_key).where(Machine.plant_id == plant_id))
    ).all()
    await session.delete(plant)
    await session.commit()
    for key in photos:
        delete_photo(key)


def member_data(user, member):
    return {
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": member.role,
    }


@router.get("/plants/{plant_id}/members")
async def list_members(
    plant_id: int,
    user: CurrentUser,
    session: Session,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    await require_plant(session, user, plant_id)
    query = (
        select(User)
        .join(PlantMember, PlantMember.user_id == User.id)
        .where(PlantMember.plant_id == plant_id)
        .order_by(User.username, User.id)
    )
    users, total = await paginate(query, session, page, page_size)
    members = [
        member_data(person, await session.get(PlantMember, (plant_id, person.id)))
        for person in users
    ]
    return envelope(members, total, page, page_size)


@router.post("/plants/{plant_id}/members", status_code=201)
async def add_member(plant_id: int, data: MemberCreate, user: CurrentUser, session: Session):
    await lock_owner_plant(session, user, plant_id)
    target = await session.scalar(select(User).where(User.username == data.username))
    if target is None:
        raise ApiError(404, "NOT_FOUND", "username")
    if await session.get(PlantMember, (plant_id, target.id)):
        raise ApiError(422, "VALIDATION_ERROR", "username")
    member = PlantMember(plant_id=plant_id, user_id=target.id, role=data.role)
    session.add(member)
    await session.commit()
    return member_data(target, member)


async def protect_last_owner(session, member):
    if member.role == "owner":
        count = await session.scalar(
            select(func.count())
            .select_from(PlantMember)
            .where(PlantMember.plant_id == member.plant_id, PlantMember.role == "owner")
        )
        if count <= 1:
            raise ApiError(403, "FORBIDDEN")


@router.patch("/plants/{plant_id}/members/{user_id}")
async def edit_member(
    plant_id: int, user_id: int, data: MemberPatch, user: CurrentUser, session: Session
):
    await lock_owner_plant(session, user, plant_id)
    member = await session.get(PlantMember, (plant_id, user_id))
    if member is None:
        raise ApiError(404, "NOT_FOUND")
    if data.role != "owner":
        await protect_last_owner(session, member)
    member.role = data.role
    await session.commit()
    return member_data(await session.get(User, user_id), member)


@router.delete("/plants/{plant_id}/members/{user_id}", status_code=204)
async def remove_member(plant_id: int, user_id: int, user: CurrentUser, session: Session):
    await lock_owner_plant(session, user, plant_id)
    member = await session.get(PlantMember, (plant_id, user_id))
    if member is None:
        raise ApiError(404, "NOT_FOUND")
    await protect_last_owner(session, member)
    await session.execute(
        delete(Watchlist).where(
            Watchlist.user_id == user_id,
            Watchlist.machine_id.in_(select(Machine.id).where(Machine.plant_id == plant_id)),
        )
    )
    await session.delete(member)
    await session.commit()
