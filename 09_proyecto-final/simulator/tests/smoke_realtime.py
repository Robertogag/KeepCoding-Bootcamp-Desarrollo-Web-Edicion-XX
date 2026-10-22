"""Opt-in HTTP/WebSocket smoke against disposable PostgreSQL and TCP-emulated Redis."""

# ruff: noqa: E402 -- Configure the disposable environment before importing app globals.

import asyncio
import json
import logging
import os
import socket
import sys
import tempfile
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import jwt
import uvicorn
from fakeredis import TcpFakeServer
from fakeredis._clients._tcp_server import TCPFakeRequestHandler
from redis.asyncio import Redis
from smoke_support import disposable_database, validate_database_url
from sqlalchemy import delete
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

database_url = validate_database_url(os.environ["COLLECTOR_SMOKE_DATABASE_URL"])
os.environ["DATABASE_URL"] = database_url
uploads = tempfile.TemporaryDirectory(prefix="oee-ws-uploads-")
os.environ["UPLOAD_DIR"] = uploads.name


class PortableFakeRedisHandler(TCPFakeRequestHandler):
    def setup(self):
        super().setup()
        self.connection.setblocking(False)


fake_redis = TcpFakeServer(("127.0.0.1", 0), server_version=(7, 0))
fake_redis.RequestHandlerClass = PortableFakeRedisHandler
fake_redis.daemon_threads = True
os.environ["REDIS_URL"] = f"redis://127.0.0.1:{fake_redis.server_address[1]}/0"
threading.Thread(target=fake_redis.serve_forever, daemon=True).start()
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.config import settings
from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import Notification, Plant, PlantMember, User
from app.services.auth import issue_access_token, token_hash


async def closed_with(socket, code):
    try:
        await asyncio.wait_for(socket.recv(), timeout=8)
    except ConnectionClosed as exc:
        assert exc.rcvd.code == code, (exc.rcvd.code, code)
    else:
        raise AssertionError(f"Expected WebSocket close {code}")


