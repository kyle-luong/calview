"""POST /api/contact — store contact submission."""
import re
import time
import uuid

from calview_shared import ddb
from calview_shared import rate_limit
from calview_shared.http import respond, error, parse_body

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
LIMITS = {"name": 100, "subject": 200, "message": 5000}


def handler(event, _ctx):
    if not rate_limit.check(event):
        return error(429, "Too many requests", event)

    body = parse_body(event)
    fields = {k: (body.get(k) or "").strip() for k in ("name", "email", "subject", "message")}

    if not all(fields.values()):
        return error(400, "All fields required", event)
    if not EMAIL_RE.match(fields["email"]):
        return error(400, "Invalid email", event)
    for k, lim in LIMITS.items():
        if len(fields[k]) > lim:
            return error(400, f"{k} must be {lim} characters or less", event)

    ddb.CONTACT.put_item(Item={"id": str(uuid.uuid4()), "createdAt": int(time.time()), **fields})
    return respond(200, {"success": True}, event)
