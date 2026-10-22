import asyncio
from typing import Literal

from fastapi import APIRouter, File, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, Session, require_machine, require_plant
from app.api.plants import patch_values
from app.errors import ApiError
from app.models import Machine, Plant, PlantMember, User, Watchlist
from app.schemas.common import envelope, slugify, utc_iso
from app.schemas.machines import Connection, MachineCreate, MachinePatch
from app.services.auth import decode_access_token, token_hash
from app.services.images import (
    MAX_FILE_SIZE,
    delete_photo,
    photo_path,
    photo_urls,
    photo_user,
    save_photo,
)
from app.services.modbus import test_connection
from app.services.oee import machine_snapshot

router = APIRouter(tags=["machines"])


async def machine_data(session, machine, user):
    watched = await session.get(Watchlist, (user.id, machine.id))
    plant = await session.get(Plant, machine.plant_id)
    return {
        "id": machine.id,
        "plant_id": machine.plant_id,
        "line_id": machine.line_id,
        "slug": machine.slug,
        "name": machine.name,
        "brand": machine.brand,
        "model": machine.model,
        "host": machine.host,
        "port": machine.port,
        "unit_id": machine.unit_id,
        "ideal_cycle_s": machine.ideal_cycle_s,
        "is_active": machine.is_active,
        "photo": photo_urls(machine, public=plant.is_public, user_id=user.id),
        "snapshot": await machine_snapshot(session, machine),
        "is_watched": watched is not None,
        "created_at": utc_iso(machine.created_at),
    }


@router.get("/plants/{plant_id}/machines")
async def list_machines(
    plant_id: int,
    user: CurrentUser,
    session: Session,
    search: str | None = Query(None, max_length=80),
    state: Literal["RUNNING", "IDLE", "DOWN", "OFFLINE"] | None = None,
    brand: str | None = Query(None, max_length=40),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    await require_plant(session, user, plant_id)
    query = select(Machine).where(Machine.plant_id == plant_id)
    if search:
        query = query.where(Machine.name.icontains(search, autoescape=True))
    if brand:
        query = query.where(Machine.brand == brand)
    machines = (await session.scalars(query.order_by(Machine.name, Machine.id))).all()
    if state:
        filtered = []
        for machine in machines:
            if (await machine_snapshot(session, machine))["state"] == state:
                filtered.append(machine)
        machines = filtered
    start = (page - 1) * page_size
    return envelope(
        [
            await machine_data(session, machine, user)
            for machine in machines[start : start + page_size]
        ],
        len(machines),
        page,
        page_size,
    )


@router.post("/plants/{plant_id}/machines/test-connection")
async def test_unsaved(plant_id: int, data: Connection, user: CurrentUser, session: Session):
    await require_plant(session, user, plant_id, {"owner", "supervisor"})
    return await test_connection(data.host, data.port, data.unit_id)


@router.post("/plants/{plant_id}/machines", status_code=201)
async def create_machine(plant_id: int, data: MachineCreate, user: CurrentUser, session: Session):
    await require_plant(session, user, plant_id, {"owner", "supervisor"})
    machine = Machine(plant_id=plant_id, slug=slugify(data.name), **data.model_dump())
    session.add(machine)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "SLUG_TAKEN", "name") from None
    return await machine_data(session, machine, user)


@router.get("/machines/{machine_id}")
async def get_machine(machine_id: int, user: CurrentUser, session: Session):
    return await machine_data(session, await require_machine(session, user, machine_id), user)


@router.patch("/machines/{machine_id}")
async def edit_machine(machine_id: int, data: MachinePatch, user: CurrentUser, session: Session):
    machine = await require_machine(session, user, machine_id, {"owner", "supervisor"})
    for key, value in patch_values(data).items():
        setattr(machine, key, value)
    await session.commit()
    return await machine_data(session, machine, user)


@router.delete("/machines/{machine_id}", status_code=204)
async def delete_machine(machine_id: int, user: CurrentUser, session: Session):
    machine = await require_machine(session, user, machine_id, {"owner", "supervisor"})
    key = machine.photo_key
    await session.delete(machine)
    await session.commit()
    delete_photo(key)


@router.post("/machines/{machine_id}/test-connection")
async def test_saved(machine_id: int, user: CurrentUser, session: Session):
    machine = await require_machine(session, user, machine_id, {"owner", "supervisor"})
    return await test_connection(machine.host, machine.port, machine.unit_id)


@router.post("/machines/{machine_id}/photo")
async def upload_photo(
    machine_id: int, user: CurrentUser, session: Session, file: UploadFile = File(...)
):
    machine = await require_machine(session, user, machine_id, {"owner", "supervisor"})
    content = await file.read(MAX_FILE_SIZE + 1)
    await file.close()
    key = await asyncio.to_thread(save_photo, content)
    old_key = machine.photo_key
    machine.photo_key = key
    try:
        await session.commit()
    except Exception:
        delete_photo(key)
        raise
    delete_photo(old_key)
    return await machine_data(session, machine, user)


@router.get("/media/machines/{filename}")
async def media(
    filename: str,
    request: Request,
    session: Session,
    token: str | None = Query(None, max_length=2048),
):
    import re

    match = re.fullmatch(r"([a-f0-9]{32})_(320|768|1280)\.webp", filename)
    if not match:
        raise ApiError(404, "NOT_FOUND")
    key, size = match.group(1), int(match.group(2))
    machine = await session.scalar(select(Machine).where(Machine.photo_key == key))
    if machine is None:
        raise ApiError(404, "NOT_FOUND")
    plant = await session.get(Plant, machine.plant_id)
    if not plant.is_public:
        user_id = photo_user(token, key) if token else None
        if user_id is None and request.headers.get("authorization", "").lower().startswith(
            "bearer "
        ):
            try:
                payload = decode_access_token(request.headers["authorization"].split(" ", 1)[1])
                user = await session.get(User, int(payload["sub"]))
                if user and payload.get("pwd") == token_hash(user.password_hash):
                    user_id = user.id
            except ApiError:
                pass
        if user_id is None or await session.get(PlantMember, (plant.id, user_id)) is None:
            raise ApiError(404, "NOT_FOUND")
    path = photo_path(key, size)
    if not path.is_file():
        raise ApiError(404, "NOT_FOUND")
    return FileResponse(
        path,
        media_type="image/webp",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )
