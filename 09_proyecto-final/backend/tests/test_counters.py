from datetime import UTC, datetime, timedelta

import pytest

from app.collector.state import MachineRuntime, counter_delta
from app.services.modbus import ModbusReadError, Registers


@pytest.mark.parametrize(
    ("current", "previous", "expected"),
    [
        (1520, None, 0),
        (1520, 1517, 3),
        (1520, 1520, 0),
        (7, 1520, 7),
        (2, 0xFFFFFFFF, 2),
        (0, 0xFFFFFFFF, 0),
    ],
)
def test_counter_baseline_increment_reset_and_wrap(current, previous, expected):
    assert counter_delta(current, previous) == expected


def test_registers_decode_big_endian_unsigned_counters():
    decoded = Registers.decode([1, 0xFFFF, 0xFFFF, 1, 2, 3, 284, 65535, 280])
    assert decoded.good_count == 0xFFFFFFFF
    assert decoded.reject_count == 65538
    assert decoded.last_cycle_ds == 284
    assert decoded.heartbeat == 65535


@pytest.mark.parametrize("words", [[0] * 8, [3] + [0] * 8, [1, 65536] + [0] * 7])
def test_invalid_registers_are_read_failures(words):
    with pytest.raises(ModbusReadError):
        Registers.decode(words)


def test_counter_deltas_are_sampled_at_observation_and_baseline_is_not_production():
    runtime = MachineRuntime(1)
    start = datetime(2026, 10, 21, 12, 0, 59, 500000, tzinfo=UTC)
    runtime.observe(Registers(1, 100, 5, 0, 100, 1, 100), start)
    runtime.observe(Registers(1, 103, 6, 0, 100, 2, 100), start + timedelta(seconds=1))
    assert len(runtime.samples) == 1
    assert runtime.samples[0]["good"] == 3
    assert runtime.samples[0]["reject"] == 1
    assert runtime.samples[0]["sampled_at"] == start + timedelta(seconds=1)
    minutes = sorted(runtime.minutes.values(), key=lambda minute: minute.bucket_start)
    assert [minute.run_s for minute in minutes] == [0.5, 0.5]
    assert [minute.good for minute in minutes] == [0, 3]


def test_reset_does_not_turn_into_a_negative_or_uint32_delta():
    runtime = MachineRuntime(1)
    now = datetime(2026, 10, 21, tzinfo=UTC)
    runtime.observe(Registers(1, 500, 20, 0, 100, 1, 100), now)
    runtime.observe(Registers(1, 3, 1, 0, 100, 2, 100), now + timedelta(seconds=1))
    assert runtime.samples[0]["good"] == 3
    assert runtime.samples[0]["reject"] == 1
