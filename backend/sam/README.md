# calview serverless backend

Event-driven AWS architecture: API Gateway (HTTP API) → Lambda → Step Functions → DynamoDB + S3.

## Architecture

```
React SPA (S3 + CloudFront)
        |
        v
API Gateway (HTTP API)
  ├── POST /api/sessions               → CreateSessionFn (presigned PUT URL)
  ├── POST /api/sessions/{id}/process  → StartWorkflowFn (StepFunctions execution)
  ├── GET  /api/sessions/{id}/status   → GetStatusFn
  ├── GET  /api/sessions/{id}          → GetSessionFn
  ├── POST /api/distance-matrix        → CommuteMatrixFn (Mapbox)
  └── POST /api/contact                → ContactFn

Browser PUT raw .ics → S3 (uploads/{sessionId}.ics, 7-day lifecycle)

Step Functions (Express): ParseICS → GeocodeLocations → PersistEvents
                              ↓ any failure → MarkFailed
```

## DynamoDB tables (all pay-per-request, TTL enabled)

| Table | PK / SK | Purpose |
|---|---|---|
| `Sessions`     | `shortId`               | Session metadata + status |
| `Events`       | `sessionId` / `sortKey` | Parsed events, ordered by start time |
| `GeocodeCache` | `locationHash`          | Geocoding cache (90 day TTL) |
| `Contact`      | `id`                    | Contact form submissions |

## Cost-minimizing choices

- **HTTP API** (~$1/M requests) instead of REST API (~$3.50/M)
- **x86_64 Lambda** (matches GitHub Actions `ubuntu-latest`; arm64 failed cross-arch container builds)
- **PAY_PER_REQUEST** DynamoDB — no idle cost
- **EXPRESS** Step Functions — billed per execution, much cheaper than Standard for <5min flows
- **Nominatim (OSM)** geocoder primary, Mapbox fallback only when needed; results cached
- **S3 lifecycle**: raw ICS deleted after 7 days; session TTL expires data after 30 days
- **CloudFront PriceClass_100** (US/EU only) — set this on the distribution you create separately

Expected cost at <1k sessions/month: a few cents, well under AWS free tier.

## Local build

```bash
cd backend/sam
sam validate --lint
sam build --use-container
sam deploy --guided          # first time only
```

## Required secrets / parameters

| Name | Where | Notes |
|---|---|---|
| `HashidSalt`     | SAM param | Random string. Determines short-URL encoding. |
| `MapboxToken`    | SAM param | Public token (`pk.…`) — used by commute matrix and as geocoder fallback |
| `GoogleMapsKey`  | SAM param | Optional. Only used if commute matrix prefers Google. |
| `AllowedOrigins` | SAM param | Comma list. e.g. `https://www.calview.me,https://calview.me` |

## GitHub Actions secrets (for OIDC deploy)

- `AWS_ROLE_TO_ASSUME` — IAM role ARN with trust on the GitHub OIDC provider
- `HASHID_SALT`, `MAPBOX_TOKEN`, `GOOGLE_MAPS_KEY`, `ALLOWED_ORIGINS`
- `VITE_MAPBOX_TOKEN`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`

The IAM role needs permissions for: CloudFormation, Lambda, IAM (PassRole),
S3, DynamoDB, StepFunctions, APIGateway, Logs, and (for frontend deploy) the
target S3 bucket and CloudFront distribution.
