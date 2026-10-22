"""Prepare OEE Live's Cloud SQL login and local backend configuration.

Run with backend/.venv/Scripts/python.exe scripts/configure-cloudsql.py.
Credentials are read from the ignored .env.cloud.local file and never printed.
The existing Alembic migrations must already have been applied by the administrator.
"""

import asyncio
import os
import secrets
from pathlib import Path

import asyncpg
from dotenv import dotenv_values
from sqlalchemy.engine import URL

ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = ROOT / ".env.cloud.local"
EXPECTED_REVISION = "0005_machine_board_positions"
EXPECTED_TABLES = frozenset(
    {
        "alert_rules",
        "downtime_reasons",
        "employees",
        "injection_recipes",
        "line_downtime_machines",
        "line_downtimes",
        "machine_checkpoints",
        "machine_board_positions",
        "machine_events",
        "machine_telemetry",
        "machine_variables",
        "machines",
        "molds",
        "notifications",
        "password_reset_tokens",
        "plant_members",
        "plants",
        "production_lines",
        "production_minutes",
        "production_orders",
        "production_runs",
        "production_samples",
        "products",
        "refresh_tokens",
        "resin_lots",
        "resins",
        "run_employees",
        "run_materials",
        "shifts",
        "users",
        "watchlist",
    }
)


