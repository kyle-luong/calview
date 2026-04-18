"""Step Functions task: batch-write events to DynamoDB and mark session complete."""
import hashlib
from calview_shared import ddb


def _event_sort_key(ev: dict) -> str:
    h = hashlib.sha1(f"{ev['title']}{ev['start_date']}{ev['start_time']}{ev['location']}".encode()).hexdigest()[:8]
    return f"{ev['start_date']}T{ev['start_time']}#{h}"


def handler(event, _ctx):
    short_id = event["shortId"]
    session_id = event["sessionId"]
    events = event.get("events") or []
    geocoded = event.get("geocoded") or {}
    expires = ddb.ttl_expires()

    with ddb.EVENTS.batch_writer() as batch:
        for ev in events:
            geo = geocoded.get(ev.get("cleaned_location") or "", {})
            batch.put_item(Item={
                "sessionId": session_id,
                "sortKey": _event_sort_key(ev),
                "title": ev["title"],
                "location": ev["location"],
                "startTime": ev["start_time"],
                "endTime": ev["end_time"],
                "startDate": ev["start_date"],
                "endDate": ev["end_date"],
                "dayOfWeek": ev["day_of_week"],
                "lat": str(geo.get("lat")) if geo.get("lat") is not None else None,
                "lng": str(geo.get("lng")) if geo.get("lng") is not None else None,
                "expiresAt": expires,
            })

    ddb.SESSIONS.update_item(
        Key={"shortId": short_id},
        UpdateExpression="SET #s = :c, eventCount = :n",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":c": "COMPLETE", ":n": len(events)},
    )
    return {"eventCount": len(events), "status": "COMPLETE"}
