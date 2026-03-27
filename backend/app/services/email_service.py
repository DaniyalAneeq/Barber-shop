"""
Email service — async SMTP with HTML + text fallback.

Features:
- Async send via aiosmtplib (non-blocking)
- Shared retry helper (_send_raw_email) used by all senders
- fire_and_forget() schedules emails as background asyncio tasks so callers
  return immediately without waiting for SMTP
- Retry logic (3 attempts, exponential back-off: 2s, 4s, 8s)
"""
import asyncio
import logging
import secrets
from datetime import date as _date, time as _time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Public utilities ──────────────────────────────────────────────────────────

def generate_verification_code() -> str:
    """Cryptographically secure 6-digit numeric code."""
    return str(secrets.randbelow(900_000) + 100_000)


def fire_and_forget(coro) -> None:
    """
    Schedule a coroutine on the running event loop without awaiting it.
    Use this to send emails without blocking the calling tool function.
    If no loop is running (e.g. in a test), the coroutine is closed cleanly.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        logger.warning("fire_and_forget: no running event loop — email skipped.")
        coro.close()


# ── Formatting helpers ────────────────────────────────────────────────────────

def _fmt_date(iso: str) -> str:
    """'2026-03-30' → 'Monday, March 30, 2026'"""
    try:
        return _date.fromisoformat(iso).strftime("%A, %B %-d, %Y")
    except (ValueError, AttributeError):
        return iso


def _fmt_time_12h(t: str) -> str:
    """'09:00' → '9:00 AM'"""
    try:
        return _time.fromisoformat(t).strftime("%-I:%M %p")
    except (ValueError, AttributeError):
        return t


# ── Core SMTP sender (shared retry logic) ────────────────────────────────────

async def _send_raw_email(msg: MIMEMultipart, to_email: str, max_retries: int = 3) -> None:
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
            wait = 2 ** attempt  # 2, 4, 8 seconds
            logger.warning(
                "Email send failed (attempt %d/%d): %s — retrying in %ds",
                attempt, max_retries, exc, wait,
            )
            if attempt < max_retries:
                await asyncio.sleep(wait)

    logger.error("Giving up sending email to %s after %d attempts: %s", to_email, max_retries, last_exc)


def _make_msg(subject: str, to: str, html: str, text: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


# ── Shared HTML chrome ────────────────────────────────────────────────────────

def _email_wrap(header_text: str, body_inner: str) -> str:
    """Wrap content in the standard dark-barbershop shell."""
    return f"""<!DOCTYPE html>
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
                {header_text}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              {body_inner}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.06);
                       padding:18px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#4b5563;">
                &copy; {settings.app_name} &middot; Powered by Blade AI
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _detail_row(label: str, value: str, accent: bool = False) -> str:
    value_style = "color:#F0C040;font-size:17px;" if accent else "color:#e5e7eb;font-size:15px;"
    return f"""<tr>
  <td style="padding:16px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;
                 color:#6b7280;display:block;margin-bottom:4px;">{label}</span>
    <strong style="{value_style}">{value}</strong>
  </td>
</tr>"""


def _detail_table(rows_html: str) -> str:
    return f"""<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#0A0A0A;border-radius:12px;
              border:1px solid rgba(202,138,4,0.2);
              margin-bottom:24px;overflow:hidden;border-collapse:collapse;">
  {rows_html}
</table>"""


def _policy_box(text: str) -> str:
    return f"""<div style="background:#1a1208;border-left:3px solid #CA8A04;
               border-radius:4px;padding:14px 18px;">
  <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">{text}</p>
</div>"""


# ══════════════════════════════════════════════════════════════════════════════
# 1. Verification email (unchanged behaviour, uses shared sender now)
# ══════════════════════════════════════════════════════════════════════════════

def _build_html(name: str, code: str, bot_name: str) -> str:
    body = f"""
      <p style="margin:0 0 12px;font-size:16px;color:#e5e7eb;">
        Hey <strong style="color:#D4A017;">{name}</strong>,
      </p>
      <p style="margin:0 0 28px;font-size:15px;color:#9ca3af;line-height:1.6;">
        Use the code below to verify your email and start chatting with {bot_name}.
        This code expires in <strong style="color:#fff;">10 minutes</strong>.
      </p>
      <div style="background:#0A0A0A;border:2px solid #CA8A04;border-radius:12px;
                  padding:24px;text-align:center;margin-bottom:28px;">
        <span style="font-size:42px;font-weight:700;letter-spacing:0.3em;
                     color:#F0C040;font-family:'Courier New',monospace;">{code}</span>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
        &#9888;&#65039; Never share this code with anyone. We'll never ask for it.
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you didn't request this, please ignore this email.
      </p>"""
    return _email_wrap("✂ BLADE — AI ASSISTANT", body)


