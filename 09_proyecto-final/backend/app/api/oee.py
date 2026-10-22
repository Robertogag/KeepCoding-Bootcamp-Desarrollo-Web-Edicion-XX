import csv
import io
from datetime import UTC, date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select

from app.api.deps import current_user, require_machine, require_plant
from app.db import get_session
from app.errors import ApiError
from app.models import Machine
from app.services.oee import oee_series, plant_summary

router = APIRouter(tags=["oee"])


def validate_window(start, end):
    if start.tzinfo is None:
        raise ApiError(422, "VALIDATION_ERROR", "from")
    if end.tzinfo is None or end <= start:
        raise ApiError(422, "VALIDATION_ERROR", "to")


@router.get("/machines/{machine_id}/oee")
async def machine_oee(
    machine_id: int,
    start: datetime = Query(alias="from"),
    end: datetime = Query(alias="to"),
    granularity: Literal["hour", "shift", "day"] = "hour",
    session=Depends(get_session),
    user=Depends(current_user),
):
    validate_window(start, end)
    machine = await require_machine(session, user, machine_id)
    return await oee_series(session, machine, start, end, granularity)


@router.get("/plants/{plant_id}/oee/summary")
async def summary(
    plant_id: int,
    date: date | None = None,
    session=Depends(get_session),
    user=Depends(current_user),
):
    plant = await require_plant(session, user, plant_id)
    return await plant_summary(session, plant, date)


def csv_text(value):
    return (
        "'" + value
        if value and value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r"))
        else value
    )


@router.get("/plants/{plant_id}/reports/oee.csv")
async def csv_report(
    plant_id: int,
    start: datetime = Query(alias="from"),
    end: datetime = Query(alias="to"),
    session=Depends(get_session),
    user=Depends(current_user),
):
    validate_window(start, end)
    plant = await require_plant(session, user, plant_id)
    from zoneinfo import ZoneInfo

    columns = [
        "date",
        "machine",
        "availability",
        "performance",
        "quality",
        "oee",
        "good",
        "reject",
        "run_s",
        "planned_s",
        "ideal_seconds",
    ]
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    machines = await session.scalars(
        select(Machine).where(Machine.plant_id == plant.id).order_by(Machine.name, Machine.id)
    )
    for machine in machines:
        for row in await oee_series(
            session, machine, start, end, "day", include_ideal_seconds=True
        ):
            instant = datetime.fromisoformat(row.pop("bucket_start"))
            writer.writerow(
                dict(
                    date=instant.astimezone(ZoneInfo(plant.timezone)).date().isoformat(),
                    machine=csv_text(machine.name),
                    **row,
                )
            )
    start_utc, end_utc = start.astimezone(UTC), end.astimezone(UTC)
    filename = f"oee_{plant.slug}_{start_utc:%Y%m%dT%H%M%SZ}_{end_utc:%Y%m%dT%H%M%SZ}.csv"
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
