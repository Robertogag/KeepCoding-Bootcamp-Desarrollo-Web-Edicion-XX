from datetime import datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.types import UTCDateTime


class MachineCheckpoint(Base):
    """Last telemetry committed with the event and production accounting transaction."""

    __tablename__ = "machine_checkpoints"

    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), primary_key=True
    )
    accounted_at: Mapped[datetime] = mapped_column(UTCDateTime())
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON, "sqlite"))
    progress: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON, "sqlite"))
