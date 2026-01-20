from ics import Calendar
from datetime import datetime, timedelta
import calendar
import googlemaps
import os
import re
import logging
import math
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()
GOOGLE_MAPS_KEY = os.getenv("GOOGLE_MAPS_KEY")
print("Loaded .env file for configuration.", len(GOOGLE_MAPS_KEY) if GOOGLE_MAPS_KEY else 0)

if GOOGLE_MAPS_KEY:
    gmaps = googlemaps.Client(key=GOOGLE_MAPS_KEY)
else:
    gmaps = None
logger = logging.getLogger(__name__)

ICAL_TO_WEEKDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
WEEKDAY_ORDER = list(calendar.day_name)

# Date bounds for validation
MIN_DATE_YEAR = 2020
MAX_DATE_YEAR = 2030

# Location types that indicate high confidence (Google Maps result types)
HIGH_CONFIDENCE_TYPES = {"premise", "street_address", "establishment", "point_of_interest", "university"}

# Maximum distance (km) from cluster centroid before considering a location an outlier
MAX_OUTLIER_DISTANCE_KM = 50

# Common abbreviations in building/location names
LOCATION_ABBREVIATIONS = {
    r'\bBldg\b': 'Building',
    r'\bBlg\b': 'Building',
    r'\bEng\b': 'Engineering',
    r'\bEngr\b': 'Engineering',
    r'\bMech\b': 'Mechanical',
    r'\bElec\b': 'Electrical',
    r'\bChem\b': 'Chemistry',
    r'\bPhys\b': 'Physics',
    r'\bBio\b': 'Biology',
    r'\bSci\b': 'Science',
    r'\bLab\b': 'Laboratory',
    r'\bCtr\b': 'Center',
    r'\bCntr\b': 'Center',
    r'\bLib\b': 'Library',
    r'\bAud\b': 'Auditorium',
    r'\bRm\b': 'Room',
    r'\bSt\b': 'Street',
    r'\bAve\b': 'Avenue',
    r'\bDr\b': 'Drive',
    r'\bUniv\b': 'University',
    r'\bAdmin\b': 'Administration',
    r'\bComm\b': 'Communication',
    r'\bComp\b': 'Computer',
    r'\bInfo\b': 'Information',
    r'\bTech\b': 'Technology',
    r'\bMgmt\b': 'Management',
    r'\bBus\b': 'Business',
    r'\bEd\b': 'Education',
    r'\bMed\b': 'Medical',
    r'\bHlth\b': 'Health',
    r'\bArts\b': 'Arts',
    r'\bSoc\b': 'Social',
    r'\bPsych\b': 'Psychology',
    r'\bMath\b': 'Mathematics',
    r'\bStat\b': 'Statistics',
    r'\bEcon\b': 'Economics',
    r'\bHum\b': 'Humanities',
    r'\bRes\b': 'Research',
    r'\bDev\b': 'Development',
    r'\bSvcs\b': 'Services',
    r'\bSvc\b': 'Service',
}


