"""Resource guards used only by the opt-in local integration smoke scripts."""

import re
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.engine import make_url

SMOKE_LOCK = 1330791767


def validate_database_url(raw: str) -> str:
    url = make_url(raw)
    if (
        url.drivername != "postgresql+asyncpg"
        or url.host not in {"localhost", "127.0.0.1", "::1"}
        or not re.fullmatch(r"oee_collector_test(?:_[a-z0-9]+)*", url.database or "")
    ):
        raise RuntimeError("Smoke tests require a local disposable oee_collector_test database")
    return raw


@asynccontextmanager
async def disposable_database(engine, metadata):
    """Refuse populated databases and remove only tables created by this invocation."""
    created = False
    async with engine.connect() as lease:
        acquired = await lease.scalar(
            text("SELECT pg_try_advisory_lock(:key)"), {"key": SMOKE_LOCK}
        )
        await lease.commit()
        if not acquired:
            raise RuntimeError("Another smoke test already owns this disposable database")
        try:
            async with engine.begin() as connection:
                current = await connection.scalar(text("SELECT current_database()"))
                if current != engine.url.database:
                    raise RuntimeError("Unexpected database identity")
                occupied = await connection.scalar(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n "
                        "ON n.oid=c.relnamespace WHERE n.nspname='public' "
                        "AND c.relkind IN ('r','p','v','m','S','f'))"
                    )
                )
                if occupied:
                    raise RuntimeError("Smoke database is not empty; refusing to modify its data")
                await connection.run_sync(metadata.create_all)
            created = True
            yield
        finally:
            try:
                if created:
                    async with engine.begin() as connection:
                        await connection.run_sync(metadata.drop_all)
            finally:
                await lease.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": SMOKE_LOCK})
                await lease.commit()
