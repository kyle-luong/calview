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

# Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Minimum fuzzy match score to consider a match (0-100)
MIN_MATCH_SCORE = 65


def _normalize_name(name: str) -> str:
    """Normalize building name for matching."""
    if not name:
        return ""
    # Lowercase, remove extra whitespace
    name = " ".join(name.lower().split())
    # Remove common suffixes that might differ
    name = re.sub(r'\s+(building|hall|center|centre)$', '', name)
    return name


def _fetch_campus_buildings(lat: float, lon: float, radius_m: int = 2000) -> dict:
    """
    Fetch all named buildings within radius of a point from OSM.
    Returns dict of {normalized_name: {lat, lon, full_name}}
    """
    # Query for buildings within radius
    query = f"""
    [out:json][timeout:30];
    (
      way["building"]["name"](around:{radius_m},{lat},{lon});
      relation["building"]["name"](around:{radius_m},{lat},{lon});
    );
    out center tags;
    """

    try:
        response = requests.post(OVERPASS_URL, data={"data": query}, timeout=30)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        logger.warning(f"OSM Overpass query failed: {e}")
        return {}

    buildings = {}
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

        normalized = _normalize_name(name)
        if normalized:
            buildings[normalized] = {
                "lat": blat,
                "lon": blon,
                "full_name": name
            }

            # Also add alternative names if present
            alt_name = tags.get("alt_name")
            if alt_name:
                alt_normalized = _normalize_name(alt_name)
                if alt_normalized:
                    buildings[alt_normalized] = {
                        "lat": blat,
                        "lon": blon,
                        "full_name": name
                    }

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
