# Benchmarks: old vs new architecture

## Latency

```bash
chmod +x compare_latency.sh
OLD_API=https://api-old.calview.me \
NEW_API=https://<httpapi-id>.execute-api.us-east-1.amazonaws.com \
  ./compare_latency.sh sample.ics 10
```

Reports per-request and average end-to-end latency (upload → events visible)
for both backends.

Expectation: the new flow has ~1 extra hop (presigned PUT) and async polling,
so a single cold session may be slower than the old synchronous path; warm
sessions and subsequent reads are faster due to DynamoDB single-digit-ms
lookups vs. EC2/Postgres roundtrip.

## Cost

```bash
./cost_report.sh
```

Pulls last-30-day cost grouped by service via AWS Cost Explorer.

To attribute cost to old vs. new precisely, tag old resources with
`Stack=legacy` and the SAM stack with `Stack=serverless` (SAM already
propagates `aws:cloudformation:stack-name=calview`).

## CloudWatch metrics worth watching

| Metric                                       | Why |
|----------------------------------------------|-----|
| `AWS/Lambda` Duration p50/p95                | Cold vs warm latency per function |
| `AWS/Lambda` Invocations                     | Volume (also drives cost) |
| `AWS/Lambda` Throttles, Errors               | Reliability |
| `AWS/States` ExecutionTime, ExecutionsFailed | Workflow health |
| `AWS/DynamoDB` ConsumedReadCapacityUnits     | DDB cost driver |
| `AWS/ApiGateway` Count, Latency, 4XX/5XX     | Edge latency |
