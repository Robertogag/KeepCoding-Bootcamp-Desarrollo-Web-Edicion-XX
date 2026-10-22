from typing import Annotated

from pydantic import BeforeValidator, Field, field_validator

from app.schemas.auth import strip
from app.schemas.common import Input

ShiftName = Annotated[str, Field(min_length=1, max_length=40), BeforeValidator(strip)]
Hour = Annotated[str, Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")]
Day = Annotated[int, Field(ge=1, le=7, strict=True)]


class ShiftCreate(Input):
    name: ShiftName
    start_time: Hour
    end_time: Hour
    days_of_week: list[Day] = Field(min_length=1, max_length=7)

    @field_validator("days_of_week")
    @classmethod
    def days(cls, values):
        if values is None:
            return values
        if len(set(values)) != len(values):
            raise ValueError("Duplicate day")
        return sorted(values)


class ShiftPatch(ShiftCreate):
    name: ShiftName | None = None
    start_time: Hour | None = None
    end_time: Hour | None = None
    days_of_week: list[Day] | None = Field(default=None, min_length=1, max_length=7)
