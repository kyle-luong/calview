import os
import time
import boto3
from boto3.dynamodb.conditions import Key

_ddb = boto3.resource("dynamodb")

SESSIONS = _ddb.Table(os.environ["SESSIONS_TABLE"]) if "SESSIONS_TABLE" in os.environ else None
EVENTS = _ddb.Table(os.environ["EVENTS_TABLE"]) if "EVENTS_TABLE" in os.environ else None
GEO_CACHE = _ddb.Table(os.environ["GEOCODE_CACHE_TABLE"]) if "GEOCODE_CACHE_TABLE" in os.environ else None
CONTACT = _ddb.Table(os.environ["CONTACT_TABLE"]) if "CONTACT_TABLE" in os.environ else None


def ttl_expires(days: int | None = None) -> int:
    days = days if days is not None else int(os.environ.get("SESSION_TTL_DAYS", "30"))
    return int(time.time()) + days * 86400


def get_session(short_id: str) -> dict | None:
    res = SESSIONS.get_item(Key={"shortId": short_id})
    return res.get("Item")


def query_events(session_id: str) -> list[dict]:
    items, kwargs = [], {"KeyConditionExpression": Key("sessionId").eq(session_id)}
    while True:
        res = EVENTS.query(**kwargs)
        items.extend(res.get("Items", []))
        if "LastEvaluatedKey" not in res:
            return items
        kwargs["ExclusiveStartKey"] = res["LastEvaluatedKey"]
