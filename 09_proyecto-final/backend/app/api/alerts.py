from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select

from app.api.deps import current_user, require_machine, require_plant
from app.api.events import page_result
from app.db import get_session
from app.errors import ApiError
from app.models import AlertRule

router = APIRouter(tags=["alerts"])


class RuleInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    machine_id: int | None = Field(None, gt=0)
    type: Literal["MACHINE_DOWN", "MACHINE_OFFLINE", "OEE_BELOW"]
    threshold: float | None = Field(None, ge=0, le=1)
    duration_s: int = Field(30, ge=30, le=86400, strict=True)
    is_active: bool = True

    @model_validator(mode="after")
    def check_threshold(self):
        if (self.type == "OEE_BELOW") != (self.threshold is not None):
            raise ApiError(422, "VALIDATION_ERROR", "threshold")
        return self


class RulePatch(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    machine_id: int | None = Field(None, gt=0)
    type: Literal["MACHINE_DOWN", "MACHINE_OFFLINE", "OEE_BELOW"] | None = None
    threshold: float | None = Field(None, ge=0, le=1)
    duration_s: int | None = Field(None, ge=30, le=86400, strict=True)
    is_active: bool | None = None

    @model_validator(mode="after")
    def check_required_values(self):
        for field in ("type", "duration_s", "is_active"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ApiError(422, "VALIDATION_ERROR", field)
        return self


def rule_data(rule):
    return {
        key: getattr(rule, key)
        for key in ("id", "plant_id", "machine_id", "type", "threshold", "duration_s", "is_active")
    }


async def validate_machine(session, user, plant_id, machine_id):
    if machine_id:
        machine = await require_machine(session, user, machine_id)
        if machine.plant_id != plant_id:
            raise ApiError(422, "VALIDATION_ERROR", "machine_id")


@router.get("/plants/{plant_id}/alert-rules")
async def rules(
    plant_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session=Depends(get_session),
    user=Depends(current_user),
):
    await require_plant(session, user, plant_id)
    query = select(AlertRule).where(AlertRule.plant_id == plant_id)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(AlertRule.id).offset((page - 1) * page_size).limit(page_size)
    )
    return page_result([rule_data(row) for row in rows], page, page_size, total)


@router.post("/plants/{plant_id}/alert-rules", status_code=201)
async def create(
    plant_id: int, body: RuleInput, session=Depends(get_session), user=Depends(current_user)
):
    await require_plant(session, user, plant_id, roles=("owner", "supervisor"))
    await validate_machine(session, user, plant_id, body.machine_id)
    rule = AlertRule(plant_id=plant_id, **body.model_dump())
    session.add(rule)
    await session.commit()
    return rule_data(rule)


@router.patch("/alert-rules/{rule_id}")
async def edit(
    rule_id: int, body: RulePatch, session=Depends(get_session), user=Depends(current_user)
):
    rule = await session.get(AlertRule, rule_id)
    if rule is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, rule.plant_id, roles=("owner", "supervisor"))
    values = {key: value for key, value in rule_data(rule).items() if key not in ("id", "plant_id")}
    values.update(body.model_dump(exclude_unset=True))
    validated = RuleInput.model_validate(values)
    await validate_machine(session, user, rule.plant_id, validated.machine_id)
    for key, value in validated.model_dump().items():
        setattr(rule, key, value)
    await session.commit()
    return rule_data(rule)


@router.delete("/alert-rules/{rule_id}", status_code=204)
async def remove(rule_id: int, session=Depends(get_session), user=Depends(current_user)):
    rule = await session.get(AlertRule, rule_id)
    if rule is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, rule.plant_id, roles=("owner", "supervisor"))
    await session.delete(rule)
    await session.commit()
    return Response(status_code=204)
