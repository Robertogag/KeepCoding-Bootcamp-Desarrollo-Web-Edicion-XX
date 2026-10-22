from datetime import datetime
from typing import Annotated, Literal, NotRequired, TypedDict

from pydantic import BaseModel, ConfigDict, Field, RootModel

Locale = Literal["es", "en"]
Role = Literal["owner", "supervisor", "viewer"]
State = Literal["RUNNING", "IDLE", "DOWN", "OFFLINE"]
AlertType = Literal["MACHINE_DOWN", "MACHINE_OFFLINE", "OEE_BELOW"]
Category = Literal["mecanica", "electrica", "material", "calidad", "organizacional", "otro"]
Ratio = Annotated[float, Field(ge=0, le=1)]
Count = Annotated[int, Field(ge=0)]
Seconds = Annotated[float, Field(ge=0)]
ErrorCode = Literal[
    "RESOURCE_CONFLICT",
    "VALIDATION_ERROR",
    "USERNAME_TAKEN",
    "EMAIL_TAKEN",
    "INVALID_CREDENTIALS",
    "NOT_AUTHENTICATED",
    "FORBIDDEN",
    "NOT_FOUND",
    "INVALID_TOKEN",
    "WRONG_PASSWORD",
    "MODBUS_UNREACHABLE",
    "SLUG_TAKEN",
    "FILE_TOO_LARGE",
    "UNSUPPORTED_FILE",
]


class Output(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Page[T](Output):
    items: list[T]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total: Count
    has_next: bool
    has_prev: bool


class ErrorDetail(TypedDict):
    code: ErrorCode
    field: NotRequired[str]


class ErrorResponse(Output):
    error: ErrorDetail


class UserResponse(Output):
    id: int
    username: str
    email: str
    full_name: str
    language: Locale
    created_at: datetime


class AuthResponse(Output):
    user: UserResponse
    access_token: str


class RefreshResponse(Output):
    access_token: str


class AvailabilityResponse(Output):
    username_available: bool
    email_available: bool


class OeeMetrics(Output):
    availability: Ratio | None
    performance: Ratio | None
    quality: Ratio | None
    oee: Ratio | None


class OeeTotals(OeeMetrics):
    good: Count
    reject: Count
    run_s: Seconds
    planned_s: Seconds


class OeeRow(OeeTotals):
    bucket_start: datetime


class OeeSeries(RootModel[list[OeeRow]]):
    pass


class Snapshot(Output):
    state: State
    since: datetime | None
    good: Count
    reject: Count
    alarm_code: int = Field(ge=0, le=65535)
    last_cycle_s: Seconds | None
    oee_today: OeeMetrics


class Photo(Output):
    sm: str
    md: str
    lg: str


class PlantContext(Output):
    id: int
    slug: str
    name: str
    timezone: str


class PlantResponse(PlantContext):
    is_public: bool
    role: Role
    created_at: datetime
    machine_count: Count
    oee_today: OeeMetrics


class MemberResponse(Output):
    user_id: int
    username: str
    full_name: str
    role: Role


class MachineResponse(Output):
    id: int
    plant_id: int
    line_id: int | None
    slug: str
    name: str
    brand: str
    model: str
    host: str
    port: int
    unit_id: int
    ideal_cycle_s: float
    is_active: bool
    photo: Photo | None
    snapshot: Snapshot
    is_watched: bool
    created_at: datetime


class Registers(Output):
    state: Literal[0, 1, 2]
    good_count: Count
    reject_count: Count
    alarm_code: Count
    last_cycle_ds: Count
    heartbeat: Count
    ideal_cycle_ds: Count


class ConnectionResponse(Output):
    ok: Literal[True]
    latency_ms: Seconds
    registers: Registers


class ShiftResponse(Output):
    id: int
    plant_id: int
    name: str
    start_time: str = Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
    end_time: str = Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")
    days_of_week: list[Annotated[int, Field(ge=1, le=7)]] = Field(min_length=1, max_length=7)


class DowntimeReasonResponse(Output):
    code: str
    label_es: str
    label_en: str
    category: Category


class Classifier(Output):
    id: int
    username: str


class MachineEventResponse(Output):
    id: int
    machine_id: int
    state: State
    reason_code: str | None
    reason: DowntimeReasonResponse | None
    comment: str | None
    classified_by: Classifier | None
    started_at: datetime
    ended_at: datetime | None


class PlantSummaryMachine(OeeTotals):
    machine_id: int
    name: str
    slug: str
    state: State


class PlantSummary(Output):
    plant: OeeTotals
    machines: list[PlantSummaryMachine]


class AlertRuleResponse(Output):
    id: int
    plant_id: int
    machine_id: int | None
    type: AlertType
    threshold: Ratio | None
    duration_s: int
    is_active: bool


class NotificationPayload(TypedDict):
    plant_id: int
    machine_id: int
    machine_name: str
    reason_code: NotRequired[str | None]
    duration_s: NotRequired[int]
    oee: NotRequired[Ratio]
    threshold: NotRequired[Ratio]


class NotificationResponse(Output):
    id: int
    type: AlertType
    created_at: datetime
    read_at: datetime | None
    payload: NotificationPayload


class WatchlistItem(MachineResponse):
    plant: PlantContext


class PublicPlantListItem(PlantContext):
    machine_count: Count
    oee_today: OeeMetrics
    created_at: datetime


class PublicMachine(Output):
    id: int
    slug: str
    name: str
    brand: str
    model: str
    photo: Photo | None
    snapshot: Snapshot


class PublicPlant(PlantContext):
    oee_today: OeeMetrics
    machines: list[PublicMachine]


class PublicMachineDetail(PublicMachine):
    ideal_cycle_s: float
    plant: PlantContext
    trend: list[OeeRow]


class HealthChecks(Output):
    database: bool
    redis: bool


class HealthResponse(Output):
    status: Literal["ok", "unavailable"]
    checks: HealthChecks


class SnapshotMessage(Output):
    type: Literal["machine.snapshot"]
    plant_id: int
    machine_id: int
    snapshot: Snapshot
    ts: datetime


class NotificationMessage(Output):
    type: Literal["notification"]
    notification: NotificationResponse


class PingMessage(Output):
    type: Literal["ping"]


class SubscriptionMessage(Output):
    type: Literal["subscribe", "unsubscribe"]
    plant_id: int
