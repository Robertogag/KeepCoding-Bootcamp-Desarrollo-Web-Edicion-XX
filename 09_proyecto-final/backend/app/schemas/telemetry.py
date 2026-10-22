"""Bounded historical telemetry series, distinct from the raw paginated readings."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator

MAX_RANGE = timedelta(days=31)
MAX_TOTAL_POINTS = 24_000
TelemetryCode = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]{0,63}$")]


class TelemetrySeriesQuery(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    start: AwareDatetime = Field(alias="from")
    end: AwareDatetime = Field(alias="to")
    codes: list[TelemetryCode] = Field(min_length=1, max_length=12)
    max_points: int = Field(default=600, ge=10, le=2000)
    bucket_s: int | None = Field(default=None, ge=1, le=31 * 86400)
    run_id: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def valid_window(self):
        self.start, self.end = self.start.astimezone(UTC), self.end.astimezone(UTC)
        if self.end <= self.start or self.end - self.start > MAX_RANGE:
            raise ValueError("The window must be positive and at most 31 days")
        if len(set(self.codes)) != len(self.codes):
            raise ValueError("codes must be distinct repeated query parameters")
        return self


class QualityCounts(BaseModel):
    good: int = 0
    bad: int = 0
    stale: int = 0
    unavailable: int = 0
    missing: int = 0


class TelemetryBucket(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    bucket_start: datetime
    bucket_end: datetime
    avg: float | None = None
    min: float | None = None
    max: float | None = None
    first: float | None = None
    last: float | None = None
    first_at: datetime | None = None
    last_at: datetime | None = None
    counts: QualityCounts = Field(default_factory=QualityCounts)


class TelemetrySeries(BaseModel):
    code: str
    unit: str | None
    map_version: str | None
    mapping_key: str | None
    points: list[TelemetryBucket]


class TelemetrySeriesOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    machine_id: int
    start: datetime = Field(alias="from")
    end: datetime = Field(alias="to")
    bucket_s: int
    max_points: int
    requested_codes: list[str]
    run_id: int | None
    total_points: int
    series: list[TelemetrySeries]