def _build_text(name: str, code: str, bot_name: str) -> str:
    return (
        f"Hey {name},\n\n"
        f"Your verification code for {bot_name} is:\n\n"
        f"  {code}\n\n"
        f"This code expires in 10 minutes.\n"
        f"Never share this code with anyone.\n\n"
        f"If you didn't request this, please ignore this email.\n\n"
        f"— {settings.app_name}"
    )


async def send_verification_email(
    to_email: str,
    name: str,
    code: str,
    max_retries: int = 3,
) -> None:
    """Send OTP verification email (awaited directly — not fire-and-forget)."""
    msg = _make_msg(
        subject=f"[{settings.bot_name}] Your verification code: {code}",
        to=to_email,
        html=_build_html(name, code, settings.bot_name),
        text=_build_text(name, code, settings.bot_name),
    )
    await _send_raw_email(msg, to_email, max_retries)


# ══════════════════════════════════════════════════════════════════════════════
# 2. Booking confirmation
# ══════════════════════════════════════════════════════════════════════════════

def _build_confirmation_html(name: str, appt: dict) -> str:
    date_str  = _fmt_date(appt.get("date", ""))
    start_str = _fmt_time_12h(appt.get("start_time", ""))
    end_str   = _fmt_time_12h(appt.get("end_time", ""))
    duration  = appt.get("duration_minutes", "")
    price     = appt.get("price", "")

    rows = (
        _detail_row("Service", appt.get("service", ""), accent=True)
        + _detail_row("Barber", appt.get("barber", ""))
        + _detail_row("Date", date_str)
        + _detail_row("Time", f"{start_str} – {end_str} &nbsp;({duration} min)")
        + _detail_row("Price", f"${price:.2f}" if isinstance(price, (int, float)) else f"${price}", accent=True)
    )

    body = f"""
      <p style="margin:0 0 24px;font-size:16px;color:#e5e7eb;">
        Hey <strong style="color:#D4A017;">{name}</strong>, you're all set! &#127929;
      </p>
      {_detail_table(rows)}
      {_policy_box(
          "<strong style='color:#D4A017;'>Cancellation policy:</strong> "
          "Cancellations made less than 24 hours before your appointment may be "
          "subject to a fee. To cancel or reschedule, simply reply to this email "
          "or open a chat with Blade."
      )}"""

    return _email_wrap("✂ APPOINTMENT CONFIRMED", body)


def _build_confirmation_text(name: str, appt: dict) -> str:
    return (
        f"Hey {name}, your appointment is confirmed!\n\n"
        f"Service : {appt.get('service', '')}\n"
        f"Barber  : {appt.get('barber', '')}\n"
        f"Date    : {_fmt_date(appt.get('date', ''))}\n"
        f"Time    : {_fmt_time_12h(appt.get('start_time', ''))} – "
        f"{_fmt_time_12h(appt.get('end_time', ''))} "
        f"({appt.get('duration_minutes', '')} min)\n"
        f"Price   : ${appt.get('price', '')}\n\n"
        f"Cancellation policy: cancellations made less than 24 hours before "
        f"your appointment may be subject to a fee.\n\n"
        f"— {settings.app_name}"
    )


async def send_booking_confirmation(
    customer_email: str,
    customer_name: str,
    appointment_details: dict,
) -> None:
    """Send booking confirmation. Called via fire_and_forget."""
    appt = appointment_details
    service = appt.get("service", "your appointment")
    date    = _fmt_date(appt.get("date", ""))

    msg = _make_msg(
        subject=f"Appointment Confirmed — {service} on {date}",
        to=customer_email,
        html=_build_confirmation_html(customer_name, appt),
        text=_build_confirmation_text(customer_name, appt),
    )
    await _send_raw_email(msg, customer_email)


# ══════════════════════════════════════════════════════════════════════════════
# 3. Cancellation confirmation
# ══════════════════════════════════════════════════════════════════════════════

def _build_cancellation_html(name: str, appt: dict) -> str:
    rows = (
        _detail_row("Service", appt.get("service", ""), accent=True)
        + _detail_row("Barber", appt.get("barber", ""))
        + _detail_row("Date", _fmt_date(appt.get("date", "")))
        + _detail_row("Time", _fmt_time_12h(appt.get("start_time", "")))
    )

    body = f"""
      <p style="margin:0 0 24px;font-size:16px;color:#e5e7eb;">
        Hey <strong style="color:#D4A017;">{name}</strong>,
        your appointment has been cancelled.
      </p>
      {_detail_table(rows)}
      {_policy_box(
          "Want to book again? Open a chat with "
          "<strong style='color:#D4A017;'>Blade</strong> any time to find a new slot."
      )}"""

    return _email_wrap("✂ APPOINTMENT CANCELLED", body)


