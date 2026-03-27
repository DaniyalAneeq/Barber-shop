"""
Email service — async SMTP with HTML + text fallback.

Features:
- Async send via aiosmtplib (non-blocking)
- Beautiful HTML email template
- Retry logic (3 attempts, exponential back-off)
- Rate-abuse prevention: only renders code in logs at DEBUG level
"""
import asyncio
import logging
import secrets
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def generate_verification_code() -> str:
    """Cryptographically secure 6-digit numeric code."""
    return str(secrets.randbelow(900_000) + 100_000)  # always 6 digits


def _build_html(name: str, code: str, bot_name: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Verification Code</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#1C1917;border-radius:16px;overflow:hidden;
                      border:1px solid rgba(202,138,4,0.25);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#92400E 0%,#B45309 30%,#CA8A04 60%,#F0C040 100%);
                       padding:28px 40px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#0A0A0A;letter-spacing:0.05em;">
                ✂ BLADE — AI ASSISTANT
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 12px;font-size:16px;color:#e5e7eb;">
                Hey <strong style="color:#D4A017;">{name}</strong>,
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#9ca3af;line-height:1.6;">
                Use the code below to verify your email and start chatting with {bot_name}.
                This code expires in <strong style="color:#fff;">10 minutes</strong>.
              </p>
              <!-- Code box -->
              <div style="background:#0A0A0A;border:2px solid #CA8A04;border-radius:12px;
                          padding:24px;text-align:center;margin-bottom:28px;">
                <span style="font-size:42px;font-weight:700;letter-spacing:0.3em;
                             color:#F0C040;font-family:'Courier New',monospace;">
                  {code}
                </span>
              </div>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
                ⚠️ Never share this code with anyone. We'll never ask for it.
              </p>
              <p style="margin:0;font-size:13px;color:#6b7280;">
                If you didn't request this, please ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.06);
                       padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#4b5563;">
                © {settings.app_name} · Powered by Blade AI
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


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
    """Send verification email with retry logic."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[{settings.bot_name}] Your verification code: {code}"
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to_email

    text_part = MIMEText(_build_text(name, code, settings.bot_name), "plain", "utf-8")
    html_part = MIMEText(_build_html(name, code, settings.bot_name), "html", "utf-8")
    msg.attach(text_part)
    msg.attach(html_part)

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
            logger.info("Verification email sent to %s (attempt %d)", to_email, attempt)
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

    raise RuntimeError(f"Failed to send email after {max_retries} attempts: {last_exc}")
