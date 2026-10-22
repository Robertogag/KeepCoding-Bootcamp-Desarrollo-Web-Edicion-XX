"""Provision the isolated VM demo; secrets are written to private files, never stdout.

Run inside the backend container as root with /opt/oee-live/private mounted at
/private. Requires ENVIRONMENT=production, OEE_PUBLIC_DEMO_VM=1 and DATABASE_URL.
Example: python /seed-public-demo.py --database-name oee_demo --private-dir /private
         --config /app/simulator/machines.yaml
The API/collector must be stopped on the first run. Start them after this succeeds.
"""

import argparse
import asyncio
import json
import logging
import os
import re
import secrets
import stat
import sys
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.engine import make_url


class DemoSeedError(ValueError):
    """Only fixed, safe operational messages may be included in this exception."""


def source_backend(script_path):
    parents = script_path.parents
    return parents[2] / "backend" if len(parents) > 2 else None


def validate_target(environment, database_name, platform=sys.platform):
    """Validate explicit deployment intent before importing app settings or connecting."""
    if platform != "linux" or environment.get("OEE_PUBLIC_DEMO_VM") != "1":
        raise DemoSeedError("This helper is restricted to the explicitly marked Linux OEE demo VM")
    if environment.get("ENVIRONMENT") != "production":
        raise DemoSeedError("ENVIRONMENT=production is required")
    raw_url = environment.get("DATABASE_URL", "")
    try:
        target = make_url(raw_url)
    except Exception:
        raise DemoSeedError("An explicit valid DATABASE_URL is required") from None
    if (
        target.drivername != "postgresql+asyncpg"
        or not re.fullmatch(r"oee(?:_[a-z0-9]+)*", database_name)
        or target.database != database_name
        or not target.host
    ):
        raise DemoSeedError("DATABASE_URL must target the explicitly named OEE PostgreSQL database")
    # Deliberately excludes the database password; rotating it must not rotate app users.
    return {"host": target.host, "port": target.port or 5432, "database": database_name}


def new_credentials(role):
    username = f"{role}-{secrets.token_hex(6)}"
    return {
        "username": username,
        "password": "Aa7!" + secrets.token_urlsafe(32),
        "email": f"{username}@demo.invalid",
        "full_name": "Propietario Demo" if role == "owner" else "Profesor Demo",
        "language": "es",
        "role": role,
    }


