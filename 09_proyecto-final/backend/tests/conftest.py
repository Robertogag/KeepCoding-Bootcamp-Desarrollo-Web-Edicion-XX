import httpx
import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.db import Base, get_session


@pytest.fixture
async def db_session(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'tests.db'}")

    @event.listens_for(engine.sync_engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def client(db_session, tmp_path, monkeypatch):
    from app.main import app

    async def override():
        yield db_session

    app.dependency_overrides[get_session] = override
    monkeypatch.setattr(settings, "upload_dir", tmp_path / "uploads")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="https://testserver"
    ) as result:
        yield result
    app.dependency_overrides.clear()


@pytest.fixture
async def register(client):
    async def create(username="owner", **kwargs):
        body = {
            "username": username,
            "email": f"{username}@example.com",
            "full_name": username.title(),
            "language": "es",
            "password": "Password123!",
            **kwargs,
        }
        response = await client.post("/api/v1/auth/register", json=body)
        assert response.status_code == 201, response.text
        return response.json()

    return create


@pytest.fixture
def auth_headers():
    def headers(result):
        return {"Authorization": f"Bearer {result['access_token']}"}

    return headers
