import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path, PurePosixPath

import pytest
from sqlalchemy import func, select

from app.config import settings
from app.models import Machine, Plant, PlantMember, ProductionRun, User
from app.schemas.responses import UserResponse
from app.seed import seed
from app.services.auth import hash_password, verify_password

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/gcp/seed-public-demo.py"
SPEC = importlib.util.spec_from_file_location("public_demo_seed", SCRIPT)
helper = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(helper)


def test_shallow_container_mount_paths_do_not_require_three_parents():
    assert helper.source_backend(PurePosixPath("/deploy/seed-public-demo.py")) is None
    assert helper.source_backend(PurePosixPath("/seed-public-demo.py")) is None
    assert helper.source_backend(
        PurePosixPath("/release/scripts/gcp/seed-public-demo.py")
    ) == PurePosixPath("/release/backend")


def test_schema_guard_populates_models_in_fresh_process():
    from app.db import Base

    code = """
import asyncio
import importlib.util
import json
import sys
from types import SimpleNamespace
from app.db import Base
assert not Base.metadata.tables, 'Process must begin without registered models'
spec = importlib.util.spec_from_file_location('seed_helper', sys.argv[1])
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
assert not Base.metadata.tables, 'Import alone must not conceal the test'
tables = [('public', name) for name in json.loads(sys.argv[2])]
class FakeSession:
    async def scalar(self, statement):
        return 'oee_demo'
    async def execute(self, statement):
        return SimpleNamespace(all=lambda: tables)
asyncio.run(helper.validate_schema(FakeSession(), 'oee_demo'))
assert 'users' in Base.metadata.tables and 'machines' in Base.metadata.tables
assert len(Base.metadata.tables) + 1 == len(tables)
"""
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            code,
            str(SCRIPT),
            json.dumps([*Base.metadata.tables, "alembic_version"]),
        ],
        cwd=Path(__file__).resolve().parents[1],
        env={**os.environ, "ENVIRONMENT": "test", "DATABASE_URL": "sqlite+aiosqlite:///:memory:"},
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def environment(**changes):
    return {
        "ENVIRONMENT": "production",
        "OEE_PUBLIC_DEMO_VM": "1",
        "DATABASE_URL": "postgresql+asyncpg://oee:private@postgres:5432/oee_demo",
        **changes,
    }


def test_target_guard_requires_vm_production_and_explicit_oee_database():
    assert helper.validate_target(environment(), "oee_demo", "linux") == {
        "host": "postgres",
        "port": 5432,
        "database": "oee_demo",
    }
    for env, name, platform in [
        (environment(), "oee_demo", "win32"),
        (environment(OEE_PUBLIC_DEMO_VM=""), "oee_demo", "linux"),
        (environment(ENVIRONMENT="development"), "oee_demo", "linux"),
        (environment(DATABASE_URL=""), "oee_demo", "linux"),
        (environment(DATABASE_URL="sqlite+aiosqlite:///test.db"), "oee_demo", "linux"),
        (environment(DATABASE_URL="postgresql+asyncpg://oee@postgres/mes"), "mes", "linux"),
        (environment(), "oee_different", "linux"),
    ]:
        with pytest.raises(ValueError):
            helper.validate_target(env, name, platform)


def test_credentials_are_distinct_persistent_private_and_never_logged(tmp_path, capsys):
    target = helper.validate_target(environment(), "oee_demo", "linux")
    private = tmp_path / "private"
    state, owner, viewer = helper.prepare_private(private, target, False)
    assert owner["username"] != viewer["username"] != "demo"
    assert owner["password"] != viewer["password"] != "Demo1234!"
    assert min(len(owner["password"]), len(viewer["password"])) >= 40
    assert helper.prepare_private(private, target, False) == (state, owner, viewer)
    assert capsys.readouterr().out == ""
    with pytest.raises(ValueError):
        helper.prepare_private(private, {**target, "database": "oee_other"}, False)
    with pytest.raises(ValueError):
        helper.prepare_private(private, target, True)
    helper.write_private(private / "seed-state.json", {**state, "initialized": True})
    (private / "owner.json").unlink()
    with pytest.raises(ValueError):
        helper.prepare_private(private, target, False)


