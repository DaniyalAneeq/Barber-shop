"""Create contact_bookings table

Revision ID: 001
Revises:
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contact_bookings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column(
            "service",
            sa.String(100),
            nullable=False,
            comment="Service name — validated against the shared services table on write",
        ),
        sa.Column("preferred_date", sa.Date(), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="pending",
            comment="pending | confirmed | cancelled",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_index("ix_contact_bookings_email", "contact_bookings", ["email"])
    op.create_index(
        "ix_contact_bookings_preferred_date", "contact_bookings", ["preferred_date"]
    )
    op.create_index("ix_contact_bookings_status", "contact_bookings", ["status"])


def downgrade() -> None:
    op.drop_index("ix_contact_bookings_status", table_name="contact_bookings")
    op.drop_index(
        "ix_contact_bookings_preferred_date", table_name="contact_bookings"
    )
    op.drop_index("ix_contact_bookings_email", table_name="contact_bookings")
    op.drop_table("contact_bookings")
