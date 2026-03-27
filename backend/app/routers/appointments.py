"""
Appointment REST endpoints — read-only views for the frontend.

Primary booking/cancel/reschedule flow goes through the chatbot agent.
These endpoints are useful for:
  - Displaying appointment info outside the chat widget
  - Future admin panel
  - Direct API access by the frontend

Endpoints:
  GET /api/services                      — list active services (public)
  GET /api/barbers                       — list active barbers (public)
  GET /api/appointments/{customer_id}    — customer's upcoming appointments (auth)
"""
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.models.user import User
from app.services.rate_limiter import check_ip_rate
from app.tools.appointment_tools import (
    get_barbers as _get_barbers,
    get_my_appointments as _get_my_appointments,
    get_services as _get_services,
)
from app.utils.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["appointments"])


# ── Services ─────────────────────────────────────────────────────────────────

@router.get("/services")
async def list_services(request: Request):
    """List all active services with pricing and duration."""
    await check_ip_rate(request)

    result = await _get_services()
    if not result["ok"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result["error"],
        )
    return {"services": result["data"]}


# ── Barbers ──────────────────────────────────────────────────────────────────

@router.get("/barbers")
async def list_barbers(
    request: Request,
    specialty: Optional[str] = Query(
        default=None,
        description="Filter barbers by specialty keyword (e.g. 'fade', 'beard')",
    ),
):
    """List all active barbers, optionally filtered by specialty."""
    await check_ip_rate(request)

    result = await _get_barbers(specialty)
    if not result["ok"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result["error"],
        )
    return {"barbers": result["data"]}


# ── Appointments ──────────────────────────────────────────────────────────────

@router.get("/appointments/{customer_id}")
async def get_customer_appointments(
    customer_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Return upcoming confirmed appointments for a customer.
    The authenticated user can only view their own appointments.
    """
    await check_ip_rate(request)

    # Validate format
    try:
        requested_id = uuid.UUID(customer_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid customer_id format — must be a UUID.",
        )

    # Ownership check — customers can only see their own appointments
    if requested_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own appointments.",
        )

    result = await _get_my_appointments(str(current_user.id))
    if not result["ok"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result["error"],
        )

    data = result["data"]
    return {
        "customer_id": customer_id,
        "appointments": data.get("appointments", []),
        "count": data.get("count", 0),
    }


# ── Convenience alias — GET /api/appointments/me ─────────────────────────────
# Registered before the {customer_id} route so FastAPI matches it first.

@router.get("/appointments/me")
async def get_my_appointments_alias(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Shortcut: return appointments for the currently authenticated user."""
    await check_ip_rate(request)

    result = await _get_my_appointments(str(current_user.id))
    if not result["ok"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result["error"],
        )

    data = result["data"]
    return {
        "customer_id": str(current_user.id),
        "appointments": data.get("appointments", []),
        "count": data.get("count", 0),
    }
