"""POST /api/sessions — create session record + return presigned S3 upload URL."""
import os
import time
import uuid

import boto3
from calview_shared import ddb
from calview_shared import rate_limit
from calview_shared.http import respond, error
from calview_shared.ids import new_short_id

s3 = boto3.client("s3")
BUCKET = os.environ["UPLOAD_BUCKET"]


def handler(event, _ctx):
    if not rate_limit.check(event):
        return error(429, "Too many requests", event)

    short_id = new_short_id()
    session_id = str(uuid.uuid4())
    key = f"uploads/{session_id}.ics"

    ddb.SESSIONS.put_item(Item={
        "shortId": short_id,
        "sessionId": session_id,
        "status": "AWAITING_UPLOAD",
        "createdAt": int(time.time()),
        "rawIcsS3Key": key,
        "expiresAt": ddb.ttl_expires(),
    })

    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": "text/calendar"},
        ExpiresIn=300,
    )

    return respond(200, {
        "short_id": short_id,
        "session_id": session_id,
        "upload_url": upload_url,
        "upload_key": key,
    }, event)
