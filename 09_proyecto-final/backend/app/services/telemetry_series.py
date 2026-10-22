"""SQL aggregation of stored measurements, never reinterpretation using today's map.

PostgreSQL performs JSON extraction, grouping and first/last selection. The SQLite
branch uses the same semantics for isolated tests. Python receives at most 24,001
aggregate rows, rejects excess output, and only fills bounded empty buckets.
"""

import hashlib
import json
import math
from datetime import UTC, datetime, timedelta

from sqlalchemy import bindparam, text

from app.errors import ApiError
from app.models.types import UTCDateTime
from app.schemas.telemetry import (
    MAX_TOTAL_POINTS,
    QualityCounts,
    TelemetryBucket,
    TelemetrySeries,
    TelemetrySeriesOut,
    TelemetrySeriesQuery,
)

FRIENDLY_SECONDS = (1, 5, 10, 30, 60, 300, 900, 1800, 3600, 21600, 43200, 86400, 604800)
MAPPING_FIELDS = ("id", "address", "data_type", "word_order", "byte_order", "scale", "offset")
QUALITIES = ("good", "bad", "stale", "unavailable", "missing")


def bucket_size(filters: TelemetrySeriesQuery) -> tuple[int, int]:
    duration = (filters.end - filters.start).total_seconds()
    required = max(1, math.ceil(duration / filters.max_points))
    width = filters.bucket_s or next(size for size in FRIENDLY_SECONDS if size >= required)
    count = math.ceil(duration / width)
    if count > filters.max_points:
        raise ApiError(422, "VALIDATION_ERROR", "bucket_s")
    return width, count


def _sql(dialect: str, code_count: int, with_run: bool) -> str:
    """Only trusted dialect fragments and generated parameter names enter SQL text."""
    requested = ",".join(f"(CAST(:code_{index} AS TEXT))" for index in range(code_count))
    run_filter = "AND t.run_id = :run_id" if with_run else ""
    partition = "code, unit, map_version, mapping_json, bucket_index"
    if dialect == "postgresql":
        measurement = 't."values" -> requested.code'
        bucket = "CAST(FLOOR(EXTRACT(EPOCH FROM (t.sampled_at - :start)) / :bucket_s) AS BIGINT)"
        unit = "m ->> 'unit'"
        version = "COALESCE(m #>> '{mapping,map_version}', m ->> 'map_version')"
        mapping_fields = ", ".join(f"'{key}', m #> '{{mapping,{key}}}'" for key in MAPPING_FIELDS)
        mapping = (
            "CASE WHEN jsonb_typeof(m -> 'mapping') = 'object' THEN "
            f"CAST(jsonb_build_object({mapping_fields}) AS TEXT) END"
        )
        kind = "jsonb_typeof(m)"
        quality = "m ->> 'quality'"
        number = (
            "CASE WHEN jsonb_typeof(m -> 'value') = 'number' THEN "
            "CASE WHEN ABS(CAST(m ->> 'value' AS NUMERIC)) <= 1.7976931348623157e308 "
            "THEN CAST(m ->> 'value' AS NUMERIC) END END"
        )
        average = "AVG(CASE WHEN quality = 'good' THEN reading_value END)"
    elif dialect == "sqlite":
        measurement = "t.\"values\" -> ('$.' || requested.code)"
        # ORM SQLite timestamps have fixed six-digit microseconds. Avoid julianday's
        # floating-point boundary errors (e.g. a sample one microsecond before a bucket).
        bucket = (
            "CAST((CAST(strftime('%s', substr(t.sampled_at, 1, 19)) AS INTEGER) * 1000000 "
            "+ CAST(substr(t.sampled_at, 21, 6) AS INTEGER) - :start_us) "
            "/ (:bucket_s * 1000000) AS INTEGER)"
        )
        unit = "json_extract(m, '$.unit')"
        version = (
            "COALESCE(json_extract(m, '$.mapping.map_version'), json_extract(m, '$.map_version'))"
        )
        mapping_fields = ", ".join(
            f"'{key}', json_extract(m, '$.mapping.{key}')" for key in MAPPING_FIELDS
        )
        mapping = (
            f"CASE WHEN json_type(m, '$.mapping') = 'object' THEN json_object({mapping_fields}) END"
        )
        kind = "json_type(m)"
        quality = "json_extract(m, '$.quality')"
        number = (
            "CASE WHEN json_type(m, '$.value') IN ('integer', 'real') "
            "AND json_extract(m, '$.value') BETWEEN -1.7976931348623157e308 "
            "AND 1.7976931348623157e308 THEN CAST(json_extract(m, '$.value') AS REAL) END"
        )
        # Scaling prevents SQLite AVG's floating sum from overflowing on finite values.
        average = (
            "CASE WHEN MAX(value_scale) = 0 THEN 0 ELSE "
            "AVG(CASE WHEN quality = 'good' THEN reading_value / NULLIF(value_scale, 0) END) "
            "* MAX(value_scale) END"
        )
    else:
        raise RuntimeError("Telemetry series require PostgreSQL (or SQLite in isolated tests)")
    counts = ",\n".join(
        f"SUM(CASE WHEN quality = '{quality}' THEN 1 ELSE 0 END) AS {quality}_count"
        for quality in QUALITIES
    )
    return f"""
        WITH requested(code) AS (VALUES {requested}), measurements AS (
            SELECT requested.code, t.sampled_at, {bucket} AS bucket_index,
                   {measurement} AS m
            FROM machine_telemetry t CROSS JOIN requested
            WHERE t.machine_id = :machine_id AND t.sampled_at >= :start
              AND t.sampled_at < :end {run_filter}
        ), extracted AS (
            SELECT code, sampled_at, bucket_index, {unit} AS unit,
                   {version} AS map_version, {mapping} AS mapping_json,
                   {kind} AS kind, {quality} AS declared_quality,
                   {number} AS reading_value
            FROM measurements
        ), classified AS (
            SELECT *, CASE
                WHEN kind IS NULL OR kind <> 'object' THEN 'missing'
                WHEN declared_quality = 'good' AND reading_value IS NOT NULL THEN 'good'
                WHEN declared_quality = 'good' THEN 'bad'
                WHEN declared_quality IN ('bad','stale','unavailable') THEN declared_quality
                ELSE 'missing' END AS quality
            FROM extracted
        ), ranked AS (
            SELECT *, ROW_NUMBER() OVER (
                PARTITION BY {partition}
                ORDER BY CASE WHEN quality = 'good' THEN 0 ELSE 1 END, sampled_at ASC
            ) AS first_order, ROW_NUMBER() OVER (
                PARTITION BY {partition}
                ORDER BY CASE WHEN quality = 'good' THEN 0 ELSE 1 END, sampled_at DESC
            ) AS last_order,
            MAX(ABS(CASE WHEN quality = 'good' THEN reading_value END))
                OVER (PARTITION BY {partition}) AS value_scale
            FROM classified
        )
        SELECT code, unit, map_version, mapping_json, bucket_index,
               {average} AS avg_value,
               MIN(CASE WHEN quality = 'good' THEN reading_value END) AS min_value,
               MAX(CASE WHEN quality = 'good' THEN reading_value END) AS max_value,
               MAX(CASE WHEN quality = 'good' AND first_order = 1
                   THEN reading_value END) AS first_value,
               MAX(CASE WHEN quality = 'good' AND last_order = 1
                   THEN reading_value END) AS last_value,
               MAX(CASE WHEN quality = 'good' AND first_order = 1 THEN sampled_at END) AS first_at,
               MAX(CASE WHEN quality = 'good' AND last_order = 1 THEN sampled_at END) AS last_at,
               {counts}
        FROM ranked GROUP BY {partition}
        ORDER BY code, unit, map_version, mapping_json, bucket_index
        LIMIT :row_limit
    """


