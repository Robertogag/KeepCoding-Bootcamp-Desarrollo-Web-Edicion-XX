from fastapi import APIRouter
from sqlalchemy import delete, select

from app.api.deps import CurrentUser, Session, require_plant
from app.errors import ApiError
from app.models import Machine, MachineBoardPosition, Plant
from app.models.types import utcnow
from app.schemas.layout import LayoutInput, LayoutOutput

router = APIRouter(tags=["layout"])


async def layout_data(session, plant_id):
    positions = await session.scalars(
        select(MachineBoardPosition)
        .join(Machine, Machine.id == MachineBoardPosition.machine_id)
        .where(Machine.plant_id == plant_id)
        .order_by(MachineBoardPosition.machine_id)
    )
    return {"plant_id": plant_id, "positions": list(positions)}


@router.get("/plants/{plant_id}/layout", response_model=LayoutOutput)
async def get_layout(plant_id: int, user: CurrentUser, session: Session):
    await require_plant(session, user, plant_id)
    return await layout_data(session, plant_id)


@router.put("/plants/{plant_id}/layout", response_model=LayoutOutput)
async def replace_layout(plant_id: int, data: LayoutInput, user: CurrentUser, session: Session):
    await require_plant(session, user, plant_id, {"owner", "supervisor"})
    plant = await session.scalar(select(Plant).where(Plant.id == plant_id).with_for_update())
    if plant is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, plant_id, {"owner", "supervisor"})
    requested_ids = {position.machine_id for position in data.positions}
    if requested_ids:
        present_ids = set(
            await session.scalars(
                select(Machine.id)
                .where(Machine.plant_id == plant_id, Machine.id.in_(requested_ids))
                .order_by(Machine.id)
                .with_for_update()
            )
        )
        if present_ids != requested_ids:
            raise ApiError(422, "VALIDATION_ERROR", "positions.machine_id")
    await session.execute(
        delete(MachineBoardPosition).where(
            MachineBoardPosition.machine_id.in_(
                select(Machine.id).where(Machine.plant_id == plant_id)
            )
        )
    )
    changed_at = utcnow()
    session.add_all(
        MachineBoardPosition(**position.model_dump(), updated_at=changed_at)
        for position in data.positions
    )
    await session.commit()
    return await layout_data(session, plant_id)
