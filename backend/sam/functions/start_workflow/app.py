"""POST /api/sessions/{shortId}/process — kick off Step Functions import workflow."""
import json
import os

import boto3
from calview_shared import ddb
from calview_shared.http import respond, error

sfn = boto3.client("stepfunctions")
STATE_MACHINE_ARN = os.environ["STATE_MACHINE_ARN"]


def handler(event, _ctx):
    short_id = (event.get("pathParameters") or {}).get("shortId")
    if not short_id:
        return error(400, "Missing shortId", event)

    item = ddb.get_session(short_id)
    if not item:
        return error(404, "Session not found", event)

    ddb.SESSIONS.update_item(
        Key={"shortId": short_id},
        UpdateExpression="SET #s = :p",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":p": "PROCESSING"},
    )

    sfn.start_execution(
        stateMachineArn=STATE_MACHINE_ARN,
        input=json.dumps({
            "shortId": short_id,
            "sessionId": item["sessionId"],
            "rawIcsS3Key": item["rawIcsS3Key"],
        }),
    )

    return respond(202, {"short_id": short_id, "status": "PROCESSING"}, event)
