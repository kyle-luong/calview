"""Step Functions task: geocode unique locations (cached in DDB)."""
from calview_shared.geocode import geocode_many


def handler(event, _ctx):
    locations = event.get("locations") or []
    return {"geocoded": geocode_many(locations)}
