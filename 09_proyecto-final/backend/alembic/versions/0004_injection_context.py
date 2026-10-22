"""Injection catalogs, cavities, production runs, line stops and raw telemetry."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0004_injection_context"
down_revision = "0003_machine_checkpoints"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "production_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["plant_id"],
            ["plants.id"],
            name=op.f("fk_production_lines_plant_id_plants"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_production_lines")),
        sa.UniqueConstraint("id", "plant_id", name=op.f("uq_production_lines_id")),
        sa.UniqueConstraint("plant_id", "code", name=op.f("uq_production_lines_plant_id")),
    )
    op.create_index(
        op.f("ix_production_lines_plant_id"), "production_lines", ["plant_id"], unique=False
    )
    op.add_column("machines", sa.Column("line_id", sa.Integer(), nullable=True))
    op.create_unique_constraint("uq_machines_id_plant_id", "machines", ["id", "plant_id"])
    op.create_foreign_key(
        "fk_machines_line_id_production_lines",
        "machines",
        "production_lines",
        ["line_id", "plant_id"],
        ["id", "plant_id"],
        ondelete="NO ACTION",
        deferrable=True,
        initially="IMMEDIATE",
    )
    op.create_index("ix_machines_line_id", "machines", ["line_id"], unique=False)
    op.create_table(
        "employees",
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["plant_id"],
            ["plants.id"],
            name=op.f("fk_employees_plant_id_plants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_employees_user_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_employees")),
        sa.UniqueConstraint("id", "plant_id", name=op.f("uq_employees_id")),
        sa.UniqueConstraint("plant_id", "code", name=op.f("uq_employees_plant_id")),
        sa.UniqueConstraint("plant_id", "user_id", name="uq_employees_plant_user"),
    )
    op.create_index(op.f("ix_employees_plant_id"), "employees", ["plant_id"], unique=False)
    op.create_table(
        "molds",
        sa.Column("nominal_cavities", sa.Integer(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("nominal_cavities > 0", name=op.f("ck_molds_cavities")),
        sa.ForeignKeyConstraint(
            ["plant_id"], ["plants.id"], name=op.f("fk_molds_plant_id_plants"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_molds")),
        sa.UniqueConstraint("id", "plant_id", name=op.f("uq_molds_id")),
        sa.UniqueConstraint("plant_id", "code", name=op.f("uq_molds_plant_id")),
    )
    op.create_index(op.f("ix_molds_plant_id"), "molds", ["plant_id"], unique=False)
    op.create_table(
        "products",
        sa.Column("part_weight_g", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("part_weight_g > 0", name=op.f("ck_products_weight")),
        sa.ForeignKeyConstraint(
            ["plant_id"],
            ["plants.id"],
            name=op.f("fk_products_plant_id_plants"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_products")),
        sa.UniqueConstraint("id", "plant_id", name=op.f("uq_products_id")),
        sa.UniqueConstraint("plant_id", "code", name=op.f("uq_products_plant_id")),
    )
    op.create_index(op.f("ix_products_plant_id"), "products", ["plant_id"], unique=False)
    op.create_table(
        "resins",
        sa.Column("polymer", sa.String(length=40), nullable=False),
        sa.Column("grade", sa.String(length=80), nullable=False),
        sa.Column("manufacturer", sa.String(length=120), server_default="", nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["plant_id"], ["plants.id"], name=op.f("fk_resins_plant_id_plants"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_resins")),
        sa.UniqueConstraint("id", "plant_id", name=op.f("uq_resins_id")),
        sa.UniqueConstraint("plant_id", "code", name=op.f("uq_resins_plant_id")),
    )
    op.create_index(op.f("ix_resins_plant_id"), "resins", ["plant_id"], unique=False)
    op.create_table(
        "injection_recipes",
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("mold_id", sa.Integer(), nullable=False),
        sa.Column("resin_id", sa.Integer(), nullable=False),
        sa.Column("ideal_cycle_s", sa.Numeric(precision=10, scale=4), nullable=False),
        sa.Column("active_cavities", sa.Integer(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("active_cavities > 0", name=op.f("ck_injection_recipes_cavities")),
        sa.CheckConstraint(
            "ideal_cycle_s > 0 AND ideal_cycle_s <= 3600", name=op.f("ck_injection_recipes_cycle")
        ),
        sa.ForeignKeyConstraint(
            ["mold_id", "plant_id"],
            ["molds.id", "molds.plant_id"],
            name=op.f("fk_injection_recipes_mold_id_molds"),
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.ForeignKeyConstraint(
            ["plant_id"],
            ["plants.id"],
            name=op.f("fk_injection_recipes_plant_id_plants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id", "plant_id"],
            ["products.id", "products.plant_id"],
            name=op.f("fk_injection_recipes_product_id_products"),
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.ForeignKeyConstraint(
            ["resin_id", "plant_id"],
            ["resins.id", "resins.plant_id"],
            name=op.f("fk_injection_recipes_resin_id_resins"),
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_injection_recipes")),
        sa.UniqueConstraint("id", "plant_id", name=op.f("uq_injection_recipes_id")),
        sa.UniqueConstraint("plant_id", "code", name=op.f("uq_injection_recipes_plant_id")),
    )
    op.create_index(
        op.f("ix_injection_recipes_plant_id"), "injection_recipes", ["plant_id"], unique=False
    )
    op.create_table(
        "line_downtimes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("line_id", sa.Integer(), nullable=False),
        sa.Column("reason_code", sa.String(length=32), nullable=False),
        sa.Column("planned", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("comment", sa.Text(), server_default="", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("ended_by", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at > started_at", name=op.f("ck_line_downtimes_interval")
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_line_downtimes_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["ended_by"],
            ["users.id"],
            name=op.f("fk_line_downtimes_ended_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["line_id", "plant_id"],
            ["production_lines.id", "production_lines.plant_id"],
            name=op.f("fk_line_downtimes_line_id_production_lines"),
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.ForeignKeyConstraint(
            ["plant_id"],
            ["plants.id"],
            name=op.f("fk_line_downtimes_plant_id_plants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reason_code"],
            ["downtime_reasons.code"],
            name=op.f("fk_line_downtimes_reason_code_downtime_reasons"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_line_downtimes")),
    )
    op.create_index(op.f("ix_line_downtimes_line_id"), "line_downtimes", ["line_id"], unique=False)
    op.create_index(
        "uq_line_downtimes_open",
        "line_downtimes",
        ["line_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
        sqlite_where=sa.text("ended_at IS NULL"),
    )
    op.create_table(
        "resin_lots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("resin_id", sa.Integer(), nullable=False),
        sa.Column("lot_code", sa.String(length=80), nullable=False),
        sa.Column("received_kg", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("received_kg > 0", name=op.f("ck_resin_lots_quantity")),
        sa.ForeignKeyConstraint(
            ["plant_id"],
            ["plants.id"],
            name=op.f("fk_resin_lots_plant_id_plants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["resin_id", "plant_id"],
            ["resins.id", "resins.plant_id"],
            name=op.f("fk_resin_lots_resin_id_resins"),
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_resin_lots")),
        sa.UniqueConstraint("id", "plant_id", name=op.f("uq_resin_lots_id")),
        sa.UniqueConstraint("resin_id", "lot_code", name=op.f("uq_resin_lots_resin_id")),
    )
    op.create_index(op.f("ix_resin_lots_plant_id"), "resin_lots", ["plant_id"], unique=False)
    op.create_table(
        "machine_variables",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("unit", sa.String(length=24), nullable=False),
        sa.Column("map_version", sa.String(length=64), server_default="custom-v1", nullable=False),
        sa.Column("address", sa.Integer(), nullable=False),
        sa.Column("data_type", sa.String(length=8), nullable=False),
        sa.Column("word_order", sa.String(length=6), server_default="big", nullable=False),
        sa.Column("byte_order", sa.String(length=6), server_default="big", nullable=False),
        sa.Column("scale", sa.Float(), server_default="1", nullable=False),
        sa.Column("offset", sa.Float(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint(
            "data_type IN ('uint16','int16','uint32','int32','float32')",
            name=op.f("ck_machine_variables_type"),
        ),
        sa.CheckConstraint(
            "word_order IN ('big','little') AND byte_order IN ('big','little')",
            name=op.f("ck_machine_variables_order"),
        ),
        sa.CheckConstraint(
            "address BETWEEN 9 AND 65534", name=op.f("ck_machine_variables_address")
        ),
        sa.CheckConstraint("scale <> 0", name=op.f("ck_machine_variables_scale")),
        sa.ForeignKeyConstraint(
            ["machine_id"],
            ["machines.id"],
            name=op.f("fk_machine_variables_machine_id_machines"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_machine_variables")),
        sa.UniqueConstraint("machine_id", "code", name=op.f("uq_machine_variables_machine_id")),
    )
    op.create_index(
        op.f("ix_machine_variables_machine_id"), "machine_variables", ["machine_id"], unique=False
    )
    op.create_table(
        "production_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("recipe_id", sa.Integer(), nullable=False),
        sa.Column("target_pieces", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=10), server_default="planned", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('planned','running','completed','cancelled')",
            name=op.f("ck_production_orders_status"),
        ),
        sa.CheckConstraint("target_pieces > 0", name=op.f("ck_production_orders_target")),
        sa.ForeignKeyConstraint(
            ["plant_id"],
            ["plants.id"],
            name=op.f("fk_production_orders_plant_id_plants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recipe_id", "plant_id"],
            ["injection_recipes.id", "injection_recipes.plant_id"],
            name=op.f("fk_production_orders_recipe_id_injection_recipes"),
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_production_orders")),
        sa.UniqueConstraint("id", "plant_id", name=op.f("uq_production_orders_id")),
        sa.UniqueConstraint("plant_id", "code", name=op.f("uq_production_orders_plant_id")),
    )
    op.create_index(
        op.f("ix_production_orders_plant_id"), "production_orders", ["plant_id"], unique=False
    )
    op.create_table(
        "production_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.Column("mold_id", sa.Integer(), nullable=False),
        sa.Column(
            "context",
            postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"),
            nullable=False,
        ),
        sa.Column("nominal_cavities", sa.Integer(), nullable=False),
        sa.Column("active_cavities", sa.Integer(), nullable=False),
        sa.Column("ideal_cycle_s", sa.Numeric(precision=10, scale=4), nullable=False),
        sa.Column("part_weight_g", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("started_by", sa.Integer(), nullable=True),
        sa.Column("ended_by", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "active_cavities > 0 AND active_cavities <= nominal_cavities",
            name=op.f("ck_production_runs_cavities"),
        ),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at > started_at", name=op.f("ck_production_runs_interval")
        ),
        sa.CheckConstraint(
            "ideal_cycle_s > 0 AND part_weight_g > 0", name=op.f("ck_production_runs_standards")
        ),
        sa.ForeignKeyConstraint(
            ["ended_by"],
            ["users.id"],
            name=op.f("fk_production_runs_ended_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["machine_id", "plant_id"],
            ["machines.id", "machines.plant_id"],
            name=op.f("fk_production_runs_machine_id_machines"),
            ondelete="CASCADE",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.ForeignKeyConstraint(
            ["mold_id", "plant_id"],
            ["molds.id", "molds.plant_id"],
            name=op.f("fk_production_runs_mold_id_molds"),
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.ForeignKeyConstraint(
            ["order_id", "plant_id"],
            ["production_orders.id", "production_orders.plant_id"],
            name=op.f("fk_production_runs_order_id_production_orders"),
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.ForeignKeyConstraint(
            ["plant_id"],
            ["plants.id"],
            name=op.f("fk_production_runs_plant_id_plants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["started_by"],
            ["users.id"],
            name=op.f("fk_production_runs_started_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_production_runs")),
        sa.UniqueConstraint("id", "plant_id", name=op.f("uq_production_runs_id")),
    )
    op.create_index(
        "ix_production_runs_machine_started",
        "production_runs",
        ["machine_id", "started_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_production_runs_plant_id"), "production_runs", ["plant_id"], unique=False
    )
    op.create_index(
        "uq_production_runs_open_machine",
        "production_runs",
        ["machine_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
        sqlite_where=sa.text("ended_at IS NULL"),
    )
    op.create_index(
        "uq_production_runs_open_mold",
        "production_runs",
        ["mold_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
        sqlite_where=sa.text("ended_at IS NULL"),
    )
    op.create_table(
        "machine_telemetry",
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.Column("sampled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=24), server_default="modbus", nullable=False),
        sa.Column(
            "values",
            postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["machine_id"],
            ["machines.id"],
            name=op.f("fk_machine_telemetry_machine_id_machines"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["production_runs.id"],
            name=op.f("fk_machine_telemetry_run_id_production_runs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("machine_id", "sampled_at", name=op.f("pk_machine_telemetry")),
    )
    op.create_index(
        "ix_machine_telemetry_run_time", "machine_telemetry", ["run_id", "sampled_at"], unique=False
    )
    op.create_table(
        "run_employees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "role IN ('operator','technician','quality','supervisor')",
            name=op.f("ck_run_employees_role"),
        ),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at > started_at", name=op.f("ck_run_employees_interval")
        ),
        sa.ForeignKeyConstraint(
            ["employee_id", "plant_id"],
            ["employees.id", "employees.plant_id"],
            name=op.f("fk_run_employees_employee_id_employees"),
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.ForeignKeyConstraint(
            ["plant_id"],
            ["plants.id"],
            name=op.f("fk_run_employees_plant_id_plants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id", "plant_id"],
            ["production_runs.id", "production_runs.plant_id"],
            name=op.f("fk_run_employees_run_id_production_runs"),
            ondelete="CASCADE",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_run_employees")),
    )
    op.create_index(op.f("ix_run_employees_run_id"), "run_employees", ["run_id"], unique=False)
    op.create_index(
        "uq_run_employees_open",
        "run_employees",
        ["run_id", "employee_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
        sqlite_where=sa.text("ended_at IS NULL"),
    )
    op.create_table(
        "run_materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("resin_lot_id", sa.Integer(), nullable=False),
        sa.Column("consumed_kg", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_by", sa.Integer(), nullable=True),
        sa.CheckConstraint("consumed_kg > 0", name=op.f("ck_run_materials_quantity")),
        sa.ForeignKeyConstraint(
            ["plant_id"],
            ["plants.id"],
            name=op.f("fk_run_materials_plant_id_plants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by"],
            ["users.id"],
            name=op.f("fk_run_materials_recorded_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["resin_lot_id", "plant_id"],
            ["resin_lots.id", "resin_lots.plant_id"],
            name=op.f("fk_run_materials_resin_lot_id_resin_lots"),
            ondelete="NO ACTION",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.ForeignKeyConstraint(
            ["run_id", "plant_id"],
            ["production_runs.id", "production_runs.plant_id"],
            name=op.f("fk_run_materials_run_id_production_runs"),
            ondelete="CASCADE",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_run_materials")),
    )
    op.create_index(op.f("ix_run_materials_run_id"), "run_materials", ["run_id"], unique=False)

    op.create_table(
        "line_downtime_machines",
        sa.Column("downtime_id", sa.Integer(), nullable=False),
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["downtime_id"],
            ["line_downtimes.id"],
            name=op.f("fk_line_downtime_machines_downtime_id_line_downtimes"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["machine_id"],
            ["machines.id"],
            name=op.f("fk_line_downtime_machines_machine_id_machines"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "downtime_id", "machine_id", name=op.f("pk_line_downtime_machines")
        ),
    )
    op.create_index(
        "ix_line_downtime_machines_machine_downtime",
        "line_downtime_machines",
        ["machine_id", "downtime_id"],
        unique=False,
    )


def downgrade():
    op.drop_table("line_downtime_machines")
    op.drop_table("run_materials")
    op.drop_table("run_employees")
    op.drop_table("machine_telemetry")
    op.drop_table("production_runs")
    op.drop_table("production_orders")
    op.drop_table("machine_variables")
    op.drop_table("resin_lots")
    op.drop_table("line_downtimes")
    op.drop_table("injection_recipes")
    op.drop_table("resins")
    op.drop_table("products")
    op.drop_table("molds")
    op.drop_table("employees")
    op.drop_index("ix_machines_line_id", table_name="machines")
    op.drop_constraint("fk_machines_line_id_production_lines", "machines", type_="foreignkey")
    op.drop_constraint("uq_machines_id_plant_id", "machines", type_="unique")
    op.drop_column("machines", "line_id")
    op.drop_table("production_lines")
