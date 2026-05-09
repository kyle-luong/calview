#!/usr/bin/env bash
# Compare upload→view latency between old (FastAPI/EC2) and new (Lambda/SFN) backends.
#
# Usage:
#   OLD_API=https://api-old.calview.me NEW_API=https://abc123.execute-api.us-east-1.amazonaws.com \
#     ./compare_latency.sh sample.ics 10
#
# Args: <ics_file> <iterations>
set -euo pipefail

ICS="${1:-sample.ics}"
N="${2:-10}"
OLD="${OLD_API:?set OLD_API}"
NEW="${NEW_API:?set NEW_API}"

bench_old() {
  local t0=$(date +%s.%N)
  short=$(curl -s -X POST -F "file=@${ICS}" "${OLD}/api/sessions" | jq -r .short_id)
  curl -s "${OLD}/api/sessions/${short}" > /dev/null
  echo "$(echo "$(date +%s.%N) - $t0" | bc)"
}

bench_new() {
  local t0=$(date +%s.%N)
  resp=$(curl -s -X POST "${NEW}/api/sessions" -H 'Content-Type: application/json' -d '{}')
  short=$(echo "$resp" | jq -r .short_id)
  url=$(echo "$resp" | jq -r .upload_url)
  curl -s -X PUT -H 'Content-Type: text/calendar' --data-binary "@${ICS}" "$url" > /dev/null
  curl -s -X POST "${NEW}/api/sessions/${short}/process" > /dev/null
  while :; do
    status=$(curl -s "${NEW}/api/sessions/${short}/status" | jq -r .status)
    [[ "$status" == COMPLETE ]] && break
    [[ "$status" == FAILED   ]] && { echo "FAIL"; return 1; }
    sleep 0.5
  done
  curl -s "${NEW}/api/sessions/${short}" > /dev/null
  echo "$(echo "$(date +%s.%N) - $t0" | bc)"
}

run() {
  local label=$1 fn=$2 sum=0
  echo "=== $label ($N iters) ==="
  for i in $(seq 1 "$N"); do
    t=$($fn)
    printf "  %2d  %.3fs\n" "$i" "$t"
    sum=$(echo "$sum + $t" | bc)
  done
  echo "  avg: $(echo "scale=3; $sum / $N" | bc)s"
}

run "OLD (EC2/FastAPI)" bench_old
run "NEW (Lambda/SFN)"  bench_new
