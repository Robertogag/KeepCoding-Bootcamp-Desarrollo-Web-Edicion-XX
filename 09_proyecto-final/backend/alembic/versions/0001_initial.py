"""Esquema inicial de producción, usuarios y alertas."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(30), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("full_name", sa.String(80), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("language", sa.String(2), nullable=False, server_default="es"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("language IN ('es', 'en')", name=op.f("ck_users_language")),
        sa.UniqueConstraint("username", name=op.f("uq_users_username")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_index("uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True)
    op.create_table(
        "plants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("slug", name=op.f("uq_plants_slug")),
    )
    op.create_index("ix_plants_is_public", "plants", ["is_public"])
    op.create_table(
        "plant_members",
        sa.Column(
            "plant_id",
            sa.Integer(),
            sa.ForeignKey("plants.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("role", sa.String(10), nullable=False),
        sa.CheckConstraint(
            "role IN ('owner', 'supervisor', 'viewer')", name=op.f("ck_plant_members_role")
        ),
    )
    op.create_index("ix_plant_members_user_id", "plant_members", ["user_id"])
    op.create_table(
        "machines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "plant_id", sa.Integer(), sa.ForeignKey("plants.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("brand", sa.String(80), nullable=False, server_default=""),
        sa.Column("model", sa.String(80), nullable=False, server_default=""),
        sa.Column("host", sa.String(253), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False, server_default="502"),
        sa.Column("unit_id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("ideal_cycle_s", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("photo_key", sa.String(64), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("plant_id", "slug", name="uq_machines_plant_slug"),
        sa.CheckConstraint("port BETWEEN 1 AND 65535", name=op.f("ck_machines_port")),
        sa.CheckConstraint("unit_id BETWEEN 1 AND 247", name=op.f("ck_machines_unit_id")),
        sa.CheckConstraint(
            "ideal_cycle_s BETWEEN 0.1 AND 3600", name=op.f("ck_machines_ideal_cycle")
        ),
    )
    op.create_index("ix_machines_plant_id", "machines", ["plant_id"])
    op.create_index("ix_machines_is_active", "machines", ["is_active"])
    op.create_table(
        "shifts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "plant_id", sa.Integer(), sa.ForeignKey("plants.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column(
            "days_of_week",
            postgresql.ARRAY(sa.Integer()).with_variant(sa.JSON(), "sqlite"),
            nullable=False,
        ),
        sa.CheckConstraint("start_time <> end_time", name=op.f("ck_shifts_nonempty_interval")),
        sa.CheckConstraint(
            "cardinality(days_of_week) BETWEEN 1 AND 7 AND days_of_week <@ ARRAY[1,2,3,4,5,6,7]",
            name=op.f("ck_shifts_days_of_week"),
        ).ddl_if(dialect="postgresql"),
    )
    op.create_index("ix_shifts_plant_id", "shifts", ["plant_id"])
    op.create_table(
        "downtime_reasons",
        sa.Column("code", sa.String(32), primary_key=True),
        sa.Column("label_es", sa.String(120), nullable=False),
        sa.Column("label_en", sa.String(120), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.CheckConstraint(
            "category IN ('mecanica','electrica','material','calidad','organizacional','otro')",
            name=op.f("ck_downtime_reasons_category"),
        ),
    )
    op.create_table(
        "machine_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "machine_id",
            sa.Integer(),
            sa.ForeignKey("machines.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("state", sa.String(7), nullable=False),
        sa.Column("reason_code", sa.String(32), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "classified_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "state IN ('RUNNING','IDLE','DOWN','OFFLINE')", name=op.f("ck_machine_events_state")
        ),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at", name=op.f("ck_machine_events_interval")
        ),
    )
    op.create_index(
        "ix_machine_events_machine_started", "machine_events", ["machine_id", "started_at"]
    )
    op.create_index(
        "uq_machine_events_open",
        "machine_events",
        ["machine_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
        sqlite_where=sa.text("ended_at IS NULL"),
    )
    op.create_table(
        "production_minutes",
        sa.Column(
            "machine_id",
            sa.Integer(),
            sa.ForeignKey("machines.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("bucket_start", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("good", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("reject", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("run_s", sa.Float(), nullable=False, server_default="0"),
        sa.Column("idle_s", sa.Float(), nullable=False, server_default="0"),
        sa.Column("down_s", sa.Float(), nullable=False, server_default="0"),
        sa.Column("offline_s", sa.Float(), nullable=False, server_default="0"),
        sa.CheckConstraint("good >= 0 AND reject >= 0", name=op.f("ck_production_minutes_counts")),
        sa.CheckConstraint(
            "run_s >= 0 AND idle_s >= 0 AND down_s >= 0 AND offline_s >= 0",
            name=op.f("ck_production_minutes_durations"),
        ),
    )
    op.create_table(
        "production_samples",
        sa.Column(
            "machine_id",
            sa.Integer(),
            sa.ForeignKey("machines.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("sampled_at", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("good", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("reject", sa.BigInteger(), nullable=False, server_default="0"),
        sa.CheckConstraint("good >= 0 AND reject >= 0", name=op.f("ck_production_samples_counts")),
    )
    op.create_table(
        "alert_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "plant_id", sa.Integer(), sa.ForeignKey("plants.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "machine_id",
            sa.Integer(),
            sa.ForeignKey("machines.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=True),
        sa.Column("duration_s", sa.Integer(), nullable=False, server_default="180"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.CheckConstraint(
            "type IN ('MACHINE_DOWN','MACHINE_OFFLINE','OEE_BELOW')",
            name=op.f("ck_alert_rules_type"),
        ),
        sa.CheckConstraint(
            "(type = 'OEE_BELOW' AND threshold IS NOT NULL AND threshold BETWEEN 0 AND 1) "
            "OR (type <> 'OEE_BELOW' AND threshold IS NULL)",
            name=op.f("ck_alert_rules_threshold"),
        ),
        sa.CheckConstraint("duration_s BETWEEN 30 AND 86400", name=op.f("ck_alert_rules_duration")),
    )
    op.create_index("ix_alert_rules_plant_id", "alert_rules", ["plant_id"])
    op.create_index("ix_alert_rules_machine_id", "alert_rules", ["machine_id"])
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("payload", postgresql.JSONB().with_variant(sa.JSON(), "sqlite"), nullable=False),
        sa.Column("dedupe_key", sa.String(255), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("emailed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "type IN ('MACHINE_DOWN','MACHINE_OFFLINE','OEE_BELOW')",
            name=op.f("ck_notifications_type"),
        ),
        sa.UniqueConstraint("user_id", "dedupe_key", name="uq_notifications_user_dedupe"),
    )
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", "created_at"])
    op.create_table(
        "watchlist",
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column(
            "machine_id",
            sa.Integer(),
            sa.ForeignKey("machines.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("ix_watchlist_machine_id", "watchlist", ["machine_id"])
    op.create_table(
        "password_reset_tokens",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index("ix_password_reset_tokens_expires_at", "password_reset_tokens", ["expires_at"])
    op.create_table(
        "refresh_tokens",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("family_id", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"])
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_table("password_reset_tokens")
    op.drop_table("watchlist")
    op.drop_table("notifications")
    op.drop_table("alert_rules")
    op.drop_table("production_samples")
    op.drop_table("production_minutes")
    op.drop_table("machine_events")
    op.drop_table("downtime_reasons")
    op.drop_table("shifts")
    op.drop_table("machines")
    op.drop_table("plant_members")
    op.drop_table("plants")
    op.drop_table("users")