def _build_cancellation_text(name: str, appt: dict) -> str:
    return (
        f"Hey {name},\n\n"
        f"Your appointment has been cancelled.\n\n"
        f"Service : {appt.get('service', '')}\n"
        f"Barber  : {appt.get('barber', '')}\n"
        f"Date    : {_fmt_date(appt.get('date', ''))}\n"
        f"Time    : {_fmt_time_12h(appt.get('start_time', ''))}\n\n"
        f"Want to rebook? Chat with Blade any time.\n\n"
        f"— {settings.app_name}"
    )


async def send_cancellation_email(
    customer_email: str,
    customer_name: str,
    appointment_details: dict,
) -> None:
    """Send cancellation confirmation. Called via fire_and_forget."""
    appt    = appointment_details
    service = appt.get("service", "your appointment")
    date    = _fmt_date(appt.get("date", ""))

    msg = _make_msg(
        subject=f"Appointment Cancelled — {service} on {date}",
        to=customer_email,
        html=_build_cancellation_html(customer_name, appt),
        text=_build_cancellation_text(customer_name, appt),
    )
    await _send_raw_email(msg, customer_email)


# ══════════════════════════════════════════════════════════════════════════════
# 4. Reschedule notification
# ══════════════════════════════════════════════════════════════════════════════

def _build_reschedule_html(name: str, old: dict, new: dict) -> str:
    old_rows = (
        _detail_row("Date", _fmt_date(old.get("date", "")))
        + _detail_row("Time", _fmt_time_12h(old.get("start_time", "")))
    )
    new_rows = (
        _detail_row("Date", _fmt_date(new.get("new_date", "")))
        + _detail_row(
            "Time",
            f"{_fmt_time_12h(new.get('new_start_time', ''))} – "
            f"{_fmt_time_12h(new.get('new_end_time', ''))} "
            f"&nbsp;({new.get('duration_minutes', '')} min)",
        )
    )

    body = f"""
      <p style="margin:0 0 24px;font-size:16px;color:#e5e7eb;">
        Hey <strong style="color:#D4A017;">{name}</strong>,
        your appointment has been rescheduled.
      </p>

      <!-- Service + Barber summary -->
      <table width="100%" cellpadding="0" cellspacing="0"
             style="margin-bottom:20px;">
        <tr>
          <td style="font-size:13px;color:#9ca3af;">
            <strong style="color:#e5e7eb;">{new.get('service', '')}</strong>
            &nbsp;with&nbsp;
            <strong style="color:#e5e7eb;">{new.get('barber', '')}</strong>
          </td>
        </tr>
      </table>

      <!-- Before -->
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;
                letter-spacing:0.1em;color:#6b7280;">Previous appointment</p>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#0A0A0A;border-radius:12px;
                    border:1px solid rgba(255,255,255,0.08);
                    margin-bottom:16px;overflow:hidden;border-collapse:collapse;
                    opacity:0.7;">
        {old_rows}
      </table>

      <!-- Arrow -->
      <p style="text-align:center;font-size:22px;margin:0 0 12px;color:#CA8A04;">&#8595;</p>

      <!-- After -->
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;
                letter-spacing:0.1em;color:#D4A017;">New appointment</p>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#0A0A0A;border-radius:12px;
                    border:2px solid rgba(202,138,4,0.5);
                    margin-bottom:24px;overflow:hidden;border-collapse:collapse;">
        {new_rows}
      </table>

      {_policy_box(
          "<strong style='color:#D4A017;'>Reminder:</strong> "
          "Cancellations made less than 24 hours before your appointment may be "
          "subject to a fee. To make further changes, chat with Blade or reply to this email."
      )}"""

    return _email_wrap("✂ APPOINTMENT RESCHEDULED", body)


def _build_reschedule_text(name: str, old: dict, new: dict) -> str:
    return (
        f"Hey {name}, your appointment has been rescheduled.\n\n"
        f"Service : {new.get('service', '')}\n"
        f"Barber  : {new.get('barber', '')}\n\n"
        f"PREVIOUS\n"
        f"  Date : {_fmt_date(old.get('date', ''))}\n"
        f"  Time : {_fmt_time_12h(old.get('start_time', ''))}\n\n"
        f"NEW\n"
        f"  Date : {_fmt_date(new.get('new_date', ''))}\n"
        f"  Time : {_fmt_time_12h(new.get('new_start_time', ''))} – "
        f"{_fmt_time_12h(new.get('new_end_time', ''))}\n\n"
        f"— {settings.app_name}"
    )


async def send_reschedule_email(
    customer_email: str,
    customer_name: str,
    old_details: dict,
    new_details: dict,
) -> None:
    """Send reschedule notification. Called via fire_and_forget."""
    service  = new_details.get("service", "your appointment")
    new_date = _fmt_date(new_details.get("new_date", ""))

    msg = _make_msg(
        subject=f"Appointment Rescheduled — {service} now on {new_date}",
        to=customer_email,
        html=_build_reschedule_html(customer_name, old_details, new_details),
        text=_build_reschedule_text(customer_name, old_details, new_details),
    )
    await _send_raw_email(msg, customer_email)
