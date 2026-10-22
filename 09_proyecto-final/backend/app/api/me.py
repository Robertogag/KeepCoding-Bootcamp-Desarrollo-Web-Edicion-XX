from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.auth import check_unique, user_data
from app.api.deps import CurrentUser, Session
from app.errors import ApiError
from app.models import Machine, Plant, PlantMember
from app.schemas.auth import AccountDelete, PasswordChange, UserPatch
from app.services.auth import hash_password, lock_user, revoke_all, verify_password
from app.services.images import delete_photo

router = APIRouter(prefix="/me", tags=["account"])


@router.get("")
async def me(user: CurrentUser):
    return user_data(user)


@router.patch("")
async def edit_me(data: UserPatch, user: CurrentUser, session: Session):
    user_id = user.id
    values = data.model_dump(exclude_unset=True)
    if any(value is None for value in values.values()):
        raise ApiError(422, "VALIDATION_ERROR", next(k for k, v in values.items() if v is None))
    await check_unique(session, data.username, data.email, user_id)
    for key, value in values.items():
        setattr(user, key, value)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        await check_unique(session, data.username, data.email, user_id)
        raise ApiError(422, "VALIDATION_ERROR") from None
    return user_data(user)


@router.put("/password", status_code=204)
async def password(data: PasswordChange, user: CurrentUser, session: Session):
    user = await lock_user(session, user.id)
    if user is None:
        raise ApiError(401, "NOT_AUTHENTICATED")
    if not verify_password(user.password_hash, data.current_password):
        raise ApiError(400, "WRONG_PASSWORD", "current_password")
    user.password_hash = hash_password(data.new_password)
    await revoke_all(session, user.id)
    await session.commit()


@router.delete("", status_code=204)
async def delete_me(data: AccountDelete, user: CurrentUser, session: Session):
    if not verify_password(user.password_hash, data.password):
        raise ApiError(400, "WRONG_PASSWORD", "password")
    plants = (
        await session.scalars(
            select(Plant)
            .join(PlantMember, PlantMember.plant_id == Plant.id)
            .where(PlantMember.user_id == user.id, PlantMember.role == "owner")
            .order_by(Plant.id)
            .with_for_update(of=Plant)
        )
    ).all()
    photos = []
    for plant in plants:
        owners = await session.scalar(
            select(func.count())
            .select_from(PlantMember)
            .where(PlantMember.plant_id == plant.id, PlantMember.role == "owner")
        )
        if owners == 1:
            photos.extend(
                (
                    await session.scalars(
                        select(Machine.photo_key).where(Machine.plant_id == plant.id)
                    )
                ).all()
            )
            await session.delete(plant)
    await session.delete(user)
    await session.commit()
    for key in photos:
        delete_photo(key)
