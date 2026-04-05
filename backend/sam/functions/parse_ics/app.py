"""Step Functions task: load ICS from S3 and parse it."""
import os

import boto3
from calview_shared.parser import parse_ics_content

s3 = boto3.client("s3")
BUCKET = os.environ["UPLOAD_BUCKET"]


def handler(event, _ctx):
    key = event["rawIcsS3Key"]
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    content = obj["Body"].read().decode("utf-8")
    parsed = parse_ics_content(content)
    if not parsed["events"]:
        raise RuntimeError("No events found in ICS file")
    return parsed
