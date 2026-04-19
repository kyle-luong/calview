"""GET /api/sessions/{shortId}/status — poll endpoint for processing state."""
from calview_shared import ddb
from calview_shared.http import respond, error


def handler(event, _ctx):
    short_id = (event.get("pathParameters") or {}).get("shortId")
    if not short_id:
        return error(400, "Missing shortId", event)
    item = ddb.get_session(short_id)
    if not item:
        return error(404, "Session not found", event)
    return respond(200, {
        "short_id": short_id,
        "status": item.get("status"),
        "event_count": int(item.get("eventCount", 0)),
        "error_message": item.get("errorMessage"),
    }, event)