async def run():
    logging.basicConfig(level=logging.WARNING)
    server = None
    server_task = None
    try:
        async with SessionLocal() as session:
            plant = Plant(name="WS smoke", slug="ws-smoke", timezone="UTC", is_public=True)
            user = User(
                username="ws-smoke",
                email="ws@example.test",
                full_name="WS test",
                password_hash="unused-test-account",
                language="es",
            )
            session.add_all([plant, user])
            await session.flush()
            session.add(PlantMember(plant_id=plant.id, user_id=user.id, role="owner"))
            await session.commit()
            token = issue_access_token(user)
            plant_id, user_id = plant.id, user.id
        async with Redis.from_url(settings.redis_url) as redis:
            await redis.set("collector:heartbeat", datetime.now(UTC).isoformat(), ex=60)
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        server = uvicorn.Server(
            uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", access_log=False)
        )
        server_task = asyncio.create_task(server.serve())
        for _ in range(100):
            if server.started:
                break
            await asyncio.sleep(0.05)
        assert server.started
        origin = f"ws://127.0.0.1:{port}"
        async with httpx.AsyncClient() as http:
            health = await http.get(f"http://127.0.0.1:{port}/api/v1/health")
            assert health.status_code == 200 and all(health.json()["checks"].values())
        async with connect(f"{origin}/ws?token=invalid") as client:
            await closed_with(client, 4401)
        async with connect(f"{origin}/ws/public/missing") as client:
            await closed_with(client, 4404)
        async with connect(f"{origin}/ws?token={token}") as client:
            await client.send(json.dumps({"type": "subscribe", "plant_id": 999999}))
            await closed_with(client, 4403)
        print("PASS: HTTP health and WS rejection codes 4401/4403/4404", flush=True)

        async with Redis.from_url(settings.redis_url, decode_responses=True) as redis:
            async with connect(f"{origin}/ws?token={token}") as private:
                async with connect(f"{origin}/ws/public/ws-smoke") as public:
                    await private.send(json.dumps({"type": "subscribe", "plant_id": plant_id}))
                    channel = f"plant:{plant_id}:live"
                    for _ in range(50):
                        counts = await redis.pubsub_numsub(channel)
                        if counts[0][1] == 2:
                            break
                        await asyncio.sleep(0.05)
                    assert counts[0][1] == 2
                    message = {
                        "type": "machine.snapshot",
                        "plant_id": plant_id,
                        "machine_id": 1,
                        "snapshot": {
                            "state": "RUNNING",
                            "since": "2026-10-21T00:00:00Z",
                            "good": 12,
                            "reject": 1,
                            "alarm_code": 0,
                            "last_cycle_s": 0.2,
                            "oee_today": {
                                "availability": 0.9,
                                "performance": 0.8,
                                "quality": 0.92,
                                "oee": 0.6624,
                            },
                        },
                        "ts": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                    }
                    assert await redis.publish(channel, json.dumps(message)) == 2
                    assert json.loads(await asyncio.wait_for(public.recv(), timeout=5)) == message
                    assert json.loads(await asyncio.wait_for(private.recv(), timeout=5)) == message

                    async with SessionLocal() as session:
                        notification = Notification(
                            user_id=user_id,
                            type="MACHINE_DOWN",
                            dedupe_key="smoke-once",
                            payload={
                                "plant_id": plant_id,
                                "machine_id": 1,
                                "machine_name": "Test",
                                "reason_code": "3",
                                "duration_s": 31,
                            },
                        )
                        session.add(notification)
                        await session.commit()
                        notification_id = notification.id
                    delivered = json.loads(await asyncio.wait_for(private.recv(), timeout=8))
                    assert delivered["type"] == "notification"
                    assert delivered["notification"]["id"] == notification_id
                    for _ in range(30):
                        async with SessionLocal() as session:
                            result = await session.get(Notification, notification_id)
                        if result.delivered_at is not None:
                            break
                        await asyncio.sleep(0.05)
                    assert result.delivered_at is not None and result.emailed_at is None
                    print("PASS: public/private snapshots and notifier -> private WS", flush=True)

                    async with SessionLocal() as session:
                        row = await session.get(Plant, plant_id)
                        row.is_public = False
                        await session.commit()
                    await redis.publish(channel, json.dumps(message))
                    await closed_with(public, 4404)
                    # The private connection is still authorized and receives this snapshot.
                    assert json.loads(await asyncio.wait_for(private.recv(), timeout=5)) == message
                async with SessionLocal() as session:
                    await session.execute(delete(PlantMember).where(PlantMember.user_id == user_id))
                    await session.commit()
                await redis.publish(channel, json.dumps(message))
                await closed_with(private, 4403)

        now = datetime.now(UTC)
        expiring = jwt.encode(
            {
                "sub": str(user_id),
                "iat": now,
                "exp": now + timedelta(seconds=2),
                "type": "access",
                "pwd": token_hash(user.password_hash),
            },
            settings.jwt_secret,
            algorithm="HS256",
        )
        async with connect(f"{origin}/ws?token={expiring}") as client:
            await closed_with(client, 4401)
        print("PASS: live public/private permission revocation and JWT expiry", flush=True)
        async with SessionLocal() as session:
            row = await session.get(Plant, plant_id)
            row.is_public = True
            session.add(PlantMember(plant_id=plant_id, user_id=user_id, role="owner"))
            await session.commit()
        async with connect(f"{origin}/ws?token={token}") as private:
            async with connect(f"{origin}/ws/public/ws-smoke") as public:
                await private.send(json.dumps({"type": "subscribe", "plant_id": plant_id}))
                async with Redis.from_url(settings.redis_url) as redis:
                    await redis.delete("collector:heartbeat")
                await asyncio.gather(closed_with(private, 1013), closed_with(public, 1013))
        print("PASS: collector heartbeat loss closes both WebSockets with 1013", flush=True)
        print(
            json.dumps(
                {
                    "result": "PASS",
                    "http_websocket": "real uvicorn TCP",
                    "database": "real PostgreSQL 17",
                    "redis": "TCP Redis emulator",
                    "cases": 12,
                }
            ),
            flush=True,
        )
    finally:
        if server is not None:
            server.should_exit = True
        if server_task is not None:
            await server_task


async def main():
    try:
        async with disposable_database(engine, Base.metadata):
            await run()
    finally:
        await engine.dispose()


try:
    asyncio.run(main())
finally:
    fake_redis.shutdown()
    fake_redis.server_close()
    uploads.cleanup()
