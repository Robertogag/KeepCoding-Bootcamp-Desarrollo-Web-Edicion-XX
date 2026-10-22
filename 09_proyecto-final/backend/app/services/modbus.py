"""One serialized async connection per TCP endpoint (pymodbus 3.11.4)."""

import asyncio
import time
from dataclasses import asdict, dataclass, field

from pymodbus.client import AsyncModbusTcpClient
from pymodbus.exceptions import ModbusException

from app.errors import ApiError
from app.services.telemetry import measurement, register_blocks


class ModbusReadError(Exception):
    """Transport failure, invalid response or a device currently backing off."""


@dataclass(frozen=True)
class Registers:
    state: int
    good_count: int
    reject_count: int
    alarm_code: int
    last_cycle_ds: int
    heartbeat: int
    ideal_cycle_ds: int

    @classmethod
    def decode(cls, words: list[int]) -> "Registers":
        if len(words) != 9 or any(
            type(word) is not int or not 0 <= word <= 65535 for word in words
        ):
            raise ModbusReadError("Expected nine uint16 holding registers")
        if words[0] not in (0, 1, 2):
            raise ModbusReadError("Unknown machine state")
        return cls(
            words[0],
            words[1] * 65536 + words[2],
            words[3] * 65536 + words[4],
            words[5],
            words[6],
            words[7],
            words[8],
        )


@dataclass
class Endpoint:
    host: str
    port: int
    timeout: float = 1.0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    client: AsyncModbusTcpClient | None = None
    next_connect: float = 0.0
    connection_failures: int = 0
    unit_retry: dict[int, tuple[float, int]] = field(default_factory=dict)

    async def read(self, unit_id: int) -> Registers:
        async with self.lock:
            now = time.monotonic()
            if now < self.next_connect:
                raise ModbusReadError("Endpoint reconnect backoff")
            if now < self.unit_retry.get(unit_id, (0.0, 0))[0]:
                raise ModbusReadError("Device retry backoff")
            if self.client is None:
                self.client = AsyncModbusTcpClient(
                    self.host,
                    port=self.port,
                    timeout=self.timeout,
                    retries=0,
                    reconnect_delay=0,
                )
            try:
                if not self.client.connected:
                    if not await self.client.connect():
                        raise ModbusReadError("Connection refused")
                response = await self.client.read_holding_registers(
                    0,
                    count=9,
                    device_id=unit_id,
                )
                if response.isError():
                    raise ModbusReadError("Device returned a Modbus exception")
                registers = Registers.decode(response.registers)
            except (TimeoutError, ModbusReadError, ModbusException, OSError) as exc:
                if not self.client.connected:
                    self.connection_failures += 1
                    self.next_connect = time.monotonic() + min(
                        30.0,
                        2 ** min(self.connection_failures - 1, 5),
                    )
                    self.client.close()
                else:
                    # A bad unit must not block healthy devices sharing the TCP gateway.
                    failures = self.unit_retry.get(unit_id, (0.0, 0))[1] + 1
                    self.unit_retry[unit_id] = (
                        time.monotonic() + min(30.0, 2 ** min(failures - 1, 5)),
                        failures,
                    )
                raise ModbusReadError(str(exc)) from exc
            self.connection_failures = 0
            self.next_connect = 0.0
            self.unit_retry.pop(unit_id, None)
            return registers

    def close(self) -> None:
        if self.client is not None:
            self.client.close()
            self.client = None

    async def read_variables(self, unit_id, mappings):
        values = {mapping["code"]: measurement(mapping) for mapping in mappings}
        if not mappings:
            return values
        try:
            # Optional process variables cannot block the core heartbeat indefinitely.
            async with asyncio.timeout(2), self.lock:
                if self.client is None or not self.client.connected:
                    return values
                for start, end, variables in register_blocks(mappings):
                    try:
                        response = await self.client.read_holding_registers(
                            start, count=end - start, device_id=unit_id
                        )
                        if not response.isError():
                            words = response.registers
                            if not isinstance(words, list) or len(words) != end - start:
                                continue
                            for mapping in variables:
                                width = 1 if mapping["data_type"] in {"uint16", "int16"} else 2
                                offset = mapping["address"] - start
                                values[mapping["code"]] = measurement(
                                    mapping, words[offset : offset + width]
                                )
                    except (ModbusException, OSError, TimeoutError):
                        continue
        except TimeoutError:
            pass
        return values


class ModbusPool:
    def __init__(self, timeout: float = 1.0):
        self.timeout = timeout
        self.endpoints: dict[tuple[str, int], Endpoint] = {}

    async def read(self, host: str, port: int, unit_id: int) -> Registers:
        key = (host, port)
        if key not in self.endpoints:
            self.endpoints[key] = Endpoint(host, port, self.timeout)
        return await self.endpoints[key].read(unit_id)

    def retain(self, endpoints: set[tuple[str, int]]) -> None:
        for key in set(self.endpoints) - endpoints:
            self.endpoints.pop(key).close()

    async def read_variables(self, host, port, unit_id, mappings):
        endpoint = self.endpoints.get((host, port))
        if endpoint is None:
            return {mapping["code"]: measurement(mapping) for mapping in mappings}
        return await endpoint.read_variables(unit_id, mappings)

    def close(self) -> None:
        for endpoint in self.endpoints.values():
            endpoint.close()
        self.endpoints.clear()


async def test_connection(host: str, port: int, unit_id: int) -> dict:
    pool = ModbusPool(timeout=2.0)
    started = time.perf_counter()
    try:
        registers = await pool.read(host, port, unit_id)
        return {
            "ok": True,
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            "registers": asdict(registers),
        }
    except ModbusReadError as exc:
        raise ApiError(502, "MODBUS_UNREACHABLE") from exc
    finally:
        pool.close()
