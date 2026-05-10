# calview AWS handoff

Branch: `overhaul/serverless-sam`. Pick **one** of the options below.

## Option A — You deploy it yourself (most secure, ~10 min)

```bash
git fetch origin && git checkout overhaul/serverless-sam
cd backend/sam
sam build --use-container
sam deploy --guided
```

When prompted:
- Stack name: `calview`
- Region: `us-east-1` (or your preference)
- Parameters: `HashidSalt` (any random string), `MapboxToken`, `GoogleMapsKey` (optional), `AllowedOrigins` (comma list of your domains)

The stack outputs `ApiUrl`, `FrontendBucketName`, `CloudFrontDistributionId` — share those back.

## Option B — Give me a scoped IAM role to deploy via GitHub Actions

1. Create OIDC provider for `token.actions.githubusercontent.com` (one-time).
2. Create IAM role `calview-deploy` trusting that provider, scoped to this repo:
   ```
   "token.actions.githubusercontent.com:sub": "repo:<owner>/calview:*"
   ```
3. Attach `AWSCloudFormationFullAccess` + a policy granting Lambda, IAM PassRole, S3, DynamoDB, StepFunctions, APIGateway, CloudFront, Logs.
4. Send me the role ARN. I add it as the `AWS_ROLE_TO_ASSUME` repo secret. Pushes to `main` deploy automatically.

## Option C — Give me a temporary access key (fastest, least secure)

Create an IAM user with admin (or the same policy as Option B), generate an
access key, send me both via a password manager / 1Password share — **not
plain email/chat**. I deploy once, then rotate/delete the key.

---

## Required repo secrets (for Options B/C)

| Secret | Source |
|---|---|
| `AWS_ROLE_TO_ASSUME` | Option B only |
| `HASHID_SALT` | Any random 32+ char string |
| `MAPBOX_TOKEN` | https://account.mapbox.com/access-tokens (server token, geocoder enabled) |
| `VITE_MAPBOX_TOKEN` | Public token for frontend |
| `GOOGLE_MAPS_KEY` | Optional |
| `ALLOWED_ORIGINS` | e.g. `https://www.calview.me,https://calview.me` |

## After deploy

1. Point `calview.me` DNS at the CloudFront distribution (CNAME the `CloudFrontDomain` output, or alias if using Route 53).
2. Add `calview.me` to the CloudFront distribution as an Alternate Domain Name + attach an ACM cert in `us-east-1`.
3. Old EC2/RDS can be stopped after smoke-testing the new endpoints.

Run `benchmarks/compare_latency.sh` and `benchmarks/cost_report.sh` to compare against the old stack while both are live.
