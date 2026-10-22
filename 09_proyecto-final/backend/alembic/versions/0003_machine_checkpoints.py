"""Persist the last accounted instant and absolute counters atomically with telemetry."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0003_machine_checkpoints"
down_revision = "0002_notification_delivery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "machine_checkpoints",
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.Column("accounted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("snapshot", postgresql.JSONB().with_variant(sa.JSON(), "sqlite"), nullable=False),
        sa.Column("progress", postgresql.JSONB().with_variant(sa.JSON(), "sqlite"), nullable=False),
        sa.ForeignKeyConstraint(
            ["machine_id"],
            ["machines.id"],
            name="fk_machine_checkpoints_machine_id_machines",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("machine_id", name="pk_machine_checkpoints"),
    )


def downgrade() -> None:
    op.drop_table("machine_checkpoints")
