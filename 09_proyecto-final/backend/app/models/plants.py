from datetime import datetime, time

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Time,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.types import UTCDateTime, utcnow


class Plant(Base):
    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    timezone: Mapped[str] = mapped_column(String(64))
    is_public: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, server_default=func.now()
    )


class PlantMember(Base):
    __tablename__ = "plant_members"
    __table_args__ = (CheckConstraint("role IN ('owner', 'supervisor', 'viewer')", name="role"),)

    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role: Mapped[str] = mapped_column(String(10))


class Shift(Base):
    __tablename__ = "shifts"
    __table_args__ = (
        CheckConstraint("start_time <> end_time", name="nonempty_interval"),
        CheckConstraint(
            "cardinality(days_of_week) BETWEEN 1 AND 7 AND days_of_week <@ ARRAY[1,2,3,4,5,6,7]",
            name="days_of_week",
        ).ddl_if(dialect="postgresql"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    start_time: Mapped[time] = mapped_column(Time(timezone=False))
    end_time: Mapped[time] = mapped_column(Time(timezone=False))
    days_of_week: Mapped[list[int]] = mapped_column(ARRAY(Integer).with_variant(JSON, "sqlite"))