def quoted(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


async def main() -> None:
    config = dotenv_values(CONFIG_FILE)
    password = config.get("CLOUD_SQL_ADMIN_PASSWORD")
    if not password:
        raise SystemExit(f"Completa CLOUD_SQL_ADMIN_PASSWORD en {CONFIG_FILE}")
    app_password = config.get("CLOUD_SQL_APP_PASSWORD")
    if not app_password:
        raise SystemExit("Falta CLOUD_SQL_APP_PASSWORD en la configuracion local.")
    host = config.get("CLOUD_SQL_HOST")
    database = config.get("CLOUD_SQL_DATABASE")
    admin_user = config.get("CLOUD_SQL_ADMIN_USER")
    if (host, database, admin_user, config.get("CLOUD_SQL_APP_USER")) != (
        "34.66.187.120",
        "oee_dev",
        "oee_admin",
        "oee_app",
    ):
        raise SystemExit("El destino no coincide con la instancia de desarrollo revisada.")
    connection_args = {
        "host": host,
        "port": int(config.get("CLOUD_SQL_PORT") or 5432),
        "database": database,
        "ssl": "require",
        "timeout": 10,
        "command_timeout": 20,
    }
    admin = await asyncpg.connect(**connection_args, user=admin_user, password=password)
    try:
        if await admin.fetchval("SELECT current_database()") != database:
            raise RuntimeError("Base de datos inesperada.")
        if (
            await admin.fetchval("SELECT version_num FROM public.alembic_version")
            != EXPECTED_REVISION
        ):
            raise RuntimeError("Las migraciones de OEE Live no estan completas.")
        async with admin.transaction():
            await admin.execute("SELECT pg_advisory_xact_lock(hashtext('oee-cloudsql-provision'))")
            existing = await admin.fetch(
                "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolcanlogin "
                "FROM pg_roles WHERE rolname IN ('oee_app_role', 'oee_app')"
            )
            roles = {row["rolname"]: row for row in existing}
            for row in existing:
                if any(
                    row[key]
                    for key in (
                        "rolsuper",
                        "rolcreatedb",
                        "rolcreaterole",
                        "rolreplication",
                    )
                ):
                    raise RuntimeError(
                        "Existe un rol con privilegios administrativos; revisar antes de continuar."
                    )
                if await admin.fetchval(
                    "SELECT pg_has_role($1, 'cloudsqlsuperuser', 'MEMBER')",
                    row["rolname"],
                ):
                    raise RuntimeError(
                        "Un rol existente pertenece a cloudsqlsuperuser; revisar manualmente."
                    )
            if "oee_app_role" not in roles:
                await admin.execute(
                    "CREATE ROLE oee_app_role NOLOGIN NOSUPERUSER NOCREATEDB "
                    "NOCREATEROLE NOREPLICATION"
                )
            if "oee_app" not in roles:
                # SQL utility statements don't support bind parameters for PASSWORD.
                # Quote using PostgreSQL itself; the result stays in memory.
                literal = await admin.fetchval("SELECT quote_literal($1::text)", app_password)
                await admin.execute(
                    "CREATE ROLE oee_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE "
                    "NOREPLICATION INHERIT PASSWORD " + literal
                )
            elif not roles["oee_app"]["rolcanlogin"]:
                raise RuntimeError(
                    "El usuario existente no tiene LOGIN; no se cambiaron sus atributos."
                )
            await admin.execute("GRANT CONNECT ON DATABASE oee_dev TO oee_app_role")
            await admin.execute("GRANT USAGE ON SCHEMA public TO oee_app_role")
            tables = await admin.fetch(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' "
                "AND tablename <> 'alembic_version' ORDER BY tablename"
            )
            if {table["tablename"] for table in tables} != EXPECTED_TABLES:
                raise RuntimeError("El conjunto de tablas no coincide con OEE Live.")
            for table in tables:
                await admin.execute(
                    "GRANT SELECT, INSERT, UPDATE, DELETE ON public."
                    + quoted(table["tablename"])
                    + " TO oee_app_role"
                )
            await admin.execute(
                "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oee_app_role"
            )
            await admin.execute(
                "ALTER DEFAULT PRIVILEGES FOR ROLE "
                + quoted(admin_user)
                + " IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oee_app_role"
            )
            await admin.execute(
                "ALTER DEFAULT PRIVILEGES FOR ROLE "
                + quoted(admin_user)
                + " IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO oee_app_role"
            )
            await admin.execute("REVOKE ALL PRIVILEGES ON public.alembic_version FROM oee_app_role")
            await admin.execute("GRANT oee_app_role TO oee_app")
    finally:
        await admin.close()

    app = await asyncpg.connect(**connection_args, user="oee_app", password=app_password)
    try:
        result = await app.fetchrow(
            "SELECT current_database() AS db, current_user AS login, "
            "has_schema_privilege(current_user, 'public', 'CREATE') AS can_create, "
            "has_table_privilege(current_user, 'public.users', 'INSERT') AS can_register, "
            "has_table_privilege(current_user, 'public.alembic_version', 'UPDATE') "
            "AS can_edit_migrations"
        )
        if result["can_create"] or result["can_edit_migrations"] or not result["can_register"]:
            raise RuntimeError("La verificacion de permisos del usuario no paso.")
        await app.fetchval("SELECT count(*) FROM public.users")
    finally:
        await app.close()

    target = ROOT / "backend" / ".env"
    if target.exists():
        raise RuntimeError(
            "backend/.env ya existe; no se sobrescribio. La cuenta de Cloud SQL esta preparada."
        )
    url = URL.create(
        "postgresql+asyncpg",
        username="oee_app",
        password=app_password,
        host=host,
        port=connection_args["port"],
        database=database,
        query={"ssl": "require"},
    ).render_as_string(hide_password=False)
    jwt_secret = secrets.token_urlsafe(48)

    contents = (
        "# Conexion de desarrollo de OEE Live a Cloud SQL; excluida de Git.\n"
        f"DATABASE_URL='{url}'\n"
        f"JWT_SECRET='{jwt_secret}'\n"
        "ENVIRONMENT=development\nREDIS_URL=redis://localhost:6379/0\n"
        "FRONTEND_URL=http://localhost:3000\nPUBLIC_API_URL=http://localhost:8000/api/v1\n"
        "SMTP_HOST=localhost\nSMTP_PORT=1025\nSMTP_STARTTLS=false\n"
    )
    fd = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
        stream.write(contents)
    deployment = ROOT / ".env.cloud.runtime"
    if not deployment.exists():
        admin_url = URL.create(
            "postgresql+asyncpg",
            username=admin_user,
            password=password,
            host=host,
            port=connection_args["port"],
            database=database,
            query={"ssl": "require"},
        ).render_as_string(hide_password=False)
        deployment_contents = (
            "# Exclusivo de docker-compose.cloud.yml; excluido de Git.\n"
            f"CLOUD_SQL_DATABASE_URL='{url}'\n"
            f"CLOUD_SQL_MIGRATION_DATABASE_URL='{admin_url}'\n"
            f"JWT_SECRET='{jwt_secret}'\n"
            "# Completar antes del despliegue HTTPS.\n"
            "DOMAIN=\nACME_EMAIL=\nSMTP_HOST=\nSMTP_PORT=587\n"
            "SMTP_USER=\nSMTP_PASSWORD=\nSMTP_FROM=\n"
        )
        fd = os.open(deployment, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(deployment_contents)
    print(
        "Cloud SQL: usuario de aplicacion verificado, permisos limitados y backend/.env preparado."
    )
    print("Reinicia la API de OEE Live para utilizar la nueva conexion.")
    print("La configuracion de despliegue esta en .env.cloud.runtime; completa dominio y SMTP.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (asyncpg.PostgresError, OSError, TimeoutError) as error:
        raise SystemExit(
            f"Cloud SQL no se pudo configurar ({type(error).__name__}). "
            "No se muestran credenciales."
        ) from None
