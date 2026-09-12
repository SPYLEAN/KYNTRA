"""KYNTRA API Observability & Timing Middleware.

Adapted from APEXiq pattern:
- Assigns or propagates correlation X-Request-ID
- Benchmarks execution time with microsecond accuracy via time.perf_counter()
- Emits structured JSON diagnostics for slow API queries (>1000ms) and errors
- Exposes X-Request-ID and X-Response-Time in response headers
"""

import logging
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("kyntra.api.middleware")


class APITimingMiddleware(BaseHTTPMiddleware):
    """Logs request method, path, status, and duration, and injects diagnostic headers."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Correlation ID: reuse existing header or generate a concise 8-character ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
        start_time = time.perf_counter()

        response = await call_next(request)

        duration_ms = (time.perf_counter() - start_time) * 1000.0
        status_code = response.status_code
        method = request.method
        path = request.url.path

        # Determine log severity based on response code and performance SLA
        if status_code >= 500:
            log_fn = logger.error
        elif status_code >= 400 or duration_ms > 1000.0:
            log_fn = logger.warning
        else:
            log_fn = logger.info

        # Skip high-frequency health checks from verbose logging to keep terminal clean
        if path != "/health" and path != "/api/system":
            log_fn(
                f"{method} {path} {status_code} {duration_ms:.1f}ms",
                extra={
                    "request_id": request_id,
                    "method": method,
                    "path": path,
                    "status": status_code,
                    "duration_ms": round(duration_ms, 2),
                    "client": request.client.host if request.client else None,
                },
            )

        # Inject diagnostic response headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"

        return response
