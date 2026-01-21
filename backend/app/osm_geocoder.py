"""
OpenStreetMap-based geocoder for university buildings.
Uses Overpass API to fetch campus buildings and fuzzy matching to find locations.
"""

import requests
import logging
import re
from typing import Optional
from rapidfuzz import fuzz, process

logger = logging.getLogger(__name__)

# Cache for campus buildings: {campus_key: {building_name_lower: {lat, lon, name}}}
_campus_cache: dict = {}

# Overpass API endpoints (primary + backup)
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# Minimum fuzzy match score to consider a match (0-100)
MIN_MATCH_SCORE = 60

# Academic subjects for keyword matching
ACADEMIC_SUBJECTS = [
    "physics", "chemistry", "biology", "mathematics", "math", "computer",
    "engineering", "astronomy", "geology", "psychology", "economics",
    "history", "english", "philosophy", "art", "music", "theater",
    "business", "law", "medicine", "nursing", "education", "social",
    "political", "anthropology", "sociology", "linguistics", "data science"
]


def _normalize_name(name: str) -> str:
    """Normalize building name for matching."""
    if not name:
        return ""
    # Lowercase, remove extra whitespace
    name = " ".join(name.lower().split())
    # Remove common suffixes that might differ
    name = re.sub(r'\s+(building|hall|center|centre)$', '', name)
    return name


def _extract_subject(name: str) -> Optional[str]:
    """Extract academic subject from building name if present."""
    name_lower = name.lower()
    for subject in ACADEMIC_SUBJECTS:
        if subject in name_lower:
            return subject
    return None


def _fetch_campus_buildings(lat: float, lon: float, radius_m: int = 2000) -> dict:
    """
    Fetch all named buildings within radius of a point from OSM.
    Returns dict of {normalized_name: {lat, lon, full_name}}
    Also indexes by academic subject for "Physics Building" style queries.
    """
    query = f"""
    [out:json][timeout:45];
    (
      way["building"]["name"](around:{radius_m},{lat},{lon});
      relation["building"]["name"](around:{radius_m},{lat},{lon});
    );
    out center tags;
    """

    data = None
    for url in OVERPASS_URLS:
        try:
            response = requests.post(url, data={"data": query}, timeout=45)
            response.raise_for_status()
            data = response.json()
            break
        except Exception as e:
            logger.warning(f"OSM Overpass query failed on {url}: {e}")
            continue

    if not data:
        return {}

    buildings = {}
    subject_buildings = {}  # Track best building per subject

    for element in data.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name")

        if not name:
            continue

        # Get center coordinates
        if "center" in element:
            blat = element["center"]["lat"]
            blon = element["center"]["lon"]
        elif "lat" in element and "lon" in element:
            blat = element["lat"]
            blon = element["lon"]
        else:
            continue

        building_data = {
            "lat": blat,
            "lon": blon,
            "full_name": name
        }

        normalized = _normalize_name(name)
        if normalized:
            buildings[normalized] = building_data

            # Also add alternative names if present
            alt_name = tags.get("alt_name")
            if alt_name:
                alt_normalized = _normalize_name(alt_name)
                if alt_normalized:
                    buildings[alt_normalized] = building_data

            # Index by academic subject (prefer names with "Building" or "Department")
            subject = _extract_subject(name)
            if subject:
                name_lower = name.lower()
                is_main_building = "building" in name_lower or "department" in name_lower
                if subject not in subject_buildings or is_main_building:
                    subject_buildings[subject] = building_data

    # Add subject-based entries (e.g., "physics" -> Physics Building)
    for subject, bld_data in subject_buildings.items():
        if subject not in buildings:
            buildings[subject] = bld_data

    logger.info(f"Fetched {len(buildings)} buildings from OSM near ({lat}, {lon})")
    return buildings


def _get_cache_key(lat: float, lon: float) -> str:
    """Generate cache key from coordinates (rounded to ~1km grid)."""
    # Round to 2 decimal places (~1km precision)
    return f"{lat:.2f},{lon:.2f}"


def get_campus_buildings(anchor_lat: float, anchor_lon: float, radius_m: int = 2000) -> dict:
    """
    Get cached campus buildings or fetch from OSM.
    anchor_lat/lon should be a known point on campus.
    """
    cache_key = _get_cache_key(anchor_lat, anchor_lon)

    if cache_key not in _campus_cache:
        _campus_cache[cache_key] = _fetch_campus_buildings(anchor_lat, anchor_lon, radius_m)

    return _campus_cache[cache_key]


def osm_geocode(building_name: str, anchor_lat: float, anchor_lon: float) -> Optional[dict]:
    """
    Try to geocode a building name using OSM data.

    Args:
        building_name: The building name to search for
        anchor_lat: Latitude of a known campus point (for fetching nearby buildings)
        anchor_lon: Longitude of a known campus point

    Returns:
        Dict with lat, lon, confidence, source if found, else None
    """
    if not building_name:
        return None

    # Get campus buildings
    buildings = get_campus_buildings(anchor_lat, anchor_lon)

    if not buildings:
        return None

    # Normalize the query
    query_normalized = _normalize_name(building_name)

    if not query_normalized:
        return None

    # First try exact match
    if query_normalized in buildings:
        bld = buildings[query_normalized]
        logger.info(f"OSM exact match: '{building_name}' -> '{bld['full_name']}'")
        return {
            "lat": bld["lat"],
            "lng": bld["lon"],
            "confidence": 0.95,
            "source": "osm_exact",
            "matched_name": bld["full_name"]
        }

    # Try subject-based match (e.g., "Physics Building" -> look for "physics" key)
    query_subject = _extract_subject(building_name)
    if query_subject and query_subject in buildings:
        bld = buildings[query_subject]
        logger.info(f"OSM subject match: '{building_name}' -> '{bld['full_name']}' (subject: {query_subject})")
        return {
            "lat": bld["lat"],
            "lng": bld["lon"],
            "confidence": 0.85,
            "source": "osm_subject",
            "matched_name": bld["full_name"]
        }

    # Try fuzzy match
    building_names = list(buildings.keys())
    match = process.extractOne(
        query_normalized,
        building_names,
        scorer=fuzz.token_set_ratio
    )

    if match and match[1] >= MIN_MATCH_SCORE:
        matched_key = match[0]
        score = match[1]
        bld = buildings[matched_key]

        # Scale confidence based on fuzzy score
        confidence = 0.5 + (score / 100) * 0.4  # 0.5 to 0.9

        logger.info(f"OSM fuzzy match: '{building_name}' -> '{bld['full_name']}' (score: {score})")
        return {
            "lat": bld["lat"],
            "lng": bld["lon"],
            "confidence": confidence,
            "source": "osm_fuzzy",
            "matched_name": bld["full_name"],
            "match_score": score
        }

    return None


def clear_cache():
    """Clear the campus buildings cache."""
    global _campus_cache
    _campus_cache = {}
