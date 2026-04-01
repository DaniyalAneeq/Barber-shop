"""
Utility for resolving relative date expressions to YYYY-MM-DD strings.

Used by get_available_slots() so the agent can pass phrases like
"this Saturday", "tomorrow", or "the day after tomorrow" directly
without calculating dates itself.
"""
import re
from datetime import datetime, timedelta


def parse_relative_date(text: str, reference_date: datetime = None) -> str | None:
    """
    Convert relative date expressions to YYYY-MM-DD format.

    Returns None if the text doesn't contain a recognizable relative-date
    expression (e.g. it's already in YYYY-MM-DD format or unrecognisable).

    Args:
        text:           Input string, e.g. "this Saturday" or "tomorrow".
        reference_date: Override "today" for testing. Defaults to datetime.now().
    """
    if reference_date is None:
        reference_date = datetime.now()

    text_lower = text.lower().strip()
    today = reference_date.date()

    # ── Direct keywords ───────────────────────────────────────────────────────
    if "day after tomorrow" in text_lower:
        return (today + timedelta(days=2)).isoformat()
    if "tomorrow" in text_lower:
        return (today + timedelta(days=1)).isoformat()
    if "today" in text_lower:
        return today.isoformat()

    # ── Weekday names ─────────────────────────────────────────────────────────
    weekdays = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }

    for day_name, day_num in weekdays.items():
        if day_name in text_lower:
            current_weekday = today.weekday()
            if "next" in text_lower:
                # "next Saturday" = the Saturday AFTER the coming one
                days_ahead = (day_num - current_weekday) % 7
                if days_ahead == 0:
                    days_ahead = 7
                days_ahead += 7  # jump an extra week
            else:
                # "this Saturday" / plain "Saturday" = the COMING one
                days_ahead = (day_num - current_weekday) % 7
                if days_ahead == 0:
                    days_ahead = 7  # if today IS that day, mean next week
            return (today + timedelta(days=days_ahead)).isoformat()

    return None  # not a relative date expression


def resolve_date(date_str: str, reference_date: datetime = None) -> str:
    """
    Return a YYYY-MM-DD string from either an already-formatted date or a
    relative expression.  If the input is already YYYY-MM-DD, return it
    unchanged.  If it's a relative expression, resolve it.  Otherwise
    return the original string (let the caller handle invalid format).

    Args:
        date_str:       Raw date input from the agent.
        reference_date: Override "today" for testing.
    """
    # Already in YYYY-MM-DD format — leave it alone
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_str.strip()):
        return date_str.strip()

    resolved = parse_relative_date(date_str, reference_date)
    return resolved if resolved is not None else date_str
