import re
import logging
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("scheduler")


def get_business_timezone(tz_name: Optional[str] = None) -> Any:
    """Returns ZoneInfo for business IANA timezone, with fallback to fixed timezone."""
    tz_str = tz_name or "Asia/Kolkata"
    try:
        return ZoneInfo(tz_str)
    except Exception:
        return timezone(timedelta(hours=5, minutes=30))


def parse_natural_slot_time(
    slot_time_str: str,
    business_tz: Any = None,
    default_duration_minutes: int = 30
) -> Tuple[datetime, datetime]:
    if business_tz is None:
        business_tz = get_business_timezone()
    """
    Parses natural language date-time string relative to business timezone.
    Supports formats such as:
    - "2026-10-27 10:30"
    - "2026-10-27T10:30:00"
    - "Tomorrow at 10:30 AM"
    - "Today at 3:00 PM"
    - "Monday at 11:00 AM"
    - "28 Oct 2026 at 4:00 PM"
    Returns (start_time_aware, end_time_aware).
    """
    now = datetime.now(business_tz)
    raw = slot_time_str.strip()

    # 1. Direct ISO parse
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=business_tz)
        return dt, dt + timedelta(minutes=default_duration_minutes)
    except ValueError:
        pass

    # Extract time component (e.g. 10:30 AM, 3:00 PM, 14:00, 10 AM)
    time_match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', raw, re.IGNORECASE)
    hour = 10
    minute = 0
    if time_match:
        h = int(time_match.group(1))
        m = int(time_match.group(2)) if time_match.group(2) else 0
        ampm = time_match.group(3).lower() if time_match.group(3) else None

        if ampm == "pm" and h < 12:
            h += 12
        elif ampm == "am" and h == 12:
            h = 0
        hour, minute = h, m

    # Extract date component
    target_date = now.date()
    lower_raw = raw.lower()

    if "tomorrow" in lower_raw:
        target_date = now.date() + timedelta(days=1)
    elif "today" in lower_raw:
        target_date = now.date()
    elif "day after tomorrow" in lower_raw:
        target_date = now.date() + timedelta(days=2)
    else:
        # Check weekdays: monday, tuesday, etc.
        days_map = {
            "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
            "friday": 4, "saturday": 5, "sunday": 6
        }
        found_day = False
        for day_name, day_idx in days_map.items():
            if day_name in lower_raw:
                days_ahead = (day_idx - now.weekday()) % 7
                if days_ahead == 0 and (hour < now.hour or (hour == now.hour and minute <= now.minute)):
                    days_ahead = 7
                target_date = now.date() + timedelta(days=days_ahead)
                found_day = True
                break

        if not found_day:
            # Try date regex like "27 Oct 2026", "27/10/2026", "2026-10-27"
            date_match = re.search(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', raw)
            if date_match:
                y, m, d = int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3))
                target_date = date(y, m, d)
            else:
                date_match2 = re.search(r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', raw)
                if date_match2:
                    d, m, y = int(date_match2.group(1)), int(date_match2.group(2)), int(date_match2.group(3))
                    target_date = date(y, m, d)

    start_time = datetime(
        year=target_date.year,
        month=target_date.month,
        day=target_date.day,
        hour=hour,
        minute=minute,
        tzinfo=business_tz
    )
    end_time = start_time + timedelta(minutes=default_duration_minutes)
    return start_time, end_time


def validate_slot_within_operating_hours(
    start_time: datetime,
    operating_hours: Dict[str, Any],
    broadcast_notice: Optional[Dict[str, Any]] = None
) -> Tuple[bool, Optional[str]]:
    """
    Validates if a start_time falls within business opening hours and doesn't conflict with closures.
    Returns (is_valid, error_reason).
    """
    # 1. Check broadcast notice closures
    if broadcast_notice and broadcast_notice.get("is_active"):
        notice_text = broadcast_notice.get("notice_text", "")
        effective = broadcast_notice.get("effective_dates", "").lower()
        day_str = start_time.strftime("%A").lower()
        date_str = start_time.strftime("%d %b %Y").lower()

        if day_str in effective or date_str in effective or "closed" in notice_text.lower():
            return False, f"Notice: {notice_text} (Effective: {effective})"

    # 2. Check weekly operating hours
    day_name = start_time.strftime("%A").lower()
    day_hours = operating_hours.get(day_name, {})

    if not day_hours or day_hours.get("is_closed", False):
        return False, f"The business is closed on {start_time.strftime('%A')}s."

    open_str = day_hours.get("open", "09:00")
    close_str = day_hours.get("close", "20:00")

    try:
        o_h, o_m = map(int, open_str.split(":"))
        c_h, c_m = map(int, close_str.split(":"))
        
        slot_minute_of_day = start_time.hour * 60 + start_time.minute
        open_minute_of_day = o_h * 60 + o_m
        close_minute_of_day = c_h * 60 + c_m

        if slot_minute_of_day < open_minute_of_day or slot_minute_of_day >= close_minute_of_day:
            return False, f"Requested time {start_time.strftime('%I:%M %p')} is outside operating hours ({open_str} - {close_str}) on {start_time.strftime('%A')}."
    except Exception as e:
        logger.warning("Error parsing operating hours: %s", e)

    return True, None


def generate_suggested_slots(
    base_time: datetime,
    operating_hours: Dict[str, Any],
    count: int = 3
) -> List[str]:
    """Generates next available alternative appointment slots within open hours."""
    suggestions: List[str] = []
    candidate = base_time + timedelta(hours=1)

    while len(suggestions) < count:
        day_name = candidate.strftime("%A").lower()
        day_hours = operating_hours.get(day_name, {})
        
        if not day_hours.get("is_closed", False):
            open_str = day_hours.get("open", "09:00")
            close_str = day_hours.get("close", "20:00")
            try:
                o_h, _ = map(int, open_str.split(":"))
                c_h, _ = map(int, close_str.split(":"))
                if candidate.hour >= o_h and candidate.hour < c_h:
                    suggestions.append(candidate.strftime("%A at %I:%M %p (%d %b)"))
            except Exception:
                pass
        
        candidate += timedelta(hours=2)
        # Advance day if past evening
        if candidate.hour > 19:
            candidate = candidate.replace(hour=10, minute=0) + timedelta(days=1)

    return suggestions
