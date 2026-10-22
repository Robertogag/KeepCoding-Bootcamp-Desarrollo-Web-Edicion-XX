import asyncio
import random
import socket
import struct
import sys
from pathlib import Path

import httpx
import pytest
from pymodbus.client import AsyncModbusTcpClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from oee_simulator.engine import (
    MachineProfile,
    Profiles,
    SimulatedMachine,
    load_config,
    load_profiles,
)
from oee_simulator.main import create_app

CONFIG = Path(__file__).resolve().parents[1] / "machines.yaml"


def fast_machine(**changes):
    parameters = dict(
        unit_id=1,
        name="Test",
        ideal_cycle_s=0.1,
        cycle_jitter=0,
        scrap_rate=0,
        mtbf_min=1e20,
        mttr_min=1,
        micro_stop_prob=0,
        idle_prob=0,
    )
    parameters.update(changes)
    return SimulatedMachine(MachineProfile(**parameters), random.Random(42))


def test_eight_valid_profiles_and_register_map():
    assert [p.unit_id for p in load_profiles(CONFIG)] == list(range(1, 9))
    machine = fast_machine()
    machine.good_count = 65538
    machine.reject_count = 131075
    assert machine.registers() == [1, 1, 2, 2, 3, 0, 0, 0, 1]


def test_production_scrap_reset_and_unsigned_wrap():
    machine = fast_machine()
    machine.good_count = 0xFFFFFFFF
    machine.advance(0.1)
    assert machine.good_count == 0
    machine.heartbeat = 65535
    machine.advance(0.9)
    assert machine.heartbeat == 0
    assert machine.good_count == 9
    machine.reset_counters()
    assert machine.good_count == machine.reject_count == 0
    reject_machine = fast_machine(scrap_rate=1)
    reject_machine.reject_count = 0xFFFFFFFF
    reject_machine.advance(0.1)
    assert reject_machine.reject_count == 0
    reject_machine.advance(0.2)
    assert reject_machine.good_count == 0 and reject_machine.reject_count == 2


def test_fault_stops_production_and_recovers_and_disconnect_freezes_heartbeat():
    machine = fast_machine()
    machine.fault(3, 1)
    machine.advance(0.5)
    assert machine.state == 2 and machine.alarm_code == 3 and machine.good_count == 0
    machine.advance(0.5)
    assert machine.state == 1 and machine.alarm_code == 0
    machine.disconnect(1)
    heartbeat = machine.heartbeat
    machine.advance(0.9)
    assert machine.heartbeat == heartbeat and machine.good_count > 0


@pytest.mark.parametrize("cavities", [1, 2, 4])
def test_injection_shots_produce_cavity_pieces_and_process_map_has_explicit_units(cavities):
    config = load_config(CONFIG)
    profile = fast_machine(active_cavities=cavities).profile
    machine = SimulatedMachine(
        profile, random.Random(42), config.process_variables, config.map_version
    )
    assert machine.snapshot()["process_values"]["filling_time_s"] is None
    machine.advance(0.3)
    assert machine.shot_count == 3
    assert machine.good_count + machine.reject_count == machine.shot_count * cavities
    assert machine.snapshot()["map_version"] == "injection-demo-v1"
    registers = machine.registers()
    assert len(registers) == 32 and registers[31] == cavities and registers[29:31] == [0, 3]
    for variable in config.process_variables:
        if variable.data_type == "float32":
            raw = b"".join(
                word.to_bytes(2, "big")
                for word in registers[variable.address : variable.address + 2]
            )
            assert struct.unpack(">f", raw)[0] > 0
    rejected = fast_machine(active_cavities=cavities, scrap_rate=1)
    rejected.advance(0.3)
    assert rejected.reject_count == rejected.shot_count * cavities and rejected.good_count == 0


def test_process_map_rejects_overlapping_words():
    config = load_config(CONFIG).model_dump()
    config["process_variables"][1]["address"] = 10
    with pytest.raises(ValueError, match="register ranges"):
        Profiles.model_validate(config)


@pytest.mark.asyncio
async def test_real_tcp_all_units_and_http_fault_disconnect_reset():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    application = create_app(CONFIG, modbus_host="127.0.0.1", modbus_port=port, seed=42)
    async with application.router.lifespan_context(application):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=application), base_url="http://simulator"
        ) as http:
            assert (await http.get("/health")).status_code == 200
            assert len((await http.get("/machines")).json()["items"]) == 8
            client = AsyncModbusTcpClient("127.0.0.1", port=port, timeout=1, retries=0)
            try:
                assert await client.connect()
                for unit in range(1, 9):
                    response = await client.read_holding_registers(0, count=9, device_id=unit)
                    assert not response.isError()
                    assert len(response.registers) == 9 and response.registers[0] == 1
                    assert response.registers[8] == round(
                        load_profiles(CONFIG)[unit - 1].ideal_cycle_s * 10
                    )
                    extended = await client.read_holding_registers(9, count=23, device_id=unit)
                    assert not extended.isError()
                    assert extended.registers[-1] == load_profiles(CONFIG)[unit - 1].active_cavities
                fault = await http.post(
                    "/machines/1/fault", json={"alarm_code": 3, "duration_s": 0.3}
                )
                assert fault.status_code == 200
                response = await client.read_holding_registers(0, count=9, device_id=1)
                assert response.registers[0] == 2 and response.registers[5] == 3
                await asyncio.sleep(0.5)
                response = await client.read_holding_registers(0, count=9, device_id=1)
                assert response.registers[0] == 1 and response.registers[5] == 0
                await http.post("/machines/1/disconnect", json={"duration_s": 1.5})
                before = (await client.read_holding_registers(0, count=9, device_id=1)).registers
                await asyncio.sleep(1.1)
                after = (await client.read_holding_registers(0, count=9, device_id=1)).registers
                assert before == after
                machine = application.state.simulation.machines[2]
                machine.good_count, machine.reject_count = 100, 10
                application.state.simulation.write(2)
                assert (await http.post("/machines/2/reset-counters")).status_code == 200
                reset = (await client.read_holding_registers(0, count=9, device_id=2)).registers
                assert reset[1:5] == [0, 0, 0, 0]
                assert (await http.post("/machines/99/fault", json={})).status_code == 404
                assert (
                    await http.post("/machines/1/disconnect", json={"duration_s": -1})
                ).status_code == 422
            finally:
                client.close()
