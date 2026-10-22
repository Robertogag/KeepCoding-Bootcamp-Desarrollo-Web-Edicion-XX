from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.types import UTCDateTime, utcnow


class Machine(Base):
    __tablename__ = "machines"
    __table_args__ = (
        UniqueConstraint("id", "plant_id", name="uq_machines_id_plant_id"),
        ForeignKeyConstraint(
            ["line_id", "plant_id"],
            ["production_lines.id", "production_lines.plant_id"],
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        UniqueConstraint("plant_id", "slug", name="uq_machines_plant_slug"),
        CheckConstraint("port BETWEEN 1 AND 65535", name="port"),
        CheckConstraint("unit_id BETWEEN 1 AND 247", name="unit_id"),
        CheckConstraint("ideal_cycle_s BETWEEN 0.1 AND 3600", name="ideal_cycle"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    line_id: Mapped[int | None] = mapped_column(index=True)
    slug: Mapped[str] = mapped_column(String(120))
    name: Mapped[str] = mapped_column(String(80))
    brand: Mapped[str] = mapped_column(String(80), default="", server_default="")
    model: Mapped[str] = mapped_column(String(80), default="", server_default="")
    host: Mapped[str] = mapped_column(String(253))
    port: Mapped[int] = mapped_column(default=502, server_default="502")
    unit_id: Mapped[int] = mapped_column(default=1, server_default="1")
    ideal_cycle_s: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), index=True
    )
    photo_key: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, server_default=func.now()
    )


class DowntimeReason(Base):
    __tablename__ = "downtime_reasons"
    __table_args__ = (
        CheckConstraint(
            "category IN ('mecanica','electrica','material','calidad','organizacional','otro')",
            name="category",
        ),
    )

    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    label_es: Mapped[str] = mapped_column(String(120))
    label_en: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(20))


class MachineEvent(Base):
    __tablename__ = "machine_events"
    __table_args__ = (
        CheckConstraint("state IN ('RUNNING','IDLE','DOWN','OFFLINE')", name="state"),
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="interval"),
        Index("ix_machine_events_machine_started", "machine_id", "started_at"),
        Index(
            "uq_machine_events_open",
            "machine_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
            sqlite_where=text("ended_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id", ondelete="CASCADE"))
    state: Mapped[str] = mapped_column(String(7))
    reason_code: Mapped[str | None] = mapped_column(String(32))
    comment: Mapped[str | None] = mapped_column(Text)
    classified_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    started_at: Mapped[datetime] = mapped_column(UTCDateTime())
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class ProductionMinute(Base):
    __tablename__ = "production_minutes"
    __table_args__ = (
        CheckConstraint("good >= 0 AND reject >= 0", name="counts"),
        CheckConstraint(
            "run_s >= 0 AND idle_s >= 0 AND down_s >= 0 AND offline_s >= 0",
            name="durations",
        ),
    )

    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), primary_key=True
    )
    bucket_start: Mapped[datetime] = mapped_column(UTCDateTime(), primary_key=True)
    good: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    reject: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    run_s: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    idle_s: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    down_s: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    offline_s: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")


class ProductionSample(Base):
    __tablename__ = "production_samples"
    __table_args__ = (CheckConstraint("good >= 0 AND reject >= 0", name="counts"),)

    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), primary_key=True
    )
    sampled_at: Mapped[datetime] = mapped_column(UTCDateTime(), primary_key=True)
    good: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    reject: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
