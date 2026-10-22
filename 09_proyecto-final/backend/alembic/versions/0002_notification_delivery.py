"""Entrega persistente de notificaciones pendientes."""

import sqlalchemy as sa

from alembic import op

revision = "0002_notification_delivery"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "notifications", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(
        "ix_notifications_pending",
        "notifications",
        ["created_at"],
        postgresql_where=sa.text("delivered_at IS NULL"),
        sqlite_where=sa.text("delivered_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_pending", table_name="notifications")
    op.drop_column("notifications", "delivered_at")
