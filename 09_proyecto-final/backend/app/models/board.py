from datetime import datetime

from sqlalchemy import CheckConstraint, Float, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.types import UTCDateTime, utcnow


class MachineBoardPosition(Base):
    __tablename__ = "machine_board_positions"
    __table_args__ = (
        CheckConstraint("x >= 0 AND x <= 1 AND y >= 0 AND y <= 1", name="origin"),
        CheckConstraint("width > 0 AND width <= 1 AND height > 0 AND height <= 1", name="size"),
        CheckConstraint("x + width <= 1 AND y + height <= 1", name="bounds"),
        CheckConstraint("rotation IN (0, 90, 180, 270)", name="rotation"),
    )

    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), primary_key=True
    )
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    width: Mapped[float] = mapped_column(Float)
    height: Mapped[float] = mapped_column(Float)
    rotation: Mapped[int] = mapped_column(default=0, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, onupdate=utcnow, server_default=func.now()
    )
