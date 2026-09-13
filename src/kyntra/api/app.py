"""KYNTRA FastAPI Application Entrypoint."""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from kyntra.api.middleware import APITimingMiddleware
from kyntra.api.routes import router
from kyntra.api.stream import stream_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up replay parquet cache and LightGBM model at startup for zero session-switch lag
    try:
        from kyntra.processing.replay_loader import warm_replay_cache
        warm_replay_cache()
    except Exception as e:
        print(f"[KYNTRA Lifespan] Parquet cache pre-warm note: {e}")
    try:
        from kyntra.models.registry import get_overtake_model
        model = get_overtake_model()
        model.predict_one({
            "gap_seconds": 1.0,
            "closing_rate": 0.5,
            "recent_pace_delta_1lap": 0.1,
            "recent_pace_delta_3laps": 0.1,
            "speed_trap_delta": 2.0,
        })
    except Exception as e:
        print(f"[KYNTRA Lifespan] Model pre-warm note: {e}")
    try:
        from kyntra.runtime import get_runtime_orchestrator
        orch = get_runtime_orchestrator()
        orch.step()
    except Exception as e:
        print(f"[KYNTRA Lifespan] Orchestrator pre-warm note: {e}")
    try:
        from kyntra.services.live_service import get_live_race_service
        live = get_live_race_service()
        live.step()
    except Exception as e:
        print(f"[KYNTRA Lifespan] Live service pre-warm note: {e}")
    yield


app = FastAPI(
    title="KYNTRA — Energy & Overtake Intelligence API",
    description="Operational Decision Engine and Replay API for Formula 1 Tactical Intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for local dev servers and expose diagnostic headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)

# API Execution Timing & Request Correlation Middleware
app.add_middleware(APITimingMiddleware)

# Include API routes
app.include_router(router)
app.include_router(stream_router, prefix="/api")

# Mount static build if available
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DIST_DIR = PROJECT_ROOT / "web" / "dist"

if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "kyntra-api", "version": "1.0.0"}
