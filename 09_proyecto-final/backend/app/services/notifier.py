import asyncio
import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote

from jinja2 import Environment, FileSystemLoader, select_autoescape
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import Notification, PlantMember, User
from app.services.follow_tokens import unfollow_token
from app.services.mailer import send_mail
from app.services.oee import iso

logger = logging.getLogger(__name__)
templates = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parents[1] / "templates/email"),
    autoescape=select_autoescape(),
)


def notification_data(row):
    return dict(
        id=row.id,
        type=row.type,
        payload=row.payload,
        created_at=iso(row.created_at),
        read_at=iso(row.read_at),
    )


async def deliver_pending():
    async with SessionLocal() as session:
        rows = list(
            await session.scalars(
                select(Notification)
                .where(Notification.delivered_at.is_(None))
                .order_by(Notification.id)
                .limit(50)
                .with_for_update(skip_locked=True)
            )
        )
        async with Redis.from_url(
            settings.redis_url, decode_responses=True, socket_timeout=1, socket_connect_timeout=1
        ) as cache:
            for row in rows:
                user = await session.get(User, row.user_id)
                membership = await session.get(PlantMember, (row.payload["plant_id"], row.user_id))
                if user is None or membership is None or row.read_at:
                    row.delivered_at = datetime.now(UTC)
                    continue
                message = {"type": "notification", "notification": notification_data(row)}
                try:
                    online = await cache.publish(
                        f"user:{user.id}:notifications", json.dumps(message)
                    )
                except RedisError:
                    online = 0
                if not online:
                    detail_url = (
                        f"{settings.frontend_url}/{user.language}/app/plants/"
                        f"{row.payload['plant_id']}/machines/{row.payload['machine_id']}"
                    )
                    token = unfollow_token(user.id, row.payload["machine_id"])
                    unfollow_url = (
                        f"{settings.public_api_url}/watchlist/unfollow?token={quote(token)}"
                    )
                    html = templates.get_template(f"{user.language}/notification.html").render(
                        user=user,
                        notification=row,
                        detail_url=detail_url,
                        unfollow_url=unfollow_url,
                    )
                    subject = f"OEE Live: {row.payload['machine_name']}"
                    try:
                        await send_mail(user.email, subject, html)
                    except Exception:
                        logger.exception("No se pudo entregar la notificación %s", row.id)
                        continue
                    row.emailed_at = datetime.now(UTC)
                row.delivered_at = datetime.now(UTC)
        await session.commit()


async def run_notifier():
    while True:
        try:
            await deliver_pending()
        except Exception:
            logger.exception("Error procesando notificaciones pendientes")
        await asyncio.sleep(5)
