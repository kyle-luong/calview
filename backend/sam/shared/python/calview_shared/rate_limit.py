"""Per-IP rate limit (rolling 60s window) via DynamoDB conditional updates."""
import os
import time

import boto3
from botocore.exceptions import ClientError

_table = None
_WINDOW = 60


def _get_table():
    global _table
    name = os.environ.get("RATE_LIMIT_TABLE")
    if not name:
        return None
    if _table is None:
        _table = boto3.resource("dynamodb").Table(name)
    return _table


def _limit() -> int:
    return int(os.environ.get("RATE_LIMIT_PER_MIN", "60"))


def client_ip(event: dict) -> str:
    headers = event.get("headers") or {}
    xff = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For") or ""
    if xff:
        return xff.split(",")[0].strip()
    http = (event.get("requestContext") or {}).get("http") or {}
    return http.get("sourceIp") or "unknown"


def check(event: dict) -> bool:
    tbl = _get_table()
    if not tbl:
        return True

    pk = f"rl#{client_ip(event)}"
    now = int(time.time())
    cutoff = now - _WINDOW
    ttl = now + _WINDOW * 2
    limit = _limit()
    names = {"#c": "count"}
    reset_vals = {
        ":one": 1,
        ":now": now,
        ":cutoff": cutoff,
        ":ttl": ttl,
    }
    incr_vals = {
        ":one": 1,
        ":cutoff": cutoff,
        ":ttl": ttl,
        ":lim": limit,
    }

    try:
        tbl.update_item(
            Key={"pk": pk},
            UpdateExpression="SET #c = :one, windowStart = :now, expiresAt = :ttl",
            ConditionExpression="attribute_not_exists(windowStart) OR windowStart < :cutoff",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=reset_vals,
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise

    try:
        tbl.update_item(
            Key={"pk": pk},
            UpdateExpression="ADD #c :one SET expiresAt = :ttl",
            ConditionExpression="windowStart >= :cutoff AND #c < :lim",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=incr_vals,
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise
