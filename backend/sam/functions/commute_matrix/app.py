"""POST /api/distance-matrix — Mapbox Matrix proxy."""
import os
import requests
from calview_shared.http import respond, error, parse_body

MAPBOX_TOKEN = os.environ["MAPBOX_TOKEN"]
PROFILES = {"walking": "walking", "driving": "driving", "bicycling": "cycling", "transit": "driving"}


def handler(event, _ctx):
    body = parse_body(event)
    origins = body.get("origins") or []
    destinations = body.get("destinations") or []
    mode = body.get("mode", "walking")

    if mode not in PROFILES:
        return error(400, f"Invalid mode. Use: {', '.join(PROFILES)}", event)
    if not origins or not destinations:
        return error(400, "origins and destinations required", event)
    if max(len(origins), len(destinations)) > 25:
        return error(400, "Maximum 25 origins/destinations allowed", event)

    coords = ";".join(f"{c['lng']},{c['lat']}" for c in origins + destinations)
    sources = ";".join(str(i) for i in range(len(origins)))
    dests = ";".join(str(i + len(origins)) for i in range(len(destinations)))
    url = f"https://api.mapbox.com/directions-matrix/v1/mapbox/{PROFILES[mode]}/{coords}"

    r = requests.get(url, params={
        "sources": sources, "destinations": dests,
        "annotations": "duration,distance", "access_token": MAPBOX_TOKEN,
    }, timeout=10)
    if not r.ok:
        return error(502, "Matrix provider error", event)

    data = r.json()
    durations, distances = data.get("durations") or [], data.get("distances") or []
    results = [
        [
            None if durations[i][j] is None else {
                "duration_seconds": int(durations[i][j]),
                "duration_text": f"{round(durations[i][j] / 60)} min",
                "distance_meters": int(distances[i][j] or 0),
                "distance_text": f"{(distances[i][j] or 0) / 1000:.1f} km",
            }
            for j in range(len(destinations))
        ]
        for i in range(len(origins))
    ]
    return respond(200, {"results": results}, event)
