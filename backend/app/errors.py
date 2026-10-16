"""Unified response envelope and error codes (spec §10)."""

import logging
import uuid
from contextvars import ContextVar
from enum import StrEnum
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

log = logging.getLogger("masso")

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class ErrorCode(StrEnum):
    AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS"
    AUTH_FORBIDDEN = "AUTH_FORBIDDEN"
    SCENARIO_NOT_VALID = "SCENARIO_NOT_VALID"
    SESSION_NOT_READY = "SESSION_NOT_READY"
    HINT_LIMIT_EXCEEDED = "HINT_LIMIT_EXCEEDED"
    VERIFICATION_FAILED = "VERIFICATION_FAILED"
    LLM_PROVIDER_UNAVAILABLE = "LLM_PROVIDER_UNAVAILABLE"
    SANDBOX_LIMIT_EXCEEDED = "SANDBOX_LIMIT_EXCEEDED"
    REPORT_PERIOD_REQUIRED = "REPORT_PERIOD_REQUIRED"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"


HTTP_STATUS: dict[ErrorCode, int] = {
    ErrorCode.AUTH_INVALID_CREDENTIALS: 401,
    ErrorCode.AUTH_FORBIDDEN: 403,
    ErrorCode.SCENARIO_NOT_VALID: 422,
    ErrorCode.SESSION_NOT_READY: 409,
    ErrorCode.HINT_LIMIT_EXCEEDED: 409,
    ErrorCode.VERIFICATION_FAILED: 500,
    ErrorCode.LLM_PROVIDER_UNAVAILABLE: 503,
    ErrorCode.SANDBOX_LIMIT_EXCEEDED: 503,
    ErrorCode.REPORT_PERIOD_REQUIRED: 422,
    ErrorCode.VALIDATION_ERROR: 422,
    ErrorCode.NOT_FOUND: 404,
}


class AppError(Exception):
    """Domain error rendered as the error envelope. Message is Russian, user-facing."""

    def __init__(
        self, code: ErrorCode, message: str, details: dict[str, Any] | None = None, status: int | None = None
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}
        self.status = status or HTTP_STATUS[code]


def ok(data: Any = None) -> dict[str, Any]:
    return {"request_id": request_id_var.get(), "status": "success", "data": data}


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "request_id": request_id_var.get(),
        "status": "error",
        "error": {"code": code, "message": message, "details": details or {}},
    }


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        token = request_id_var.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers["x-request-id"] = rid
        return response


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(error_body(exc.code, exc.message, exc.details), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [{"loc": [str(p) for p in e.get("loc", [])], "msg": e.get("msg", "")} for e in exc.errors()]
        return JSONResponse(
            error_body(ErrorCode.VALIDATION_ERROR, "Проверьте введённые данные.", {"fields": fields}), status_code=422
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        if exc.status_code == 404:
            return JSONResponse(error_body(ErrorCode.NOT_FOUND, "Ресурс не найден."), status_code=404)
        if exc.status_code in (401, 403):
            return JSONResponse(error_body(ErrorCode.AUTH_FORBIDDEN, "Недостаточно прав."), status_code=exc.status_code)
        return JSONResponse(error_body(ErrorCode.VALIDATION_ERROR, "Некорректный запрос."), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error", exc_info=exc)
        return JSONResponse(
            error_body(ErrorCode.VERIFICATION_FAILED, "Внутренняя ошибка сервера. Повторите попытку позже."),
            status_code=500,
        )
