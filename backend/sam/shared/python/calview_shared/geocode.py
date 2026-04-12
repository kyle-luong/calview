"""Geocoder: Nominatim (free) primary, Mapbox fallback. Results cached in DynamoDB."""
import hashlib
import logging
import os
import time

import requests

from . import ddb

log = logging.getLogger(__name__)
MAPBOX_TOKEN = os.environ.get("MAPBOX_TOKEN", "")
CACHE_TTL_DAYS = 90


def _hash(loc: str) -> str:
    return hashlib.sha256(loc.strip().lower().encode()).hexdigest()[:32]


def _nominatim(q):
    r = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": q, "format": "json", "limit": 1},
        headers={"User-Agent": "calview/1.0 (floodwatchuva@gmail.com)"},
        timeout=8,
    )
    items = r.json() if r.ok else []
    return (float(items[0]["lat"]), float(items[0]["lon"]), "nominatim") if items else None


def _mapbox(q):
    if not MAPBOX_TOKEN:
        return None
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{requests.utils.quote(q)}.json"
    r = requests.get(url, params={"access_token": MAPBOX_TOKEN, "limit": 1}, timeout=8)
    feats = r.json().get("features", []) if r.ok else []
    if not feats:
        return None
    lng, lat = feats[0]["center"]
    return float(lat), float(lng), "mapbox"


def geocode_one(location: str) -> dict:
    if not location:
        return {"location": location, "lat": None, "lng": None}

    key = _hash(location)
    cached = ddb.GEO_CACHE.get_item(Key={"locationHash": key}).get("Item")
    if cached:
        return {"location": location, "lat": float(cached["lat"]), "lng": float(cached["lng"])}

    try:
        result = _nominatim(location) or _mapbox(location)
    except Exception as e:
        log.warning("geocode failed for %s: %s", location, e)
        result = None

    if not result:
        return {"location": location, "lat": None, "lng": None}

    lat, lng, provider = result
    ddb.GEO_CACHE.put_item(Item={
        "locationHash": key, "lat": str(lat), "lng": str(lng), "provider": provider,
        "expiresAt": int(time.time()) + CACHE_TTL_DAYS * 86400,
    })
    time.sleep(1.0)  # Nominatim asks for <=1 req/sec
    return {"location": location, "lat": lat, "lng": lng}


def geocode_many(locations: list[str]) -> dict[str, dict]:
    return {loc: geocode_one(loc) for loc in locations}
