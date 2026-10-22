from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.responses import Count, OeeMetrics, Output, PlantContext, Snapshot


class BoardPosition(Output):
    x: float
    y: float
    width: float
    height: float
    rotation: Literal[0, 90, 180, 270]
    updated_at: datetime


class BoardLine(Output):
    id: int
    code: str
    name: str
    is_active: bool


class BoardRun(Output):
    id: int
    order_id: int
    order_code: str
    product_id: int
    product_code: str
    product_name: str
    mold_id: int
    mold_code: str
    mold_name: str | None
    nominal_cavities: int
    active_cavities: int
    ideal_cycle_s: float
    ideal_seconds_per_piece: float
    started_at: datetime


class BoardMachine(Output):
    id: int
    name: str
    slug: str
    brand: str
    model: str
    is_active: bool
    line_id: int | None
    position: BoardPosition | None
    snapshot: Snapshot
    observed_at: datetime | None
    current_run: BoardRun | None


class BoardStates(Output):
    RUNNING: Count
    IDLE: Count
    DOWN: Count
    OFFLINE: Count


class BoardSummary(Output):
    machine_count: Count
    active_machine_count: Count
    states: BoardStates
    active_runs: Count
    without_active_run: Count
    line_stops: Count
    oee_today: OeeMetrics


class BoardStop(Output):
    kind: Literal["line", "machine"]
    id: int | None
    line_id: int | None
    machine_id: int | None
    affected_machine_ids: list[int]
    started_at: datetime | None
    elapsed_s: float | None = Field(ge=0)
    reason_code: str | None
    label_es: str | None
    label_en: str | None
    planned: bool | None
    comment: str | None


class PlantBoard(Output):
    generated_at: datetime
    plant: PlantContext
    scheduled_now: bool
    summary: BoardSummary
    lines: list[BoardLine]
    machines: list[BoardMachine]
    stops: list[BoardStop]
