from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from schemas.contact_booking import (
    ContactBookingCreate,
    ContactBookingResponse,
    ServiceItem,
)
from services.booking_service import create_contact_booking, get_services

router = APIRouter(prefix="/api/web", tags=["contact"])


@router.get(
    "/services",
    response_model=list[ServiceItem],
    summary="List available services",
    description="Returns all active barbershop services from the shared services table.",
)
async def list_services(db: AsyncSession = Depends(get_session)) -> list[ServiceItem]:
    return await get_services(db)


@router.post(
    "/contact/book",
    response_model=ContactBookingResponse,
    status_code=201,
    summary="Submit a contact booking",
    description=(
        "Validates the payload, saves a contact_bookings row, and sends a "
        "confirmation email. Returns 422 if validation fails (field-level errors "
        "are included so the frontend can display them inline)."
    ),
)
async def book_contact(
    payload: ContactBookingCreate,
    db: AsyncSession = Depends(get_session),
) -> ContactBookingResponse:
    return await create_contact_booking(db, payload)
