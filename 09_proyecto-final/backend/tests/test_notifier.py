import json
from contextlib import asynccontextmanager

import fakeredis
import fakeredis.aioredis
import pytest

from app.models import Notification, Plant, PlantMember, User
from app.services import notifier


@pytest.fixture
async def delivery(db_session, monkeypatch):
    user = User(
        username="reader",
        email="reader@example.com",
        full_name="Operador",
        password_hash="hash",
        language="es",
    )
    plant = Plant(name="Planta", slug="planta", timezone="UTC", is_public=False)
    db_session.add_all([user, plant])
    await db_session.flush()
    db_session.add(PlantMember(plant_id=plant.id, user_id=user.id, role="viewer"))
    notification = Notification(
        user_id=user.id,
        type="MACHINE_DOWN",
        payload={
            "plant_id": plant.id,
            "machine_id": 1,
            "machine_name": "Prensa <script>",
            "reason_code": "3",
            "duration_s": 180,
        },
    )
    db_session.add(notification)
    await db_session.commit()
    server = fakeredis.FakeServer()

    @asynccontextmanager
    async def factory():
        yield db_session

    class Cache:
        @staticmethod
        def from_url(*args, **kwargs):
            return fakeredis.aioredis.FakeRedis(server=server, decode_responses=True)

    monkeypatch.setattr(notifier, "SessionLocal", factory)
    monkeypatch.setattr(notifier, "Redis", Cache)
    mail = []

    async def send(to, subject, html):
        mail.append((to, subject, html))

    monkeypatch.setattr(notifier, "send_mail", send)
    return notification, user, server, mail


async def test_offline_delivery_is_localized_escaped_and_not_repeated(delivery):
    notification, _, _, mail = delivery
    await notifier.deliver_pending()
    await notifier.deliver_pending()
    assert len(mail) == 1
    assert "Ver máquina" in mail[0][2] and "Prensa &lt;script&gt;" in mail[0][2]
    assert "watchlist/unfollow?token=" in mail[0][2]
    assert notification.emailed_at is not None and notification.delivered_at is not None


async def test_connected_user_receives_pubsub_instead_of_email(delivery):
    notification, user, server, mail = delivery
    async with fakeredis.aioredis.FakeRedis(server=server, decode_responses=True) as cache:
        async with cache.pubsub() as subscriber:
            await subscriber.subscribe(f"user:{user.id}:notifications")
            await subscriber.get_message(timeout=1)
            await notifier.deliver_pending()
            message = await subscriber.get_message(ignore_subscribe_messages=True, timeout=1)
    assert json.loads(message["data"])["notification"]["id"] == notification.id
    assert not mail and notification.emailed_at is None and notification.delivered_at is not None


async def test_failed_delivery_stays_pending_for_retry(delivery, monkeypatch):
    notification, _, _, mail = delivery
    original = notifier.send_mail

    async def unavailable(*args):
        raise OSError("SMTP unavailable")

    monkeypatch.setattr(notifier, "send_mail", unavailable)
    await notifier.deliver_pending()
    assert notification.delivered_at is None
    monkeypatch.setattr(notifier, "send_mail", original)
    await notifier.deliver_pending()
    assert len(mail) == 1 and notification.delivered_at is not None
