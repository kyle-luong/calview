"""GET /api/sessions/{shortId} — fetch session metadata + events."""
from calview_shared import ddb
from calview_shared.http import respond, error


def handler(event, _ctx):
    short_id = (event.get("pathParameters") or {}).get("shortId")
    if not short_id:
        return error(400, "Missing shortId", event)

    session = ddb.get_session(short_id)
    if not session:
        return error(404, "Session not found", event)

    events = ddb.query_events(session["sessionId"]) if session.get("status") == "COMPLETE" else []

    return respond(200, {
        "short_id": short_id,
        "status": session.get("status"),
        "event_count": int(session.get("eventCount", 0)),
        "events": [
            {
                "title": e.get("title"),
                "location": e.get("location"),
                "start": e.get("startTime"),
                "end": e.get("endTime"),
                "start_date": e.get("startDate"),
                "end_date": e.get("endDate"),
                "dayOfWeek": e.get("dayOfWeek", []),
                "latitude": float(e["lat"]) if e.get("lat") else None,
                "longitude": float(e["lng"]) if e.get("lng") else None,
            }
            for e in events
        ],
    }, event)