def expand_abbreviations(text: str) -> str:
    """Expand common abbreviations in location names."""
    result = text
    for abbrev, full in LOCATION_ABBREVIATIONS.items():
        result = re.sub(abbrev, full, result, flags=re.IGNORECASE)
    return result


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth (in km).
    """
    R = 6371  # Earth's radius in km

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)

    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def clean_location(location: str) -> str:
    """Clean and expand location string for geocoding."""
    if not location:
        return ""
    # Remove trailing room numbers, codes, etc.
    cleaned = re.sub(r'[^a-zA-Z\s,.-]+$', '', location).strip()
    # Expand common abbreviations for better geocoding
    cleaned = expand_abbreviations(cleaned)
    return cleaned


def geocode_location(address: str, bias_coords: dict = None) -> dict:
    """
    Geocode a single address, optionally with coordinate bias.
    Returns dict with lat, lng, confidence score, and raw result.
    """
    if not address:
        return {"lat": None, "lng": None, "confidence": 0, "raw": None}

    # Use a local reference to the global gmaps to make mocking easier
    # Import here so tests can patch app.utils.gmaps
    from app import utils 
    client = utils.gmaps

    try:
        if client is None:
            logger.debug("Google Maps client not configured; skipping geocode")
            return {"lat": None, "lng": None, "confidence": 0, "raw": None}

        params = {"address": address}
        if bias_coords:
            delta = 0.05  # ~5km radius
            params["bounds"] = {
                "southwest": {"lat": bias_coords["lat"] - delta, "lng": bias_coords["lng"] - delta},
                "northeast": {"lat": bias_coords["lat"] + delta, "lng": bias_coords["lng"] + delta},
            }

        results = client.geocode(**params)
        if not results:
            return {"lat": None, "lng": None, "confidence": 0, "raw": None}

        result = results[0]
        location = result["geometry"]["location"]

        # Calculate confidence based on result type and location_type
        confidence = calculate_confidence(result)

        logger.info(f"Geocoded '{address}' to ({location['lat']}, {location['lng']}) with confidence {confidence:.2f}")

        return {
            "lat": location["lat"],
            "lng": location["lng"],
            "confidence": confidence,
            "raw": result
        }
    except Exception as e:
        logger.debug(f"Geocoding failed for '{address}': {e}")
        return {"lat": None, "lng": None, "confidence": 0, "raw": None}


def calculate_confidence(result: dict) -> float:
    """
    Calculate confidence score for a geocode result.
    Higher = more specific/reliable.
    """
    score = 0.5  # Base score

    types = set(result.get("types", []))
    geometry = result.get("geometry", {})

    # Boost for specific location types
    if types & HIGH_CONFIDENCE_TYPES:
        score += 0.3

    # Boost for ROOFTOP precision
    if geometry.get("location_type") == "ROOFTOP":
        score += 0.2
    elif geometry.get("location_type") == "RANGE_INTERPOLATED":
        score += 0.1

    # Check for educational institution indicators
    address = result.get("formatted_address", "").lower()
    if any(word in address for word in ["university", "college", "campus", "hall"]):
        score += 0.1

    return min(score, 1.0)


def find_anchor(geocoded_locations: dict) -> dict:
    """
    Find the best "anchor" location to use as bias for others.
    Returns the coordinates of the highest confidence result.
    """
    best_anchor = None
    best_score = 0

    for loc, data in geocoded_locations.items():
        if data["lat"] is None:
            continue
        if data["confidence"] > best_score:
            best_score = data["confidence"]
            best_anchor = {"lat": data["lat"], "lng": data["lng"]}

    return best_anchor


def cluster_locations(geocoded_locations: dict) -> dict:
    """
    Find the geographic center of successfully geocoded locations.
    Uses median to be more robust against outliers.
    """
    valid_coords = [
        (data["lat"], data["lng"])
        for data in geocoded_locations.values()
        if data["lat"] is not None
    ]

    if not valid_coords:
        return None

    # Use median instead of mean for robustness against outliers
    lats = sorted([c[0] for c in valid_coords])
    lngs = sorted([c[1] for c in valid_coords])

    mid = len(lats) // 2
    if len(lats) % 2 == 0:
        median_lat = (lats[mid - 1] + lats[mid]) / 2
        median_lng = (lngs[mid - 1] + lngs[mid]) / 2
    else:
        median_lat = lats[mid]
        median_lng = lngs[mid]

    return {"lat": median_lat, "lng": median_lng}


def find_outliers(geocoded_locations: dict, centroid: dict) -> list:
    """
    Find locations that are too far from the centroid (likely wrong geocode).
    Returns list of location keys that are outliers.
    """
    if not centroid:
        return []

    outliers = []
    for loc, data in geocoded_locations.items():
        if data["lat"] is None:
            continue

        distance = haversine_distance(
            centroid["lat"], centroid["lng"],
            data["lat"], data["lng"]
        )

        if distance > MAX_OUTLIER_DISTANCE_KM:
            logger.debug(f"Outlier detected: '{loc}' is {distance:.1f}km from centroid")
            outliers.append(loc)

    return outliers


def parse_ics(file_content: str, school_location: str = None):
    """
    Parse ICS file and geocode locations using anchor detection.
    school_location parameter is now optional (kept for backwards compatibility).
    """
    events = []
    cal = Calendar(file_content)

    # Step 1: Extract all unique locations
    unique_locations = {}
    event_data = []

    for event in cal.events:
        start_date = event.begin.date()
        end_date = start_date
        day_codes = []
        until_date = None

        for line in event.extra:
            if line.name == "RRULE":
                parts = dict(x.split("=") for x in line.value.split(";") if "=" in x)
                if "UNTIL" in parts:
                    until = parts["UNTIL"]
                    try:
                        until_date = datetime.strptime(until, "%Y%m%dT%H%M%S").date() if "T" in until else datetime.strptime(until, "%Y%m%d").date()
                        if until_date.year < MIN_DATE_YEAR or until_date.year > MAX_DATE_YEAR:
                            until_date = None
                    except ValueError:
                        until_date = None
                if "BYDAY" in parts:
                    day_codes = parts["BYDAY"].split(",")

        if not day_codes:
            day_codes = [ICAL_TO_WEEKDAY[event.begin.weekday()]]
        if until_date:
            end_date = until_date

        original_location = event.location or ""
        cleaned_location = clean_location(original_location)

        if cleaned_location:
            unique_locations[cleaned_location] = None  # Will fill with geocode result

        event_data.append({
            "name": event.name or "Untitled",
            "original_location": original_location,
            "cleaned_location": cleaned_location,
            "start_date": start_date,
            "end_date": end_date,
            "day_codes": day_codes,
            "start_time": event.begin.time(),
            "end_time": event.end.time(),
        })

    # Step 2: First pass - geocode all unique locations without bias
    geocoded = {}
    for loc in unique_locations.keys():
        geocoded[loc] = geocode_location(loc)

    # Step 3: Find cluster centroid (using median for outlier robustness)
    centroid = cluster_locations(geocoded)

    # Step 4: Detect outliers - locations too far from centroid
    outliers = find_outliers(geocoded, centroid) if centroid else []

    # Step 5: Find anchor (highest confidence non-outlier result)
    anchor = None
    best_score = 0
    for loc, data in geocoded.items():
        if loc in outliers:
            continue
        if data["lat"] is None:
            continue
        if data["confidence"] > best_score:
            best_score = data["confidence"]
            anchor = {"lat": data["lat"], "lng": data["lng"]}

    # If no anchor found, use centroid
    if not anchor:
        anchor = centroid

    # Step 6: Re-geocode outliers and low-confidence locations with anchor bias
    if anchor:
        # First handle outliers
        for loc in outliers:
            retry = geocode_location(loc, bias_coords=anchor)
            if retry["lat"] is not None:
                # Verify the retry isn't also an outlier
                retry_distance = haversine_distance(
                    anchor["lat"], anchor["lng"],
                    retry["lat"], retry["lng"]
                )
                if retry_distance <= MAX_OUTLIER_DISTANCE_KM:
                    geocoded[loc] = retry
                else:
                    # Still an outlier, set to None
                    geocoded[loc] = {"lat": None, "lng": None, "confidence": 0, "raw": None}

        # Then handle low-confidence (non-outlier) locations
        for loc, data in geocoded.items():
            if loc in outliers:
                continue
            if data["lat"] is None or data["confidence"] < 0.5:
                retry = geocode_location(loc, bias_coords=anchor)
                if retry["lat"] is not None:
                    geocoded[loc] = retry

    # Step 5: Build final event list
    for ev in event_data:
        geo = geocoded.get(ev["cleaned_location"], {"lat": None, "lng": None})

        current = ev["start_date"]
        while current <= ev["end_date"]:
            if ICAL_TO_WEEKDAY[current.weekday()] in ev["day_codes"]:
                events.append({
                    "title": ev["name"],
                    "location": ev["original_location"],
                    "start_time": ev["start_time"],
                    "end_time": ev["end_time"],
                    "start_date": current,
                    "end_date": current,
                    "day_codes": [ICAL_TO_WEEKDAY[current.weekday()]],
                    "day_of_week": [calendar.day_name[current.weekday()]],
                    "latitude": geo["lat"],
                    "longitude": geo["lng"],
                })
            current += timedelta(days=1)

    logging.info(f"Parsed {len(events)} events from ICS file with geocoding.")
    return events
