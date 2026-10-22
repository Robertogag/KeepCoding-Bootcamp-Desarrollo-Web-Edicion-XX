"""Persist machine positions within a normalized plant board."""

import sqlalchemy as sa

from alembic import op

revision = "0005_machine_board_positions"
down_revision = "0004_injection_context"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "machine_board_positions",
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("width", sa.Float(), nullable=False),
        sa.Column("height", sa.Float(), nullable=False),
        sa.Column("rotation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "x >= 0 AND x <= 1 AND y >= 0 AND y <= 1",
            name=op.f("ck_machine_board_positions_origin"),
        ),
        sa.CheckConstraint(
            "width > 0 AND width <= 1 AND height > 0 AND height <= 1",
            name=op.f("ck_machine_board_positions_size"),
        ),
        sa.CheckConstraint(
            "x + width <= 1 AND y + height <= 1", name=op.f("ck_machine_board_positions_bounds")
        ),
        sa.CheckConstraint(
            "rotation IN (0, 90, 180, 270)", name=op.f("ck_machine_board_positions_rotation")
        ),
        sa.ForeignKeyConstraint(
            ["machine_id"],
            ["machines.id"],
            name=op.f("fk_machine_board_positions_machine_id_machines"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("machine_id", name=op.f("pk_machine_board_positions")),
    )


def downgrade():
    op.drop_table("machine_board_positions")
