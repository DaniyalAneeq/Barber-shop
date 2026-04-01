"""
Email service for the web-backend.
Sends a booking-received confirmation to the customer.
"""
import asyncio
import logging
from datetime import date as _date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def fire_and_forget(coro) -> None:
    """Schedule a coroutine without awaiting — used for non-blocking email sends."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        logger.warning("fire_and_forget: no running event loop — email skipped.")
        coro.close()


def _fmt_date(iso: str) -> str:
    """'2026-04-10' → 'Friday, April 10, 2026'"""
    try:
        return _date.fromisoformat(iso).strftime("%A, %B %-d, %Y")
    except (ValueError, AttributeError):
        return iso


async def _send_raw_email(
    msg: MIMEMultipart, to_email: str, max_retries: int = 3
) -> None:
    last_exc: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_password,
                use_tls=False,
                start_tls=settings.smtp_use_tls,
                timeout=15,
            )
            logger.info("Email sent to %s (attempt %d)", to_email, attempt)
            return
        except Exception as exc:
            last_exc = exc
            wait = 2**attempt  # 2, 4, 8 seconds
            logger.warning(
                "Email send failed (attempt %d/%d): %s — retrying in %ds",
                attempt, max_retries, exc, wait,
            )
            if attempt < max_retries:
                await asyncio.sleep(wait)
    logger.error(
        "Giving up sending email to %s after %d attempts: %s",
        to_email, max_retries, last_exc,
    )


async def send_contact_booking_email(
    customer_email: str,
    customer_name: str,
    booking: dict,
) -> None:
    """Send a 'booking request received' confirmation to the customer."""
    service = booking.get("service", "your appointment")
    preferred_date = _fmt_date(booking.get("preferred_date", ""))
    booking_id = booking.get("booking_id", "")

    subject = f"Booking Request Received — {service} on {preferred_date}"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#1C1917;border-radius:16px;overflow:hidden;
                      border:1px solid rgba(202,138,4,0.25);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#92400E 0%,#B45309 30%,
                       #CA8A04 60%,#F0C040 100%);padding:28px 40px;text-align:center;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#0A0A0A;
                         letter-spacing:0.06em;">
                ✂ BOOKING REQUEST RECEIVED
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 12px;font-size:16px;color:#e5e7eb;">
                Hey <strong style="color:#D4A017;">{customer_name}</strong>,
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#9ca3af;line-height:1.6;">
                We've received your booking request and will confirm your appointment shortly.
              </p>

              <!-- Booking details -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#0A0A0A;border-radius:12px;
                            border:1px solid rgba(202,138,4,0.2);
                            margin-bottom:24px;overflow:hidden;border-collapse:collapse;">
                <tr>
                  <td style="padding:16px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;
                                 color:#6b7280;display:block;margin-bottom:4px;">Service</span>
                    <strong style="color:#F0C040;font-size:17px;">{service}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;
                                 color:#6b7280;display:block;margin-bottom:4px;">Preferred Date</span>
                    <strong style="color:#e5e7eb;font-size:15px;">{preferred_date}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;
                                 color:#6b7280;display:block;margin-bottom:4px;">Reference #</span>
                    <strong style="color:#e5e7eb;font-size:15px;">#{booking_id}</strong>
                  </td>
                </tr>
              </table>

              <!-- Note box -->
              <div style="background:#1a1208;border-left:3px solid #CA8A04;
                          border-radius:4px;padding:14px 18px;">
                <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                  We'll reach out shortly to confirm your exact time slot. Need to reach us sooner?
                  Call us at <strong style="color:#D4A017;">(555) 123-4567</strong>.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.06);
                       padding:18px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#4b5563;">
                &copy; {settings.app_name} &middot; 142 West 10th Street, New York, NY
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    text = (
        f"Hey {customer_name},\n\n"
        f"We've received your booking request!\n\n"
        f"Service        : {service}\n"
        f"Preferred Date : {preferred_date}\n"
        f"Reference #    : #{booking_id}\n\n"
        f"We'll reach out shortly to confirm your exact time slot.\n"
        f"Questions? Call us at (555) 123-4567.\n\n"
        f"— {settings.app_name}"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = customer_email
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    await _send_raw_email(msg, customer_email)
