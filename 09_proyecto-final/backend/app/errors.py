from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException


class ApiError(Exception):
    def __init__(self, status: int, code: str, field: str | None = None):
        self.status = status
        self.status_code = status
        self.code = code
        self.field = field
        super().__init__(code)


def error_response(status: int, code: str, field: str | None = None) -> JSONResponse:
    error = {"code": code}
    if field:
        error["field"] = field
    return JSONResponse({"error": error}, status_code=status)


async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    return error_response(exc.status, exc.code, exc.field)


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    locations = errors[0].get("loc", ()) if errors else ()
    path = [part for part in locations if part not in {"body", "query", "path", "header"}]
    field = ".".join(str(part) for part in path) if path and isinstance(path[0], str) else None
    return error_response(422, "VALIDATION_ERROR", field)


async def http_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
    code = {
        400: "VALIDATION_ERROR",
        401: "NOT_AUTHENTICATED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        413: "FILE_TOO_LARGE",
        422: "VALIDATION_ERROR",
    }.get(exc.status_code, "VALIDATION_ERROR")
    response = error_response(exc.status_code, code)
    if exc.headers:
        response.headers.update(exc.headers)
    return response


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_error_handler)
