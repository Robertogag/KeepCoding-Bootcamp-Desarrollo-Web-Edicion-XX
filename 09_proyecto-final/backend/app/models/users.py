from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.types import UTCDateTime, utcnow


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("language IN ('es', 'en')", name="language"),
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(30), unique=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    full_name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(255))
    language: Mapped[str] = mapped_column(String(2), default="es", server_default="es")
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, server_default=func.now()
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    family_id: Mapped[str] = mapped_column(String(64), index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
