from datetime import date, timedelta


def validate_preferred_date(preferred_date: date) -> tuple[bool, str]:
    """
    Validate that preferred_date is not in the past and is within 60 days.
    Returns (is_valid, error_message). error_message is empty when is_valid=True.
    """
    today = date.today()

    if preferred_date < today:
        return False, "Preferred date must be in the future."

    max_date = today + timedelta(days=60)
    if preferred_date > max_date:
        return (
            False,
            f"Preferred date must be within 60 days from today "
            f"(on or before {max_date.strftime('%B %d, %Y')}).",
        )

    return True, ""
