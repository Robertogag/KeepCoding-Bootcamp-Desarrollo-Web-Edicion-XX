from fastapi import APIRouter, Response

from app.api.deps import CurrentUser, Session, require_plant
from app.schemas.board import PlantBoard
from app.services.board import plant_board

router = APIRouter(tags=["board"])


@router.get("/plants/{plant_id}/board", response_model=PlantBoard)
async def get_board(plant_id: int, user: CurrentUser, session: Session, response: Response):
    plant = await require_plant(session, user, plant_id)
    response.headers["Cache-Control"] = "private, no-store"
    return await plant_board(session, plant)
