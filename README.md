# calview

A calendar visualizer that parses `.ics` files, geocodes event locations, and displays a time-aware schedule with commutes.

- **Frontend**: React 19, Vite, Tailwind CSS, Mapbox GL JS
- **Backend**: AWS Lambda + Step Functions + DynamoDB + S3, deployed with AWS SAM
- **Hosting**: S3 + CloudFront (frontend), API Gateway HTTP API (backend)
- **CI/CD**: GitHub Actions with OIDC (no static AWS keys)

## Architecture

```
SPA (S3 + CloudFront)
   │
   ▼
API Gateway HTTP API ──► Lambda ──► Step Functions ──► DynamoDB
                                       │
                                       └─► S3 (raw ICS, 7-day lifecycle)
```

See [backend/sam/README.md](backend/sam/README.md) for the full stack.

## Local development

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend (requires Docker for sam build --use-container)
cd backend/sam && sam build --use-container && sam local start-api
```

## Deploy

First time (interactive, picks region/params):
```bash
cd backend/sam && sam deploy --guided
```

After that, pushes to `main` deploy via GitHub Actions. Required repo secrets are listed in [backend/sam/README.md](backend/sam/README.md).

## Feedback

- Try it: https://calview.me
- Contact: in-app form or GitHub issue.
