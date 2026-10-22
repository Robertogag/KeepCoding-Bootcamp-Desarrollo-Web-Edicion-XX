import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError

from app.config import DEVELOPMENT_SECRET, Settings
from app.errors import ApiError, install_error_handlers


def test_settings_read_environment(monkeypatch):
    monkeypatch.setenv("ACCESS_TOKEN_MINUTES", "15")
    monkeypatch.setenv("REFRESH_TOKEN_DAYS", "14")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000/")
    monkeypatch.setenv("SMTP_PORT", "1025")
    settings = Settings(_env_file=None)
    assert settings.access_token_minutes == 15
    assert settings.refresh_token_days == 14
    assert settings.frontend_url == "http://localhost:3000"
    assert settings.smtp_port == 1025


@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:3000/app",
        "https://example.com?x=1",
        "https://user:pass@example.com",
        "example.com",
    ],
)
def test_frontend_origin_rejects_paths_and_credentials(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, frontend_url=origin)


def test_production_requires_real_secret_and_https():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(_env_file=None, environment="production", jwt_secret=DEVELOPMENT_SECRET)
    with pytest.raises(ValidationError, match="HTTPS"):
        Settings(
            _env_file=None,
            environment="production",
            jwt_secret="a" * 48,
            frontend_url="http://example.com",
        )
    settings = Settings(
        _env_file=None,
        environment="production",
        jwt_secret="a" * 48,
        frontend_url="https://example.com",
        database_url="postgresql+asyncpg://oee:oee@localhost/oee",
    )
    assert settings.frontend_url == "https://example.com"


def test_sync_database_driver_is_rejected():
    with pytest.raises(ValidationError, match="asynchronous"):
        Settings(_env_file=None, database_url="postgresql://oee:oee@localhost/oee")


def test_public_api_url_supports_separate_local_origin():
    settings = Settings(_env_file=None, public_api_url="http://localhost:8000/api/v1/")
    assert settings.public_api_url == "http://localhost:8000/api/v1"
    fallback = Settings(_env_file=None, frontend_url="https://example.com", public_api_url=None)
    assert fallback.public_api_url == "https://example.com/api/v1"


def test_public_api_url_rejects_missing_api_prefix():
    with pytest.raises(ValidationError, match="PUBLIC_API_URL"):
        Settings(_env_file=None, public_api_url="https://example.com")


def test_errors_follow_api_envelope():
    app = FastAPI()
    install_error_handlers(app)

    class Form(BaseModel):
        duration_s: int

    @app.post("/validate")
    async def validate(data: Form):
        return data

    @app.get("/private")
    async def private():
        raise ApiError(403, "FORBIDDEN")

    @app.get("/conflict")
    async def conflict():
        raise ApiError(409, "EMAIL_TAKEN", "email")

    with TestClient(app) as client:
        response = client.post("/validate", json={"duration_s": "invalid"})
        assert response.status_code == 422
        assert response.json() == {"error": {"code": "VALIDATION_ERROR", "field": "duration_s"}}
        assert client.get("/private").json() == {"error": {"code": "FORBIDDEN"}}
        assert client.get("/conflict").json() == {
            "error": {"code": "EMAIL_TAKEN", "field": "email"}
        }
        assert client.get("/missing").json() == {"error": {"code": "NOT_FOUND"}}
        malformed = client.post(
            "/validate", content="{", headers={"Content-Type": "application/json"}
        )
        assert malformed.json() == {"error": {"code": "VALIDATION_ERROR"}}
