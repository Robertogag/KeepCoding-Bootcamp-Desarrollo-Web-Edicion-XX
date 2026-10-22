from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import field_validator

from app.schemas.auth import Name, Username
from app.schemas.common import Input

Role = Literal["owner", "supervisor", "viewer"]


class PlantCreate(Input):
    name: Name
    timezone: str
    is_public: bool = False

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Invalid IANA timezone") from None
        return value


class PlantPatch(PlantCreate):
    name: Name | None = None
    timezone: str | None = None
    is_public: bool | None = None


class MemberCreate(Input):
    username: Username
    role: Role


class MemberPatch(Input):
    role: Role
