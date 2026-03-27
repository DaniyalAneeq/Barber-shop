"""
Global error handling middleware.

- Catches all unhandled exceptions
- Returns structured JSON error responses
- Logs with request ID for traceability
- Attaches X-Refresh-Token header when token was refreshed
"""
import logging
import traceback
import uuid

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        try:
            response = await call_next(request)

            # Attach refreshed token if auth dep set it
            refresh = getattr(request.state, "refresh_token", None)
            if refresh:
                response.headers["X-Refresh-Token"] = refresh

            return response

        except Exception as exc:
            logger.error(
                "[%s] Unhandled exception on %s %s: %s\n%s",
                request_id,
                request.method,
                request.url.path,
                exc,
                traceback.format_exc(),
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "An unexpected error occurred. Please try again.",
                    "request_id": request_id,
                },
            )
