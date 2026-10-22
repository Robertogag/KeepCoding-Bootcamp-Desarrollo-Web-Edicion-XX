import asyncio
import contextlib
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.errors import ApiError
from app.models import Plant, PlantMember, User
from app.services.auth import decode_access_token, token_hash

router = APIRouter()


async def authenticated(token):
    try:
        payload = decode_access_token(token)
    except ApiError:
        return None
    async with SessionLocal() as session:
        user = await session.get(User, int(payload["sub"]))
        if user is None or payload.get("pwd") != token_hash(user.password_hash):
            return None
    return payload


async def member(user_id, plant_id):
    async with SessionLocal() as session:
        return await session.get(PlantMember, (plant_id, user_id)) is not None


async def public_plant(plant_id):
    async with SessionLocal() as session:
        plant = await session.get(Plant, plant_id)
        return bool(plant and plant.is_public)


@router.websocket("/ws")
async def private_socket(socket: WebSocket):
    await socket.accept()
    token = socket.query_params.get("token", "")
    payload = await authenticated(token)
    if payload is None:
        await socket.close(code=4401)
        return
    user_id = int(payload["sub"])
    plants = set()
    cache = Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=2)
    receive = None
    try:
        async with cache.pubsub() as subscriber:
            await subscriber.subscribe(f"user:{user_id}:notifications")
            receive = asyncio.create_task(socket.receive_json())
            last_ping = last_check = time.monotonic()
            while True:
                if time.time() >= payload["exp"]:
                    await socket.close(code=4401)
                    return
                if receive.done():
                    try:
                        command = receive.result()
                    except (ValueError, TypeError):
                        await socket.close(code=4400)
                        return
                    if not isinstance(command, dict) or command.get("type") not in (
                        "subscribe",
                        "unsubscribe",
                    ):
                        await socket.close(code=4400)
                        return
                    plant_id = command.get("plant_id")
                    if (
                        isinstance(plant_id, bool)
                        or not isinstance(plant_id, int)
                        or not await member(user_id, plant_id)
                    ):
                        await socket.close(code=4403)
                        return
                    channel = f"plant:{plant_id}:live"
                    if command["type"] == "subscribe":
                        plants.add(plant_id)
                        await subscriber.subscribe(channel)
                    else:
                        plants.discard(plant_id)
                        await subscriber.unsubscribe(channel)
                    receive = asyncio.create_task(socket.receive_json())
                message = await subscriber.get_message(ignore_subscribe_messages=True, timeout=0.2)
                if message:
                    data = json.loads(message["data"])
                    if data.get("type") == "machine.snapshot":
                        plant_id = data.get("plant_id")
                        if plant_id in plants:
                            if not await member(user_id, plant_id):
                                await socket.close(code=4403)
                                return
                            await socket.send_json(data)
                    elif data.get("type") == "notification":
                        plant_id = data["notification"]["payload"]["plant_id"]
                        if await member(user_id, plant_id):
                            await socket.send_json(data)
                now = time.monotonic()
                if now - last_check >= 5:
                    if await authenticated(token) is None:
                        await socket.close(code=4401)
                        return
                    for plant_id in plants:
                        if not await member(user_id, plant_id):
                            await socket.close(code=4403)
                            return
                    if plants and not await cache.get("collector:heartbeat"):
                        await socket.close(code=1013)
                        return
                    last_check = now
                if now - last_ping >= 25:
                    await socket.send_json({"type": "ping"})
                    last_ping = now
                await asyncio.sleep(0.02)
    except WebSocketDisconnect:
        pass
    except RedisError:
        with contextlib.suppress(RuntimeError, WebSocketDisconnect):
            await socket.close(code=1013)
    finally:
        if receive:
            receive.cancel()
            with contextlib.suppress(asyncio.CancelledError, WebSocketDisconnect, ValueError):
                await receive
        await cache.aclose()


@router.websocket("/ws/public/{plant_slug}")
async def public_socket(socket: WebSocket, plant_slug: str):
    await socket.accept()
    async with SessionLocal() as session:
        plant = await session.scalar(
            select(Plant).where(Plant.slug == plant_slug, Plant.is_public.is_(True))
        )
    if plant is None:
        await socket.close(code=4404)
        return
    cache = Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=2)
    receive = asyncio.create_task(socket.receive())
    try:
        async with cache.pubsub() as subscriber:
            await subscriber.subscribe(f"plant:{plant.id}:live")
            last_check = last_collector_check = time.monotonic()
            while True:
                if receive.done():
                    message = receive.result()
                    if message["type"] == "websocket.disconnect":
                        return
                    receive = asyncio.create_task(socket.receive())
                message = await subscriber.get_message(ignore_subscribe_messages=True, timeout=0.5)
                if message or time.monotonic() - last_check >= 5:
                    if not await public_plant(plant.id):
                        await socket.close(code=4404)
                        return
                    last_check = time.monotonic()
                if message:
                    data = json.loads(message["data"])
                    if data.get("type") == "machine.snapshot" and data.get("plant_id") == plant.id:
                        await socket.send_json(
                            {
                                key: data[key]
                                for key in ("type", "plant_id", "machine_id", "snapshot", "ts")
                            }
                        )
                if time.monotonic() - last_collector_check >= 5:
                    if not await cache.get("collector:heartbeat"):
                        await socket.close(code=1013)
                        return
                    last_collector_check = time.monotonic()
                await asyncio.sleep(0.02)
    except WebSocketDisconnect:
        pass
    except RedisError:
        with contextlib.suppress(RuntimeError, WebSocketDisconnect):
            await socket.close(code=1013)
    finally:
        receive.cancel()
        with contextlib.suppress(asyncio.CancelledError, WebSocketDisconnect):
            await receive
        await cache.aclose()