async def test_production_seed_rejects_default_account_before_any_write(db_session, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    with pytest.raises(ValueError, match="private owner"):
        await seed(db_session, days=0)
    assert await db_session.scalar(select(func.count()).select_from(User)) == 0


async def test_public_demo_uses_private_owner_viewer_and_keeps_password_changes(
    db_session, monkeypatch
):
    monkeypatch.setattr(settings, "environment", "production")
    state = {"initialized": False}
    owner_data, viewer_data = helper.new_credentials("owner"), helper.new_credentials("viewer")
    result, state = await helper.apply_seed(db_session, state, owner_data, viewer_data, days=0)
    await db_session.commit()
    assert result["injection_runs_created"] == 8
    assert await db_session.scalar(select(User).where(User.username == "demo")) is None
    assert await db_session.scalar(select(func.count()).select_from(User)) == 2
    assert await db_session.scalar(select(func.count()).select_from(Machine)) == 8
    assert (await db_session.get(Plant, state["plant_id"])).is_public
    assert (
        await db_session.get(PlantMember, (state["plant_id"], state["owner_id"]))
    ).role == "owner"
    assert (
        await db_session.get(PlantMember, (state["plant_id"], state["viewer_id"]))
    ).role == "viewer"
    runs = list(await db_session.scalars(select(ProductionRun)))
    assert sorted(run.active_cavities for run in runs) == [1, 1, 2, 2, 2, 4, 4, 4]
    owner = await db_session.get(User, state["owner_id"])
    UserResponse.model_validate(owner, from_attributes=True)
    assert verify_password(owner.password_hash, owner_data["password"])
    owner.password_hash = hash_password("ChangedByOwner123!")
    owner.username = "owner-renamed"
    await db_session.commit()
    repeated, same_state = await helper.apply_seed(
        db_session, state, owner_data, viewer_data, days=0
    )
    await db_session.commit()
    assert same_state == state and repeated["injection_runs_created"] == 0
    assert owner.username == "owner-renamed"
    assert verify_password(owner.password_hash, "ChangedByOwner123!")


async def test_first_initialization_refuses_any_existing_application_data(db_session):
    db_session.add(Plant(name="Existing", slug="existing", timezone="UTC"))
    await db_session.commit()
    with pytest.raises(ValueError, match="empty migrated"):
        await helper.apply_seed(
            db_session, {"initialized": False}, helper.new_credentials("owner"), None, days=0
        )
    assert await db_session.scalar(select(func.count()).select_from(User)) == 0


async def test_helper_can_seed_atomically_without_a_viewer(db_session):
    _, state = await helper.apply_seed(
        db_session, {"initialized": False}, helper.new_credentials("owner"), None, days=0
    )
    assert state["viewer_id"] is None
    await db_session.rollback()
    assert await db_session.scalar(select(func.count()).select_from(User)) == 0
    assert await db_session.scalar(select(func.count()).select_from(Plant)) == 0


async def test_pending_state_recovers_commit_and_preserves_credentials(db_session):
    before = {"initialized": False, "target": {"database": "oee_demo"}, "public_only": True}
    owner_data = helper.new_credentials("owner")
    _, pending = await helper.apply_seed(db_session, before, owner_data, None, days=0)
    await db_session.commit()
    recovered = await helper.recover_state(db_session, before, pending, owner_data)
    assert recovered == pending
    _, repeated = await helper.apply_seed(db_session, recovered, owner_data, None, days=0)
    assert repeated == pending
    await db_session.commit()
    assert await db_session.scalar(select(func.count()).select_from(User)) == 1
    owner = await db_session.get(User, pending["owner_id"])
    assert verify_password(owner.password_hash, owner_data["password"])
    with pytest.raises(ValueError, match="does not match"):
        await helper.recover_state(db_session, before, pending, helper.new_credentials("owner"))


async def test_pending_state_before_commit_allows_retry(db_session):
    before = {"initialized": False, "target": {"database": "oee_demo"}, "public_only": True}
    owner_data = helper.new_credentials("owner")
    _, pending = await helper.apply_seed(db_session, before, owner_data, None, days=0)
    await db_session.rollback()
    assert await helper.recover_state(db_session, before, pending, owner_data) == before


async def test_schema_guard_accepts_only_complete_oee_schema_without_connecting():
    from types import SimpleNamespace

    from app.db import Base

    class FakeSession:
        database = "oee_demo"
        tables = [("public", name) for name in (*Base.metadata.tables, "alembic_version")]

        async def scalar(self, _):
            return self.database

        async def execute(self, _):
            return SimpleNamespace(all=lambda: self.tables)

    fake = FakeSession()
    await helper.validate_schema(fake, "oee_demo")
    fake.database = "mes"
    with pytest.raises(ValueError, match="unexpected database"):
        await helper.validate_schema(fake, "oee_demo")
    fake.database = "oee_demo"
    fake.tables = [*fake.tables, ("public", "existing_mes_table")]
    with pytest.raises(ValueError, match="OEE schema"):
        await helper.validate_schema(fake, "oee_demo")
