"""Add last_response_id to chat_sessions for Responses API chaining

Revision ID: 002
Revises: 001
Create Date: 2025-01-01 00:00:01
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column("last_response_id", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chat_sessions", "last_response_id")
