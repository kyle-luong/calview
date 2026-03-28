"""ICS parsing — no geocoding (that's a separate Lambda)."""
import calendar
import re
from datetime import datetime, timedelta
from ics import Calendar

ICAL_TO_WEEKDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
MIN_DATE_YEAR, MAX_DATE_YEAR = 2020, 2030

ABBREV = {
    r"\bBldg\b": "Building", r"\bSt\b": "Street", r"\bAve\b": "Avenue",
    r"\bDr\b": "Drive", r"\bRd\b": "Road", r"\bRm\b": "Room",
    r"\bUniv\b": "University", r"\bCtr\b": "Center", r"\bLib\b": "Library",
}


def clean_location(loc: str) -> str:
    if not loc:
        return ""
    out = re.sub(r"[^a-zA-Z0-9\s,.-]+$", "", loc).strip()
    for pat, full in ABBREV.items():
        out = re.sub(pat, full, out, flags=re.IGNORECASE)
    return out


def parse_ics_content(content: str) -> dict:
    """Returns {'events': [...], 'locations': [unique cleaned strings]}."""
    cal = Calendar(content)
    events, locations = [], set()

    for ev in cal.events:
        start_date = ev.begin.date()
        end_date = start_date
        day_codes, until_date = [], None

        for line in ev.extra:
            if line.name == "RRULE":
                parts = dict(x.split("=") for x in line.value.split(";") if "=" in x)
                if "UNTIL" in parts:
                    try:
                        u = parts["UNTIL"]
                        until_date = (
                            datetime.strptime(u, "%Y%m%dT%H%M%S").date()
                            if "T" in u else datetime.strptime(u, "%Y%m%d").date()
                        )
                        if not (MIN_DATE_YEAR <= until_date.year <= MAX_DATE_YEAR):
                            until_date = None
                    except ValueError:
                        until_date = None
                if "BYDAY" in parts:
                    day_codes = parts["BYDAY"].split(",")

        if not day_codes:
            day_codes = [ICAL_TO_WEEKDAY[ev.begin.weekday()]]
        if until_date:
            end_date = until_date

        original_location = ev.location or ""
        cleaned = clean_location(original_location)
        if cleaned:
            locations.add(cleaned)

        current = start_date
        while current <= end_date:
            if ICAL_TO_WEEKDAY[current.weekday()] in day_codes:
                events.append({
                    "title": ev.name or "Untitled",
                    "location": original_location,
                    "cleaned_location": cleaned,
                    "start_time": ev.begin.time().strftime("%H:%M"),
                    "end_time": ev.end.time().strftime("%H:%M"),
                    "start_date": current.isoformat(),
                    "end_date": current.isoformat(),
                    "day_of_week": [calendar.day_name[current.weekday()]],
                })
            current += timedelta(days=1)

    return {"events": events, "locations": sorted(locations)}
