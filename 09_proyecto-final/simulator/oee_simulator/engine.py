"""Independent, seedable machine state machines; no network or wall clock required."""

import math
import random
import struct
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator


class MachineProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    unit_id: int = Field(ge=1, le=247)
    name: str = Field(min_length=1, max_length=120)
    ideal_cycle_s: float = Field(gt=0, le=6553.5)
    cycle_jitter: float = Field(ge=0, le=1)
    scrap_rate: float = Field(ge=0, le=1)
    mtbf_min: float = Field(gt=0)
    mttr_min: float = Field(gt=0)
    micro_stop_prob: float = Field(ge=0, le=1)
    idle_prob: float = Field(ge=0, le=1)
    active_cavities: int = Field(default=1, ge=1, le=1024)


class ProcessVariable(BaseModel):
    """Explicit simulation map; these are not addresses or units from a real PLC."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    code: str
    name: str
    unit: str
    address: int = Field(ge=9, le=65534)
    data_type: str = Field(default="float32", pattern="^(float32|uint32|uint16)$")
    baseline: float | None = None
    cycle_fraction: float | None = Field(default=None, gt=0, le=1)

    @model_validator(mode="after")
    def known_generator(self):
        if self.data_type == "float32" and self.baseline is None and self.cycle_fraction is None:
            raise ValueError("A simulated float requires a baseline or cycle fraction")
        if self.data_type != "float32" and self.code not in {"shot_count", "active_cavities"}:
            raise ValueError("Only shot_count and active_cavities have integer generators")
        return self

    @property
    def width(self):
        return 1 if self.data_type == "uint16" else 2


class Profiles(BaseModel):
    model_config = ConfigDict(extra="forbid")
    machines: list[MachineProfile] = Field(min_length=1)
    map_version: str = "custom-v1"
    process_variables: list[ProcessVariable] = Field(default_factory=list)

    @model_validator(mode="after")
    def unique_units(self):
        units = [machine.unit_id for machine in self.machines]
        if len(set(units)) != len(units):
            raise ValueError("Each machine must have a distinct unit_id")
        addresses = set()
        codes = set()
        for variable in self.process_variables:
            occupied = set(range(variable.address, variable.address + variable.width))
            if addresses & occupied or variable.code in codes:
                raise ValueError("Process variable codes and register ranges must be unique")
            addresses.update(occupied)
            codes.add(variable.code)
        return self


def load_profiles(path: Path) -> list[MachineProfile]:
    return load_config(path).machines


def load_config(path: Path) -> Profiles:
    return Profiles.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))


class SimulatedMachine:
    def __init__(
        self, profile: MachineProfile, rng: random.Random, variables=(), map_version="custom-v1"
    ):
        self.profile = profile
        self.rng = rng
        self.state = 1
        self.good_count = 0
        self.reject_count = 0
        self.shot_count = 0
        self.variables = tuple(variables)
        self.map_version = map_version
        self.process_values = {variable.code: math.nan for variable in self.variables}
        self.alarm_code = 0
        self.last_cycle_ds = 0
        self.heartbeat = 0
        self.heartbeat_elapsed = 0.0
        self.cycle_elapsed = 0.0
        self.cycle_target = self._new_cycle()
        self.stop_remaining = 0.0
        self.disconnect_remaining = 0.0

    def _new_cycle(self) -> float:
        # Cycles can be faster or slower; the OEE calculation caps performance.
        return max(
            0.1,
            self.rng.gauss(
                self.profile.ideal_cycle_s, self.profile.ideal_cycle_s * self.profile.cycle_jitter
            ),
        )

    @property
    def disconnected(self) -> bool:
        return self.disconnect_remaining > 0

    def fault(self, alarm_code: int, duration_s: float) -> None:
        self.state = 2
        self.alarm_code = alarm_code
        self.stop_remaining = duration_s

    def disconnect(self, duration_s: float) -> None:
        self.disconnect_remaining = duration_s

    def reset_counters(self) -> None:
        self.good_count = self.reject_count = 0
        self.shot_count = 0

    def advance(self, elapsed: float) -> None:
        """Small steps keep the stochastic process consistent across tick delays."""
        while elapsed > 1e-9:
            step = min(elapsed, 0.1)
            self._step(step)
            elapsed -= step

    def _step(self, elapsed: float) -> None:
        was_disconnected = self.disconnected
        self.disconnect_remaining = max(0.0, self.disconnect_remaining - elapsed)
        if not was_disconnected:
            self.heartbeat_elapsed += elapsed
            beats = int(self.heartbeat_elapsed + 1e-9)
            self.heartbeat = (self.heartbeat + beats) & 0xFFFF
            self.heartbeat_elapsed -= beats

        if self.state != 1:
            self.stop_remaining = max(0.0, self.stop_remaining - elapsed)
            if self.stop_remaining <= 1e-9:
                self.state = 1
                self.alarm_code = 0
            return

        if self.rng.random() < -math.expm1(-elapsed / (self.profile.mtbf_min * 60)):
            self.fault(
                self.rng.randint(1, 12),
                max(1, self.rng.expovariate(1 / (self.profile.mttr_min * 60))),
            )
            return

        self.cycle_elapsed += elapsed
        if self.cycle_elapsed + 1e-9 < self.cycle_target:
            return

        self.last_cycle_ds = min(65535, max(1, round(self.cycle_target * 10)))
        rejected = sum(
            self.rng.random() < self.profile.scrap_rate for _ in range(self.profile.active_cavities)
        )
        self.reject_count = (self.reject_count + rejected) & 0xFFFFFFFF
        self.good_count = (self.good_count + self.profile.active_cavities - rejected) & 0xFFFFFFFF
        self.shot_count = (self.shot_count + 1) & 0xFFFFFFFF
        for variable in self.variables:
            if variable.data_type != "float32":
                continue
            baseline = (
                self.cycle_target * variable.cycle_fraction
                if variable.cycle_fraction is not None
                else variable.baseline
            )
            if baseline is not None:
                self.process_values[variable.code] = max(
                    0.0, self.rng.gauss(baseline, abs(baseline) * 0.015)
                )
        self.cycle_elapsed = 0.0
        self.cycle_target = self._new_cycle()
        if self.rng.random() < self.profile.micro_stop_prob:
            self.fault(self.rng.randint(1, 12), self.rng.uniform(2, 15))
        elif self.rng.random() < self.profile.idle_prob:
            self.state = 0
            self.alarm_code = 0
            self.stop_remaining = self.rng.uniform(15, 90)

    def registers(self) -> list[int]:
        values = [
            self.state,
            (self.good_count >> 16) & 0xFFFF,
            self.good_count & 0xFFFF,
            (self.reject_count >> 16) & 0xFFFF,
            self.reject_count & 0xFFFF,
            self.alarm_code,
            self.last_cycle_ds,
            self.heartbeat,
            min(65535, max(1, round(self.profile.ideal_cycle_s * 10))),
        ]
        if self.variables:
            values.extend([0] * (max(v.address + v.width for v in self.variables) - len(values)))
        for variable in self.variables:
            value = self.process_values[variable.code]
            if variable.code == "shot_count":
                value = self.shot_count
            elif variable.code == "active_cavities":
                value = self.profile.active_cavities
            format_code = {"float32": ">f", "uint32": ">I", "uint16": ">H"}[variable.data_type]
            raw = struct.pack(format_code, value)
            words = [
                int.from_bytes(raw[index : index + 2], "big") for index in range(0, len(raw), 2)
            ]
            values[variable.address : variable.address + variable.width] = words
        return values

    def snapshot(self) -> dict:
        return {
            "unit_id": self.profile.unit_id,
            "name": self.profile.name,
            "state": self.state,
            "good_count": self.good_count,
            "reject_count": self.reject_count,
            "shot_count": self.shot_count,
            "active_cavities": self.profile.active_cavities,
            "counter_unit": "pieces",
            "cycle_unit": "seconds_per_shot",
            "source": "simulator",
            "map_version": self.map_version,
            "process_values": {
                code: self.shot_count
                if code == "shot_count"
                else self.profile.active_cavities
                if code == "active_cavities"
                else value
                if math.isfinite(value)
                else None
                for code, value in self.process_values.items()
            },
            "alarm_code": self.alarm_code,
            "last_cycle_ds": self.last_cycle_ds,
            "heartbeat": self.heartbeat,
            "ideal_cycle_ds": self.registers()[8],
            "disconnected": self.disconnected,
            "disconnect_remaining_s": round(self.disconnect_remaining, 2),
        }
