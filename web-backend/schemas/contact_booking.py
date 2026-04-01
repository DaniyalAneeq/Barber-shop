import re
from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from utils.validators import validate_preferred_date


# ── Service list (response from /api/web/services) ────────────────────────────

class ServiceItem(BaseModel):
    id: int
    name: str
    price: float
    duration_minutes: int


# ── Contact booking request ────────────────────────────────────────────────────

class ContactBookingCreate(BaseModel):
    full_name: str
    phone: str
    email: EmailStr
    service: str          # service name — validated against the services table
    preferred_date: date
    message: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def check_full_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name is required.")
        if len(v) > 255:
            raise ValueError("Name must be 255 characters or fewer.")
        return v

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 7:
            raise ValueError("Phone number must be at least 7 characters.")
        if len(v) > 20:
            raise ValueError("Phone number is too long (max 20 characters).")
        if not re.match(r"^[\d\s\-+().]+$", v):
            raise ValueError("Enter a valid phone number.")
        return v

    @field_validator("service")
    @classmethod
    def check_service(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Please select a service.")
        return v

    @field_validator("preferred_date")
    @classmethod
    def check_preferred_date(cls, v: date) -> date:
        is_valid, msg = validate_preferred_date(v)
        if not is_valid:
            raise ValueError(msg)
        return v

    @field_validator("message")
    @classmethod
    def clean_message(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            return v if v else None
        return v


# ── Contact booking response ───────────────────────────────────────────────────

class ContactBookingResponse(BaseModel):
    id: int
    full_name: str
    email: str
    service: str
    preferred_date: date
    status: str
    created_at: str

    model_config = {"from_attributes": True}
