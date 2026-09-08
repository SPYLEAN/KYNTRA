"""KYNTRA FastAPI Application Entrypoint."""

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from kyntra.api.routes import router

app = FastAPI(
    title="KYNTRA — Energy & Overtake Intelligence API",
    description="Operational Decision Engine and Replay API for Formula 1 Tactical Intelligence",
    version="1.0.0",
)

# Enable CORS for local dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)

# Mount static build if available
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DIST_DIR = PROJECT_ROOT / "web" / "dist"

if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "kyntra-api", "version": "1.0.0"}
