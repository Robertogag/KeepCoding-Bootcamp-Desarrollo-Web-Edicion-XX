"""Explicit units: shot cycle seconds, piece grams, material kilograms."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
)

from app.schemas.common import Input

Code = Annotated[
    str,
    StringConstraints(pattern=r"^[A-Z0-9][A-Z0-9_.-]{0,63}$"),
    BeforeValidator(lambda value: value.strip().upper() if isinstance(value, str) else value),
]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Weight = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=4)]
Kilograms = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=4)]
Cycle = Annotated[Decimal, Field(gt=0, le=3600, max_digits=10, decimal_places=4)]
PositiveId = Annotated[int, Field(gt=0, strict=True)]


class CatalogCreate(Input):
    code: Code
    name: Name
    is_active: bool = True


class ProductCreate(CatalogCreate):
    part_weight_g: Weight
    description: str = Field(default="", max_length=2000)


class MoldCreate(CatalogCreate):
    nominal_cavities: int = Field(gt=0, le=1024, strict=True)


class ResinCreate(CatalogCreate):
    polymer: str = Field(min_length=1, max_length=40)
    grade: str = Field(min_length=1, max_length=80)
    manufacturer: str = Field(default="", max_length=120)


class EmployeeCreate(CatalogCreate):
    user_id: PositiveId | None = None


class ResinLotCreate(Input):
    resin_id: PositiveId
    lot_code: str = Field(min_length=1, max_length=80)
    received_kg: Kilograms


class RecipeCreate(CatalogCreate):
    product_id: PositiveId
    mold_id: PositiveId
    resin_id: PositiveId
    ideal_cycle_s: Cycle
    active_cavities: int = Field(gt=0, le=1024, strict=True)


class OrderCreate(Input):
    code: Code
    recipe_id: PositiveId
    target_pieces: int = Field(gt=0, le=2_000_000_000, strict=True)


class OrderPatch(Input):
    status: Literal["planned", "completed", "cancelled"]


class RunStart(Input):
    order_id: PositiveId
    active_cavities: int | None = Field(default=None, gt=0, le=1024, strict=True)


class MaterialCreate(Input):
    resin_lot_id: PositiveId
    consumed_kg: Kilograms


class EmployeeAssignment(Input):
    employee_id: PositiveId
    role: Literal["operator", "technician", "quality", "supervisor"] = "operator"


class DowntimeStart(Input):
    reason_code: str = Field(min_length=1, max_length=32)
    planned: bool = False
    comment: str = Field(default="", max_length=500)


class MachineLine(Input):
    line_id: PositiveId | None


class VariableCreate(Input):
    code: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    name: Name
    unit: str = Field(min_length=1, max_length=24)
    address: int = Field(ge=9, le=65534, strict=True)
    data_type: Literal["uint16", "int16", "uint32", "int32", "float32"]
    word_order: Literal["big", "little"] = "big"
    byte_order: Literal["big", "little"] = "big"
    scale: float = Field(default=1, allow_inf_nan=False)
    offset: float = Field(default=0, allow_inf_nan=False)
    is_active: bool = True
    map_version: str = Field(default="custom-v1", min_length=1, max_length=64)

    @field_validator("scale")
    @classmethod
    def nonzero(cls, value):
        if value == 0:
            raise ValueError("Scale cannot be zero")
        return value

    @field_validator("code")
    @classmethod
    def reserved(cls, value):
        if value in {
            "state",
            "good_count",
            "reject_count",
            "alarm_code",
            "cycle_time_s",
            "heartbeat",
            "ideal_cycle_s",
        }:
            raise ValueError("Reserved base-map variable")
        return value


class OperationFilters(Input):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    start: AwareDatetime | None = Field(default=None, alias="from")
    end: AwareDatetime | None = Field(default=None, alias="to")

    @field_validator("start", "end")
    @classmethod
    def utc_datetime(cls, value):
        return value.astimezone(UTC) if value is not None else None

    @field_validator("end")
    @classmethod
    def increasing_interval(cls, value, info):
        start = info.data.get("start")
        if value is not None and start is not None and value <= start:
            raise ValueError("to must be after from")
        return value


class LotFilters(OperationFilters):
    resin_id: int | None = Field(default=None, gt=0)


class OrderFilters(OperationFilters):
    status: Literal["planned", "running", "completed", "cancelled"] | None = None


class RunFilters(OperationFilters):
    machine_id: int | None = Field(default=None, gt=0)
    line_id: int | None = Field(default=None, gt=0)
    order_id: int | None = Field(default=None, gt=0)
    open: bool | None = None


class DowntimeFilters(OperationFilters):
    line_id: int | None = Field(default=None, gt=0)
    machine_id: int | None = Field(default=None, gt=0)
    open: bool | None = None


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page[Item](Output):
    items: list[Item]
    page: int
    page_size: int
    total: int
    has_next: bool
    has_prev: bool


class ConflictDetail(Output):
    code: Literal["RESOURCE_CONFLICT"]
    field: str | None = None


class ConflictError(Output):
    error: ConflictDetail


class CatalogOut(Output):
    id: int
    plant_id: int
    code: str
    name: str
    is_active: bool
    created_at: datetime


class ProductOut(CatalogOut):
    part_weight_g: float
    description: str


class MoldOut(CatalogOut):
    nominal_cavities: int


class ResinOut(CatalogOut):
    polymer: str
    grade: str
    manufacturer: str


class EmployeeOut(CatalogOut):
    user_id: int | None


class RecipeOut(CatalogOut):
    product_id: int
    mold_id: int
    resin_id: int
    ideal_cycle_s: float
    active_cavities: int


class ResinLotOut(Output):
    id: int
    plant_id: int
    resin_id: int
    lot_code: str
    received_kg: float
    received_at: datetime


class OrderOut(Output):
    id: int
    plant_id: int
    code: str
    recipe_id: int
    target_pieces: int
    status: Literal["planned", "running", "completed", "cancelled"]
    created_at: datetime


class RunContext(Output):
    recipe_id: int
    recipe_code: str
    product_id: int
    product_code: str
    product_name: str
    mold_code: str
    mold_name: str | None = None
    resin_id: int
    resin_code: str
    resin_name: str | None = None
    polymer: str
    grade: str
    counter_unit: Literal["pieces"]
    cycle_unit: Literal["seconds_per_shot"]
    line_id: int | None = None
    line_code: str | None = None
    line_name: str | None = None


class RunOut(Output):
    id: int
    plant_id: int
    order_id: int
    machine_id: int
    mold_id: int
    context: RunContext
    nominal_cavities: int
    active_cavities: int
    ideal_cycle_s: float
    part_weight_g: float
    started_by: int | None
    ended_by: int | None
    started_at: datetime
    ended_at: datetime | None


class MaterialOut(Output):
    id: int
    plant_id: int
    run_id: int
    resin_lot_id: int
    consumed_kg: float
    recorded_at: datetime
    recorded_by: int | None


class EmployeeAssignmentOut(Output):
    id: int
    plant_id: int
    run_id: int
    employee_id: int
    role: Literal["operator", "technician", "quality", "supervisor"]
    started_at: datetime
    ended_at: datetime | None


class LineDowntimeOut(Output):
    id: int
    plant_id: int
    line_id: int
    reason_code: str
    planned: bool
    comment: str
    started_at: datetime
    ended_at: datetime | None
    created_by: int | None
    ended_by: int | None
    affected_machine_ids: list[int]


class MachineLineOut(Output):
    machine_id: int
    line_id: int | None


class VariableOut(Output):
    id: int
    machine_id: int
    code: str
    name: str
    unit: str
    address: int
    data_type: Literal["uint16", "int16", "uint32", "int32", "float32"]
    word_order: Literal["big", "little"]
    byte_order: Literal["big", "little"]
    scale: float
    offset: float
    is_active: bool
    map_version: str


class TelemetryMapping(Output):
    id: int
    code: str
    unit: str
    address: int
    data_type: Literal["uint16", "int16", "uint32", "int32", "float32"]
    word_order: Literal["big", "little"]
    byte_order: Literal["big", "little"]
    scale: float
    offset: float
    map_version: str = "custom-v1"


class MeasurementOut(Output):
    value: float | None
    unit: str
    quality: Literal["good", "bad", "stale", "unavailable"]
    raw: int | list[int] | None
    map_version: str | None = None
    mapping: TelemetryMapping | None = None


class TelemetryOut(Output):
    machine_id: int
    sampled_at: datetime
    run_id: int | None
    source: str
    values: dict[str, MeasurementOut]


class TraceabilityOut(Output):
    run: RunOut
    materials: list[MaterialOut]
    employees: list[EmployeeAssignmentOut]
    ideal_seconds_per_piece: float


class ProductionContextOut(Output):
    run: RunOut | None
    ideal_seconds_per_piece: float | None
