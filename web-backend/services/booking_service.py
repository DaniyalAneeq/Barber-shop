"""
Business logic for the contact booking flow.

get_services    — reads from the shared `services` table (read-only)
create_contact_booking — inserts into `contact_bookings`, fires confirmation email
"""
import logging

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from schemas.contact_booking import ContactBookingCreate, ContactBookingResponse, ServiceItem
from services.email_service import fire_and_forget, send_contact_booking_email

logger = logging.getLogger(__name__)


async def get_services(db: AsyncSession) -> list[ServiceItem]:
    """Return all active services sorted by price (read-only, shared table)."""
    rows = (
        await db.execute(
            text(
                "SELECT id, name, duration_minutes, price "
                "FROM services WHERE is_active = TRUE ORDER BY price"
            )
        )
    ).mappings().all()

    return [
        ServiceItem(
            id=r["id"],
            name=r["name"],
            price=float(r["price"]),
            duration_minutes=r["duration_minutes"],
        )
        for r in rows
    ]


async def create_contact_booking(
    db: AsyncSession,
    payload: ContactBookingCreate,
) -> ContactBookingResponse:
    """
    Validate the selected service exists in the DB, persist the booking, and
    fire off a confirmation email. The session is committed by the get_session
    dependency after this function returns.
    """
    # Validate selected service exists in the shared services table
    svc = (
        await db.execute(
            text(
                "SELECT id, name FROM services "
                "WHERE name = :name AND is_active = TRUE"
            ),
            {"name": payload.service},
        )
    ).mappings().one_or_none()

    if svc is None:
        # Return a 422 with a field-level error so the frontend maps it correctly
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "loc": ["body", "service"],
                    "msg": "Selected service is not available. Please refresh and choose again.",
                    "type": "value_error",
                }
            ],
        )

    # Insert into contact_bookings (session auto-commits via get_session dependency)
    row = (
        await db.execute(
            text(
                "INSERT INTO contact_bookings "
                "  (full_name, phone, email, service, preferred_date, message) "
                "VALUES "
                "  (:full_name, :phone, :email, :service, :preferred_date, :message) "
                "RETURNING id, created_at"
            ),
            {
                "full_name": payload.full_name,
                "phone": payload.phone,
                "email": str(payload.email),
                "service": payload.service,
                "preferred_date": payload.preferred_date,
                "message": payload.message,
            },
        )
    ).mappings().one()

    logger.info(
        "Contact booking #%d created — %s on %s",
        row["id"],
        payload.service,
        payload.preferred_date,
    )

    # Fire confirmation email without blocking the response
    fire_and_forget(
        send_contact_booking_email(
            customer_email=str(payload.email),
            customer_name=payload.full_name,
            booking={
                "service": payload.service,
                "preferred_date": payload.preferred_date.isoformat(),
                "booking_id": row["id"],
                "phone": payload.phone,
                "message": payload.message or "",
            },
        )
    )

    return ContactBookingResponse(
        id=row["id"],
        full_name=payload.full_name,
        email=str(payload.email),
        service=payload.service,
        preferred_date=payload.preferred_date,
        status="pending",
        created_at=row["created_at"].isoformat(),
    )
