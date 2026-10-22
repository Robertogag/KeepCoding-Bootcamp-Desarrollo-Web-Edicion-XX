from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.types import UTCDateTime, utcnow


class AlertRule(Base):
    __tablename__ = "alert_rules"
    __table_args__ = (
        CheckConstraint("type IN ('MACHINE_DOWN','MACHINE_OFFLINE','OEE_BELOW')", name="type"),
        CheckConstraint(
            "(type = 'OEE_BELOW' AND threshold IS NOT NULL AND threshold BETWEEN 0 AND 1) "
            "OR (type <> 'OEE_BELOW' AND threshold IS NULL)",
            name="threshold",
        ),
        CheckConstraint("duration_s BETWEEN 30 AND 86400", name="duration"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(20))
    threshold: Mapped[float | None] = mapped_column(Float)
    duration_s: Mapped[int] = mapped_column(default=180, server_default="180")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint("type IN ('MACHINE_DOWN','MACHINE_OFFLINE','OEE_BELOW')", name="type"),
        UniqueConstraint("user_id", "dedupe_key", name="uq_notifications_user_dedupe"),
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index(
            "ix_notifications_pending",
            "created_at",
            postgresql_where=text("delivered_at IS NULL"),
            sqlite_where=text("delivered_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(20))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON, "sqlite"))
    dedupe_key: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, server_default=func.now()
    )
    read_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    emailed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    delivered_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class Watchlist(Base):
    __tablename__ = "watchlist"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), primary_key=True, index=True
    )
