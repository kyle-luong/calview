import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.api import routes
from app.middleware.rate_limit import RateLimitMiddleware

app = FastAPI()

# Rate limiting middleware (before CORS)
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=60,   # 60 requests per minute per IP
    requests_per_hour=1000,   # 1000 requests per hour per IP
    burst_limit=10,           # Max 10 requests per second
)

# Get allowed origins from environment or use defaults
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "chrome-extension://*",
]

# Filter empty strings and combine
origins = [o.strip() for o in ALLOWED_ORIGINS if o.strip()] or DEFAULT_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix="/api")

# Health check endpoint (excluded from rate limiting)
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if os.getenv("TESTING") != "true":
    init_db()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)