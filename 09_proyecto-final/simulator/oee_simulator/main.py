"""HTTP control and the real Modbus TCP server share one asyncio event loop."""

import asyncio
import os
import random
import time
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pymodbus.datastore import ModbusDeviceContext, ModbusSequentialDataBlock, ModbusServerContext
from pymodbus.server import ModbusTcpServer

from .engine import SimulatedMachine, load_config


class DurationControl(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    duration_s: float = Field(default=120, gt=0, le=86400)


class FaultControl(DurationControl):
    alarm_code: int = Field(default=3, ge=1, le=65535)


class Simulator:
    def __init__(self, profile_path: Path, seed: int | None = None):
        config = load_config(profile_path)
        self.machines = {
            p.unit_id: SimulatedMachine(
                p,
                random.Random(None if seed is None else seed + p.unit_id),
                config.process_variables,
                config.map_version,
            )
            for p in config.machines
        }
        self.context = ModbusServerContext(
            devices={
                unit: ModbusDeviceContext(hr=ModbusSequentialDataBlock(1, machine.registers()))
                for unit, machine in self.machines.items()
            },
            single=False,
        )

    def write(self, unit_id: int) -> None:
        machine = self.machines[unit_id]
        if not machine.disconnected:
            # ModbusDeviceContext adds its internal one-based offset; wire addresses start at 0.
            self.context[unit_id].setValues(3, 0, machine.registers())

    async def run(self) -> None:
        previous = time.monotonic()
        while True:
            await asyncio.sleep(0.1)
            now = time.monotonic()
            for unit_id, machine in self.machines.items():
                machine.advance(now - previous)
                self.write(unit_id)
            previous = now


def create_app(
    profile_path: Path | None = None,
    modbus_host: str | None = None,
    modbus_port: int | None = None,
    seed: int | None = None,
) -> FastAPI:
    profile_path = profile_path or Path(
        os.getenv("SIMULATOR_CONFIG", str(Path(__file__).resolve().parents[1] / "machines.yaml"))
    )
    host = modbus_host or os.getenv("SIMULATOR_MODBUS_HOST", "0.0.0.0")
    port = (
        modbus_port if modbus_port is not None else int(os.getenv("SIMULATOR_MODBUS_PORT", "5020"))
    )
    if seed is None and os.getenv("SIMULATOR_SEED"):
        seed = int(os.environ["SIMULATOR_SEED"])

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        simulation = Simulator(profile_path, seed)
        server = ModbusTcpServer(simulation.context, address=(host, port))
        await server.serve_forever(background=True)
        application.state.simulation = simulation
        application.state.modbus_server = server
        tick = asyncio.create_task(simulation.run(), name="simulation")
        application.state.tick_task = tick
        try:
            yield
        finally:
            tick.cancel()
            with suppress(asyncio.CancelledError):
                await tick
            await server.shutdown()

    application = FastAPI(title="OEE Live Simulator", lifespan=lifespan)

    def machine(unit_id: int) -> SimulatedMachine:
        result = application.state.simulation.machines.get(unit_id)
        if result is None:
            raise HTTPException(404, detail={"code": "NOT_FOUND"})
        return result

    @application.get("/health")
    async def health():
        if application.state.tick_task.done() or not application.state.modbus_server.transport:
            raise HTTPException(503, detail={"code": "SIMULATOR_UNAVAILABLE"})
        return {"status": "ok", "machines": len(application.state.simulation.machines)}

    @application.get("/machines")
    async def machines():
        return {
            "items": [item.snapshot() for item in application.state.simulation.machines.values()]
        }

    @application.post("/machines/{unit_id}/fault")
    async def fault(unit_id: int, body: FaultControl):
        current = machine(unit_id)
        current.fault(body.alarm_code, body.duration_s)
        application.state.simulation.write(unit_id)
        return current.snapshot()

    @application.post("/machines/{unit_id}/disconnect")
    async def disconnect(unit_id: int, body: DurationControl):
        current = machine(unit_id)
        current.disconnect(body.duration_s)
        return current.snapshot()

    @application.post("/machines/{unit_id}/reset-counters")
    async def reset(unit_id: int):
        current = machine(unit_id)
        current.reset_counters()
        application.state.simulation.write(unit_id)
        return current.snapshot()

    return application


app = create_app()