def read_private(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or (os.name == "posix" and info.st_mode & 0o077):
        raise DemoSeedError("Credential/state files must be regular private files (0600)")
    return json.loads(path.read_text(encoding="utf-8"))


def write_private(path, payload):
    """Atomic replacement, with restrictive permissions from initial creation."""
    temporary = path.with_name(f".{path.name}.{secrets.token_hex(6)}.tmp")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(payload, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def prepare_private(directory, target, public_only):
    if not directory.is_absolute() or directory.is_symlink():
        raise DemoSeedError(
            "--private-dir must be an absolute private directory outside the release"
        )
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name == "posix" and directory.stat().st_mode & 0o077:
        raise DemoSeedError("--private-dir must have permissions 0700")
    state_path = directory / "seed-state.json"
    if state_path.exists():
        state = read_private(state_path)
        if state.get("target") != target or state.get("public_only") != public_only:
            raise DemoSeedError("Existing seed state belongs to a different target or access mode")
    else:
        state = {"version": 1, "target": target, "public_only": public_only, "initialized": False}
        write_private(state_path, state)
    for role in ("owner",) if public_only else ("owner", "viewer"):
        path = directory / f"{role}.json"
        if not path.exists():
            if state["initialized"]:
                raise DemoSeedError(
                    "A credential file is missing; existing accounts will not be rotated"
                )
            write_private(path, new_credentials(role))
    return (
        state,
        read_private(directory / "owner.json"),
        (None if public_only else read_private(directory / "viewer.json")),
    )


async def validate_schema(session, database_name):
    # Import the models before inspecting metadata: a standalone helper does not import app.main.
    from app.models import Plant

    if await session.scalar(text("SELECT current_database()")) != database_name:
        raise DemoSeedError("Connected to an unexpected database")
    tables = (
        await session.execute(
            text("""
        SELECT schemaname, tablename FROM pg_catalog.pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          AND schemaname NOT LIKE 'pg_toast%'
    """)
        )
    ).all()
    expected = set(Plant.metadata.tables) | {"alembic_version"}
    if {name for schema, name in tables if schema == "public"} != expected or any(
        schema != "public" for schema, _ in tables
    ):
        raise DemoSeedError("Expected only the fully migrated OEE schema in the isolated database")


async def apply_seed(session, state, owner_data, viewer_data, *, days=7, config_path=None):
    """One transaction; reruns preserve existing passwords, roles and user edits."""
    from app.db import Base
    from app.models import Plant, PlantMember, User
    from app.seed import seed
    from app.services.auth import hash_password

    if state.get("initialized"):
        owner = await session.get(User, state["owner_id"])
        plant = await session.get(Plant, state["plant_id"])
        if owner is None or plant is None or plant.slug != "planta-demo-slp":
            raise DemoSeedError(
                "The original demo identity is missing; no account will be recreated"
            )
    else:
        for table in Base.metadata.sorted_tables:
            if await session.scalar(select(1).select_from(table).limit(1)) is not None:
                raise DemoSeedError("First initialization requires an empty migrated OEE database")
        owner = User(
            **{key: owner_data[key] for key in ("username", "email", "full_name", "language")},
            password_hash=hash_password(owner_data["password"]),
        )
        session.add(owner)
        await session.flush()

    result = await seed(session, days=days, config_path=config_path, owner=owner, commit=False)
    plant_id = result["plant_id"]
    viewer_id = state.get("viewer_id")
    if viewer_data is not None:
        if state.get("initialized"):
            viewer = await session.get(User, viewer_id)
            membership = await session.get(PlantMember, (plant_id, viewer_id))
            if viewer is None or membership is None or membership.role != "viewer":
                raise DemoSeedError(
                    "Original viewer access changed; no role or account will be reset"
                )
        else:
            viewer = User(
                **{key: viewer_data[key] for key in ("username", "email", "full_name", "language")},
                password_hash=hash_password(viewer_data["password"]),
            )
            session.add(viewer)
            await session.flush()
            viewer_id = viewer.id
            session.add(PlantMember(plant_id=plant_id, user_id=viewer_id, role="viewer"))
    await session.flush()
    return result, {
        **state,
        "initialized": True,
        "owner_id": owner.id,
        "viewer_id": viewer_id,
        "plant_id": plant_id,
    }


async def provision(args, target):
    from app.db import SessionLocal, engine

    state, owner, viewer = prepare_private(args.private_dir, target, args.public_only)
    async with SessionLocal() as session:
        await session.execute(text("SELECT pg_advisory_xact_lock(78401121)"))
        await validate_schema(session, args.database_name)
        pending_path = args.private_dir / "seed-pending.json"
        if pending_path.exists():
            pending = read_private(pending_path)
            state = await recover_state(session, state, pending, owner)
        result, initialized = await apply_seed(
            session, state, owner, viewer, days=7, config_path=args.config
        )
        # Save identity before commit. An interrupted commit is recoverable using pending state.
        write_private(args.private_dir / "seed-pending.json", initialized)
        await session.commit()
        write_private(args.private_dir / "seed-state.json", initialized)
        (args.private_dir / "seed-pending.json").unlink(missing_ok=True)
    await engine.dispose()
    print(
        json.dumps({**result, "access": "public-only" if args.public_only else "public-and-viewer"})
    )


async def recover_state(session, state, pending, owner_data):
    """Resolve a crash around commit using the original identities, without rotating anything."""
    from app.models import Plant, PlantMember, User

    if pending.get("target") != state.get("target") or pending.get("public_only") != state.get(
        "public_only"
    ):
        raise DemoSeedError("Pending seed belongs to another target")
    saved_owner = await session.get(User, pending["owner_id"])
    saved_plant = await session.get(Plant, pending["plant_id"])
    if saved_owner is not None and saved_plant is not None:
        membership = await session.get(PlantMember, (saved_plant.id, saved_owner.id))
        if (
            saved_plant.slug != "planta-demo-slp"
            or membership is None
            or membership.role != "owner"
            or (not state["initialized"] and saved_owner.username != owner_data["username"])
        ):
            raise DemoSeedError("Interrupted seed identity does not match; refusing to modify it")
        return pending
    if saved_owner is not None or saved_plant is not None or state["initialized"]:
        raise DemoSeedError("Interrupted seed identity is inconsistent; refusing to modify it")
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-name", required=True)
    parser.add_argument("--private-dir", type=Path, required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--public-only", action="store_true", help="Do not create a viewer account")
    args = parser.parse_args()
    try:
        target = validate_target(os.environ, args.database_name)
        # In the VM container the app package is installed; source checkout also works.
        backend = source_backend(Path(__file__).resolve())
        if backend is not None and backend.is_dir():
            sys.path.insert(0, str(backend))
        import fcntl

        if not args.private_dir.is_absolute() or args.private_dir.is_symlink():
            raise DemoSeedError("An absolute private directory is required")
        args.private_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        if args.private_dir.stat().st_mode & 0o077:
            raise DemoSeedError("The private directory must have permissions 0700")
        lock_path = args.private_dir / ".seed.lock"
        descriptor = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, "w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            asyncio.run(provision(args, target))
    except DemoSeedError as error:
        logging.error("Demo seed refused: %s", error)
        raise SystemExit(1) from None
    except Exception as error:
        # SQLAlchemy exceptions may contain credentials/bound values: never print them.
        logging.error("Demo seed failed (%s). No credentials were logged.", type(error).__name__)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
