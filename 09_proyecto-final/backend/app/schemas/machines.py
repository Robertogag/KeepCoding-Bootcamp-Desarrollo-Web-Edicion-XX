import ipaddress
import re
from decimal import Decimal
from typing import Annotated

from pydantic import BeforeValidator, Field, field_validator

from app.schemas.auth import strip
from app.schemas.common import Input

MachineName = Annotated[str, Field(min_length=2, max_length=60), BeforeValidator(strip)]
ShortText = Annotated[str, Field(max_length=40), BeforeValidator(strip)]


class Connection(Input):
    host: str = Field(min_length=1, max_length=253)
    port: int = Field(default=502, ge=1, le=65535, strict=True)
    unit_id: int = Field(default=1, ge=1, le=247, strict=True)

    @field_validator("host")
    @classmethod
    def valid_host(cls, value):
        if value is None:
            return value
        try:
            ipaddress.IPv4Address(value)
            return value
        except ValueError:
            if re.fullmatch(r"[0-9.]+", value):
                raise ValueError("Invalid IPv4 address") from None
        if not all(
            re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?", label)
            for label in value.rstrip(".").split(".")
        ):
            raise ValueError("Invalid hostname")
        return value


class MachineCreate(Connection):
    name: MachineName
    brand: ShortText = ""
    model: ShortText = ""
    ideal_cycle_s: float = Field(ge=0.1, le=3600, allow_inf_nan=False)
    is_active: bool = True

    @field_validator("ideal_cycle_s")
    @classmethod
    def decimal_cycle(cls, value):
        if value is None:
            return value
        if Decimal(str(value)) % Decimal("0.1"):
            raise ValueError("Cycle requires a decimal multiple of 0.1")
        return value


class MachinePatch(MachineCreate):
    host: str | None = Field(default=None, min_length=1, max_length=253)
    port: int | None = Field(default=None, ge=1, le=65535, strict=True)
    unit_id: int | None = Field(default=None, ge=1, le=247, strict=True)
    name: MachineName | None = None
    brand: ShortText | None = None
    model: ShortText | None = None
    ideal_cycle_s: float | None = Field(default=None, ge=0.1, le=3600, allow_inf_nan=False)
    is_active: bool | None = None