def _aware(value):
    if value is None:
        return None
    instant = datetime.fromisoformat(value) if isinstance(value, str) else value
    return instant.replace(tzinfo=UTC) if instant.tzinfo is None else instant.astimezone(UTC)


def _mapping_key(raw):
    if raw is None:
        return None
    # Reordered JSON properties do not change configuration identity.
    canonical = json.dumps(json.loads(raw), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:24]


async def telemetry_series(session, machine_id: int, filters: TelemetrySeriesQuery):
    width, bucket_count = bucket_size(filters)
    dialect = session.bind.dialect.name
    statement = text(_sql(dialect, len(filters.codes), filters.run_id is not None)).bindparams(
        bindparam("start", type_=UTCDateTime()), bindparam("end", type_=UTCDateTime())
    )
    epoch_delta = filters.start - datetime(1970, 1, 1, tzinfo=UTC)
    parameters = dict(
        machine_id=machine_id,
        start=filters.start,
        end=filters.end,
        bucket_s=width,
        start_us=(epoch_delta.days * 86400 + epoch_delta.seconds) * 1000000
        + epoch_delta.microseconds,
        row_limit=MAX_TOTAL_POINTS + 1,
        **{f"code_{index}": code for index, code in enumerate(filters.codes)},
    )
    if filters.run_id is not None:
        parameters["run_id"] = filters.run_id
    rows = (await session.execute(statement, parameters)).mappings().all()
    if len(rows) > MAX_TOTAL_POINTS:
        raise ApiError(422, "VALIDATION_ERROR", "max_points")
    grouped = {}
    for row in rows:
        key = (row["code"], row["unit"], row["map_version"], row["mapping_json"])
        grouped.setdefault(key, {})[int(row["bucket_index"])] = row
    represented = {key[0] for key in grouped}
    for code in filters.codes:
        if code not in represented:
            grouped[(code, None, None, None)] = {}
    if len(grouped) * bucket_count > MAX_TOTAL_POINTS:
        raise ApiError(422, "VALIDATION_ERROR", "max_points")
    series = []
    code_order = {code: index for index, code in enumerate(filters.codes)}
    for (code, unit, version, mapping), buckets in sorted(
        grouped.items(),
        key=lambda item: (code_order[item[0][0]], *(part or "" for part in item[0][1:])),
    ):
        points = []
        for index in range(bucket_count):
            start = filters.start + timedelta(seconds=index * width)
            values = dict(
                bucket_start=start, bucket_end=min(start + timedelta(seconds=width), filters.end)
            )
            row = buckets.get(index)
            if row is not None:
                for field in ("avg", "min", "max", "first", "last"):
                    raw = row[f"{field}_value"]
                    values[field] = None if raw is None else float(raw)
                values.update(first_at=_aware(row["first_at"]), last_at=_aware(row["last_at"]))
                values["counts"] = QualityCounts(
                    **{quality: row[f"{quality}_count"] for quality in QUALITIES}
                )
            points.append(TelemetryBucket(**values))
        series.append(
            TelemetrySeries(
                code=code,
                unit=unit,
                map_version=version,
                mapping_key=_mapping_key(mapping),
                points=points,
            )
        )
    return TelemetrySeriesOut(
        machine_id=machine_id,
        start=filters.start,
        end=filters.end,
        bucket_s=width,
        max_points=filters.max_points,
        requested_codes=filters.codes,
        run_id=filters.run_id,
        total_points=len(series) * bucket_count,
        series=series,
    )
