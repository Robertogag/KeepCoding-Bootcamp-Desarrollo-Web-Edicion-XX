from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import ApiError
from app.models import Machine, Plant, PlantMember, User
from app.services.auth import decode_access_token, token_hash

Session = Annotated[AsyncSession, Depends(get_session)]
_bearer = HTTPBearer(auto_error=False)


async def current_user(
    session: Session, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise ApiError(401, "NOT_AUTHENTICATED")
    payload = decode_access_token(credentials.credentials)
    user = await session.get(User, int(payload["sub"]))
    if user is None or payload.get("pwd") != token_hash(user.password_hash):
        raise ApiError(401, "NOT_AUTHENTICATED")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


async def require_plant(session, user, plant_id, roles=None):
    plant = await session.scalar(
        select(Plant)
        .join(PlantMember, PlantMember.plant_id == Plant.id)
        .where(Plant.id == plant_id, PlantMember.user_id == user.id)
    )
    if plant is None:
        raise ApiError(404, "NOT_FOUND")
    if roles:
        role = await session.scalar(
            select(PlantMember.role).where(
                PlantMember.plant_id == plant_id, PlantMember.user_id == user.id
            )
        )
        if role not in roles:
            raise ApiError(403, "FORBIDDEN")
    return plant


async def require_machine(session, user, machine_id, roles=None):
    machine = await session.get(Machine, machine_id)
    if machine is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, machine.plant_id, roles)
    return machine
