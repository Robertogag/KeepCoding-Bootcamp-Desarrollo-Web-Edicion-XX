"""Counter and time accounting, independent from persistence and networking."""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta

from app.services.modbus import Registers

STATE_NAMES = {0: "IDLE", 1: "RUNNING", 2: "DOWN"}
DURATION_FIELDS = {"RUNNING": "run_s", "IDLE": "idle_s", "DOWN": "down_s", "OFFLINE": "offline_s"}


def counter_delta(current: int, previous: int | None) -> int:
    """First observation is a baseline. Both reset and wrap use the current value."""
    if previous is None:
        return 0
    return current - previous if current >= previous else current


def iso(value: datetime | None) -> str | None:
    return value.isoformat().replace("+00:00", "Z") if value else None


@dataclass
class Minute:
    machine_id: int
    bucket_start: datetime
    good: int = 0
    reject: int = 0
    run_s: float = 0.0
    idle_s: float = 0.0
    down_s: float = 0.0
    offline_s: float = 0.0


@dataclass(frozen=True)
class Transition:
    state: str
    started_at: datetime
    reason_code: str | None


@dataclass
class MachineRuntime:
    machine_id: int
    state: str | None = None
    since: datetime | None = None
    accounted_at: datetime | None = None
    last_heartbeat: int | None = None
    heartbeat_changed_at: datetime | None = None
    failures: int = 0
    good: int = 0
    reject: int = 0
    alarm_code: int = 0
    last_cycle_s: float | None = None
    baseline_good: int | None = None
    baseline_reject: int | None = None
    minutes: dict[datetime, Minute] = field(default_factory=dict)
    transitions: list[Transition] = field(default_factory=list)
    samples: list[dict] = field(default_factory=list)
    telemetry: list[dict] = field(default_factory=list)

    def minute(self, at: datetime) -> Minute:
        start = at.replace(second=0, microsecond=0)
        if start not in self.minutes:
            self.minutes[start] = Minute(self.machine_id, start)
        return self.minutes[start]

    def account_until(self, now: datetime) -> None:
        if self.accounted_at is not None and self.state is not None:
            cursor = self.accounted_at
            while cursor < now:
                bucket = self.minute(cursor)
                end = min(now, bucket.bucket_start + timedelta(minutes=1))
                column = DURATION_FIELDS[self.state]
                setattr(bucket, column, getattr(bucket, column) + (end - cursor).total_seconds())
                cursor = end
        self.accounted_at = now

    def change_state(self, state: str, now: datetime, reason_code: str | None = None) -> None:
        if state != self.state:
            self.state = state
            self.since = now
            self.transitions.append(Transition(state, now, reason_code))

    def observe(self, registers: Registers | None, now: datetime) -> None:
        self.account_until(now)
        if registers is None:
            self.failures += 1
            if self.failures >= 3 or self.heartbeat_stale(now):
                self.change_state("OFFLINE", now)
            return

        self.failures = 0
        if registers.heartbeat != self.last_heartbeat:
            self.heartbeat_changed_at = now
            self.last_heartbeat = registers.heartbeat
        good = counter_delta(registers.good_count, self.baseline_good)
        reject = counter_delta(registers.reject_count, self.baseline_reject)
        self.baseline_good = self.good = registers.good_count
        self.baseline_reject = self.reject = registers.reject_count
        self.alarm_code = registers.alarm_code
        self.last_cycle_s = registers.last_cycle_ds / 10 if registers.last_cycle_ds else None
        if good or reject:
            bucket = self.minute(now)
            bucket.good += good
            bucket.reject += reject
            self.samples.append(
                {
                    "machine_id": self.machine_id,
                    "sampled_at": now,
                    "good": good,
                    "reject": reject,
                }
            )
        target = "OFFLINE" if self.heartbeat_stale(now) else STATE_NAMES[registers.state]
        self.change_state(target, now, str(registers.alarm_code) if registers.alarm_code else None)

    def heartbeat_stale(self, now: datetime) -> bool:
        return (
            self.heartbeat_changed_at is not None
            and (now - self.heartbeat_changed_at).total_seconds() >= 5
        )

    def snapshot_base(self) -> dict:
        return {
            "state": self.state or "OFFLINE",
            "since": iso(self.since),
            "good": self.good,
            "reject": self.reject,
            "alarm_code": self.alarm_code,
            "last_cycle_s": self.last_cycle_s,
        }

    def snapshot(self, oee_today: dict) -> dict:
        return {**self.snapshot_base(), "oee_today": oee_today}

    def checkpoint(self) -> dict:
        return {
            "state": self.state,
            "since": iso(self.since),
            "good": self.good,
            "reject": self.reject,
            "alarm_code": self.alarm_code,
            "last_cycle_s": self.last_cycle_s,
            "last_heartbeat": self.last_heartbeat,
            "heartbeat_changed_at": iso(self.heartbeat_changed_at),
            "accounted_at": iso(self.accounted_at),
        }

    def restore_display(self, data: dict) -> None:
        """Preserve the last displayed values, but baseline anew after a process restart."""
        self.good = int(data.get("good", 0))
        self.reject = int(data.get("reject", 0))
        self.alarm_code = int(data.get("alarm_code", 0))
        self.last_cycle_s = data.get("last_cycle_s")
        # Heartbeat history is intentionally not restored: the first current reading is fresh.

    def restore_gap(self, data: dict, now: datetime) -> None:
        """Mark the unsupervised interval OFFLINE rather than extending a RUNNING event."""
        raw = data.get("accounted_at")
        if not raw or not self.state or not self.since:
            return
        last_observed = datetime.fromisoformat(raw)
        if last_observed.tzinfo is None or not self.since <= last_observed <= now:
            return
        self.accounted_at = last_observed
        self.change_state("OFFLINE", last_observed)
        self.account_until(now)

    def persisted(self) -> None:
        self.minutes.clear()
        self.transitions.clear()
        self.samples.clear()
        self.telemetry.clear()

    def minute_rows(self) -> list[dict]:
        return [asdict(minute) for minute in self.minutes.values()]
