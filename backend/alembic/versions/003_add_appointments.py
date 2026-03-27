"""Add appointment booking tables — services, barbers, barber_schedules, appointments

Revision ID: 003
Revises: 002
Create Date: 2026-03-28 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── appointment_status enum ────────────────────────────────────────────────
    op.execute(
        "CREATE TYPE appointment_status AS ENUM "
        "('confirmed', 'cancelled', 'completed', 'no_show')"
    )

    # ── services ───────────────────────────────────────────────────────────────
    op.create_table(
        "services",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_services_is_active", "services", ["is_active"])

    # ── barbers ────────────────────────────────────────────────────────────────
    op.create_table(
        "barbers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("specialties", JSONB(), nullable=False, server_default="'[]'"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_barbers_email", "barbers", ["email"], unique=True)
    op.create_index("ix_barbers_is_active", "barbers", ["is_active"])

    # ── barber_schedules ───────────────────────────────────────────────────────
    op.create_table(
        "barber_schedules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("barber_id", sa.Integer(), sa.ForeignKey("barbers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default="true"),
        sa.CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_schedule_day_of_week"),
    )
    op.create_index("ix_schedules_barber_id", "barber_schedules", ["barber_id"])
    op.create_index(
        "ix_schedules_barber_day",
        "barber_schedules",
        ["barber_id", "day_of_week"],
        unique=True,
    )

    # ── appointments ───────────────────────────────────────────────────────────
    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("barber_id", sa.Integer(), sa.ForeignKey("barbers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("service_id", sa.Integer(), sa.ForeignKey("services.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("appointment_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("confirmed", "cancelled", "completed", "no_show",
                    name="appointment_status", create_type=False),
            nullable=False,
            server_default="confirmed",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("barber_id", "appointment_date", "start_time", name="uq_barber_date_time"),
    )
    op.create_index("ix_appointments_customer_id", "appointments", ["customer_id"])
    op.create_index("ix_appointments_barber_id", "appointments", ["barber_id"])
    op.create_index("ix_appointments_date", "appointments", ["appointment_date"])
    op.create_index("ix_appointments_status", "appointments", ["status"])

    # ── updated_at triggers (reuses function from migration 001) ───────────────
    for table in ("services", "barbers", "appointments"):
        op.execute(f"""
            CREATE TRIGGER trg_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        """)


def downgrade() -> None:
    for table in ("services", "barbers", "appointments"):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table}")

    op.drop_table("appointments")
    op.drop_table("barber_schedules")
    op.drop_table("barbers")
    op.drop_table("services")
    op.execute("DROP TYPE IF EXISTS appointment_status")
