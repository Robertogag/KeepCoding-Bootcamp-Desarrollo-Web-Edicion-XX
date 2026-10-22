from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import Input

Origin = Annotated[float, Field(ge=0, le=1, strict=True, allow_inf_nan=False)]
Dimension = Annotated[float, Field(gt=0, le=1, strict=True, allow_inf_nan=False)]


class PositionInput(Input):
    machine_id: int = Field(gt=0, strict=True)
    x: Origin
    y: Origin
    width: Dimension
    height: Dimension
    rotation: int = Field(default=0, strict=True, json_schema_extra={"enum": [0, 90, 180, 270]})

    @field_validator("rotation")
    @classmethod
    def valid_rotation(cls, value):
        if value not in {0, 90, 180, 270}:
            raise ValueError("Rotation must be 0, 90, 180 or 270 degrees")
        return value

    @model_validator(mode="after")
    def within_canvas(self):
        if self.x + self.width > 1 or self.y + self.height > 1:
            raise ValueError("Position must fit within the normalized canvas")
        return self


class LayoutInput(Input):
    positions: list[PositionInput]

    @field_validator("positions")
    @classmethod
    def unique_machines(cls, positions):
        if len({position.machine_id for position in positions}) != len(positions):
            raise ValueError("Machine positions must be unique")
        return positions


class PositionOutput(PositionInput):
    model_config = ConfigDict(from_attributes=True)
    updated_at: datetime


class LayoutOutput(BaseModel):
    plant_id: int
    positions: list[PositionOutput]
