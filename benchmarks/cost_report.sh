#!/usr/bin/env bash
# Pull last-30-day AWS cost broken down by service. Run with the deploy role assumed.
# Old infra: EC2 + RDS lines (if still tagged). New infra: Lambda, DynamoDB, States, API Gateway.
set -euo pipefail

END=$(date -u +%F)
START=$(date -u -d "30 days ago" +%F)

aws ce get-cost-and-usage \
  --time-period "Start=${START},End=${END}" \
  --granularity MONTHLY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[].Groups[].[Keys[0],Metrics.UnblendedCost.Amount]' \
  --output table
