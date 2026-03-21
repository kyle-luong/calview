import json
import os

_ALLOWED = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]


def _cors(origin: str | None) -> dict:
    allow = origin if origin and origin in _ALLOWED else (_ALLOWED[0] if _ALLOWED else "*")
    return {
        "Access-Control-Allow-Origin": allow,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    }


def respond(status: int, body, event: dict | None = None) -> dict:
    origin = None
    if event:
        headers = event.get("headers") or {}
        origin = headers.get("origin") or headers.get("Origin")
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", **_cors(origin)},
        "body": json.dumps(body, default=str),
    }


def error(status: int, message: str, event: dict | None = None) -> dict:
    return respond(status, {"error": message, "message": message}, event)


def parse_body(event: dict) -> dict:
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64
        body = base64.b64decode(body).decode("utf-8")
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {}
