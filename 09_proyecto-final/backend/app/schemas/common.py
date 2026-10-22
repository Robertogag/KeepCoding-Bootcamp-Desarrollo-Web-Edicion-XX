import re
import unicodedata
from datetime import UTC

from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


def utc_iso(value):
    if value is None:
        return None
    return (
        value.replace(tzinfo=value.tzinfo or UTC).astimezone(UTC).isoformat().replace("+00:00", "Z")
    )


def slugify(value):
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-") or "item"


def envelope(items, total, page, page_size):
    return dict(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=page * page_size < total,
        has_prev=page > 1 and (page - 2) * page_size < total,
    )


async def paginate(query, session, page, page_size):
    total = await session.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    rows = (await session.scalars(query.offset((page - 1) * page_size).limit(page_size))).all()
    return rows, total
