"""Read-only process charts; raw readings remain in the injection router."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, Session, require_machine
from app.errors import ApiError
from app.models import ProductionRun
from app.schemas.telemetry import TelemetrySeriesOut, TelemetrySeriesQuery
from app.services.telemetry_series import telemetry_series

router = APIRouter(tags=["injection"])


@router.get("/machines/{machine_id}/telemetry/series", response_model=TelemetrySeriesOut)
async def series(
    machine_id: int,
    filters: Annotated[TelemetrySeriesQuery, Query()],
    user: CurrentUser,
    session: Session,
):
    """Aggregate [from,to); repeat codes= for each variable (1–12).

    Buckets are anchored at `from` in UTC. An omitted bucket_s chooses a friendly
    interval fitting max_points (default 600, 10–2000). Windows are limited to
    31 days and the response to 24,000 points across mapping versions. Only good
    finite readings contribute values; missing/stale/bad/unavailable readings
    remain visible in counts. Empty buckets contain nulls, never interpolation.
    Units and mapping configurations are separate series. These are polling
    observations, not cycle counts or time-weighted process averages.
    """
    machine = await require_machine(session, user, machine_id)
    if filters.run_id is not None:
        run = await session.get(ProductionRun, filters.run_id)
        if run is None or run.machine_id != machine.id or run.plant_id != machine.plant_id:
            raise ApiError(404, "NOT_FOUND")
    return await telemetry_series(session, machine.id, filters)
