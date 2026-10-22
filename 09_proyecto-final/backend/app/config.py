from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_DIR = Path(__file__).resolve().parents[2]
DEVELOPMENT_SECRET = "development-only-change-before-deploying-32-chars"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(PROJECT_DIR / ".env", PROJECT_DIR / "backend" / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+asyncpg://oee:oee@localhost:5432/oee"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = Field(default=DEVELOPMENT_SECRET, min_length=32, repr=False)
    frontend_url: str = "http://localhost:3000"
    public_api_url: str | None = None
    upload_dir: Path = Path("uploads")
    smtp_host: str = "localhost"
    smtp_port: int = Field(default=1025, ge=1, le=65535)
    smtp_user: str = ""
    smtp_password: str = Field(default="", repr=False)
    smtp_from: str = "OEE Live <noreply@localhost>"
    smtp_starttls: bool = False
    access_token_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_days: int = Field(default=14, ge=1, le=30)

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        if not value.startswith(("postgresql+asyncpg://", "sqlite+aiosqlite://")):
            raise ValueError("DATABASE_URL requires an asynchronous database driver")
        return value

    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, value: str) -> str:
        parsed = urlsplit(value)
        if parsed.scheme not in {"redis", "rediss"} or not parsed.hostname:
            raise ValueError("REDIS_URL must use redis:// or rediss://")
        return value

    @field_validator("frontend_url")
    @classmethod
    def validate_frontend_url(cls, value: str) -> str:
        value = value.rstrip("/")
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.path
            or parsed.query
            or parsed.fragment
            or parsed.username
            or parsed.password
        ):
            raise ValueError("FRONTEND_URL must be an HTTP origin without a path")
        return value

    @field_validator("public_api_url")
    @classmethod
    def validate_public_api_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.rstrip("/")
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.path != "/api/v1"
            or parsed.query
            or parsed.fragment
            or parsed.username
            or parsed.password
        ):
            raise ValueError("PUBLIC_API_URL must be an HTTP URL ending in /api/v1")
        return value

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        if self.public_api_url is None:
            self.public_api_url = f"{self.frontend_url}/api/v1"
        if self.environment == "production":
            if self.jwt_secret == DEVELOPMENT_SECRET:
                raise ValueError("JWT_SECRET must be configured for production")
            if not self.frontend_url.startswith("https://"):
                raise ValueError("FRONTEND_URL must use HTTPS in production")
            if not self.public_api_url.startswith("https://"):
                raise ValueError("PUBLIC_API_URL must use HTTPS in production")
            if not self.database_url.startswith("postgresql+asyncpg://"):
                raise ValueError("Production requires PostgreSQL")
        return self


settings = Settings()
