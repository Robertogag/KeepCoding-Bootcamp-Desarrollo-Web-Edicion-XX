from copy import deepcopy

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic.json_schema import models_json_schema

from app.schemas.responses import (
    AlertRuleResponse,
    AuthResponse,
    AvailabilityResponse,
    ConnectionResponse,
    DowntimeReasonResponse,
    ErrorResponse,
    HealthResponse,
    MachineEventResponse,
    MachineResponse,
    MemberResponse,
    NotificationMessage,
    NotificationResponse,
    OeeSeries,
    Page,
    PingMessage,
    PlantResponse,
    PlantSummary,
    PublicMachineDetail,
    PublicPlant,
    PublicPlantListItem,
    RefreshResponse,
    ShiftResponse,
    SnapshotMessage,
    SubscriptionMessage,
    UserResponse,
    WatchlistItem,
)

SUCCESS_MODELS = {
    "/auth/register": {"post": AuthResponse},
    "/auth/login": {"post": AuthResponse},
    "/auth/refresh": {"post": RefreshResponse},
    "/auth/availability": {"get": AvailabilityResponse},
    "/me": {"get": UserResponse, "patch": UserResponse},
    "/public/plants": {"get": Page[PublicPlantListItem]},
    "/public/plants/{plant_slug}": {"get": PublicPlant},
    "/public/plants/{plant_slug}/machines/{machine_slug}": {"get": PublicMachineDetail},
    "/plants": {"get": Page[PlantResponse], "post": PlantResponse},
    "/plants/{plant_id}": {"get": PlantResponse, "patch": PlantResponse},
    "/plants/{plant_id}/members": {"get": Page[MemberResponse], "post": MemberResponse},
    "/plants/{plant_id}/members/{user_id}": {"patch": MemberResponse},
    "/plants/{plant_id}/machines": {"get": Page[MachineResponse], "post": MachineResponse},
    "/plants/{plant_id}/machines/test-connection": {"post": ConnectionResponse},
    "/machines/{machine_id}": {"get": MachineResponse, "patch": MachineResponse},
    "/machines/{machine_id}/test-connection": {"post": ConnectionResponse},
    "/machines/{machine_id}/photo": {"post": MachineResponse},
    "/plants/{plant_id}/shifts": {"get": Page[ShiftResponse], "post": ShiftResponse},
    "/shifts/{shift_id}": {"patch": ShiftResponse},
    "/machines/{machine_id}/oee": {"get": OeeSeries},
    "/plants/{plant_id}/oee/summary": {"get": PlantSummary},
    "/machines/{machine_id}/events": {"get": Page[MachineEventResponse]},
    "/events/{event_id}": {"patch": MachineEventResponse},
    "/downtime-reasons": {"get": Page[DowntimeReasonResponse]},
    "/plants/{plant_id}/alert-rules": {"get": Page[AlertRuleResponse], "post": AlertRuleResponse},
    "/alert-rules/{rule_id}": {"patch": AlertRuleResponse},
    "/notifications": {"get": Page[NotificationResponse]},
    "/watchlist": {"get": Page[WatchlistItem]},
    "/health": {"get": HealthResponse},
}

ERRORS = {
    400: ("INVALID_TOKEN o WRONG_PASSWORD según la operación.", "INVALID_TOKEN"),
    401: ("Credenciales ausentes, inválidas o vencidas.", "NOT_AUTHENTICATED"),
    403: ("El miembro no tiene el rol requerido o es el último owner.", "FORBIDDEN"),
    404: ("Recurso inexistente o no accesible para el solicitante.", "NOT_FOUND"),
    409: ("USERNAME_TAKEN, EMAIL_TAKEN o SLUG_TAKEN.", "SLUG_TAKEN"),
    413: ("La imagen supera 5 MB.", "FILE_TOO_LARGE"),
    415: ("El archivo no es una imagen JPEG, PNG o WebP válida.", "UNSUPPORTED_FILE"),
    422: (
        "Entrada inválida; field identifica el primer campo cuando corresponde.",
        "VALIDATION_ERROR",
    ),
    502: ("No se pudo consultar el dispositivo Modbus.", "MODBUS_UNREACHABLE"),
}


def error_statuses(path, method, operation):
    statuses = {422} if "422" in operation["responses"] else set()
    if "409" in operation["responses"]:
        statuses.add(409)
    protected = bool(operation.get("security"))
    if protected or path in {"/auth/login", "/auth/refresh"}:
        statuses.add(401)
    if "{" in path and path != "/media/machines/{filename}":
        statuses.add(404)
    if (
        protected
        and method in {"post", "patch", "put", "delete"}
        and (
            "injection" in operation.get("tags", [])
            or path.startswith(("/plants", "/machines", "/shifts", "/events", "/alert-rules"))
        )
    ):
        statuses.add(403)
    if method == "post" and path in {"/auth/register", "/plants", "/plants/{plant_id}/machines"}:
        statuses.add(409)
    if path == "/me" and method == "patch":
        statuses.add(409)
    if path in {"/auth/password/reset", "/me/password", "/watchlist/unfollow"} or (
        path == "/me" and method == "delete"
    ):
        statuses.add(400)
    if path.endswith("/test-connection"):
        statuses.add(502)
    if path == "/machines/{machine_id}/photo":
        statuses.update({413, 415})
    if path == "/media/machines/{filename}":
        statuses.add(404)
    return statuses


def json_response(model_ref, description="Respuesta correcta."):
    return {"description": description, "content": {"application/json": {"schema": model_ref}}}


def document_transports(path, method, operation, refs):
    responses = operation["responses"]
    if path == "/watchlist/unfollow":
        responses.pop("200", None)
        responses["303"] = {
            "description": "Seguimiento eliminado; redirección al frontend según idioma.",
            "headers": {"Location": {"schema": {"type": "string", "format": "uri"}}},
        }
    elif path.endswith("/reports/oee.csv"):
        responses["200"] = {
            "description": "CSV UTF-8 con BOM, separador coma y métricas entre 0 y 1.",
            "content": {"text/csv": {"schema": {"type": "string"}}},
            "headers": {"Content-Disposition": {"schema": {"type": "string"}}},
        }
    elif path == "/media/machines/{filename}":
        responses["200"] = {
            "description": "Foto WebP; las plantas privadas requieren enlace firmado o Bearer.",
            "content": {"image/webp": {"schema": {"type": "string", "format": "binary"}}},
        }
    elif path == "/health":
        responses["503"] = json_response(
            refs[(HealthResponse, "serialization")], "Dependencia no disponible."
        )
    if method == "post" and path in {
        "/auth/register",
        "/auth/login",
        "/auth/refresh",
        "/auth/logout",
    }:
        for code, response in responses.items():
            if code.startswith("2"):
                response.setdefault("headers", {})["Set-Cookie"] = {
                    "description": (
                        "refresh_token; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; "
                        "Max-Age=1209600. Rotación en refresh y expiración en logout; sin Domain."
                    ),
                    "schema": {"type": "string"},
                }
    if path == "/auth/refresh":
        operation["security"] = [{"RefreshCookie": []}]


def install_openapi(app: FastAPI) -> None:
    def documented_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            openapi_version=app.openapi_version,
            description=(
                "API REST de OEE Live. Fechas ISO 8601 en UTC; ventanas [from, to). "
                "Los listados usan paginación; series OEE/telemetría, tablero y distribución "
                "usan respuestas compuestas acotadas. Los porcentajes son fracciones "
                "entre 0 y 1 y los denominadores cero producen null."
            ),
            routes=app.routes,
        )
        models = {model for methods in SUCCESS_MODELS.values() for model in methods.values()}
        models.update(
            {ErrorResponse, SnapshotMessage, NotificationMessage, PingMessage, SubscriptionMessage}
        )
        refs, definitions = models_json_schema(
            [
                (model, "serialization")
                for model in sorted(models, key=lambda model: model.__name__)
            ],
            ref_template="#/components/schemas/{model}",
        )
        schemas = schema.setdefault("components", {}).setdefault("schemas", {})
        schemas.update(definitions["$defs"])
        schemas.pop("HTTPValidationError", None)
        schemas.pop("ValidationError", None)
        security = schema["components"].setdefault("securitySchemes", {})
        security["RefreshCookie"] = {
            "type": "apiKey",
            "in": "cookie",
            "name": "refresh_token",
            "description": "HttpOnly; Secure; 14 días; Path=/api/v1/auth; SameSite=Lax.",
        }
        if "HTTPBearer" in security:
            security["HTTPBearer"]["bearerFormat"] = "JWT"
            security["HTTPBearer"]["description"] = "Access token de 15 minutos devuelto por auth."
        for full_path, methods in schema["paths"].items():
            path = full_path.removeprefix("/api/v1")
            for method, operation in methods.items():
                for status in error_statuses(path, method, operation):
                    description, code = ERRORS[status]
                    if status == 409 and "injection" in operation.get("tags", []):
                        description, code = (
                            "Conflicto de recurso o estado de produccion.",
                            "RESOURCE_CONFLICT",
                        )
                    response = json_response(
                        deepcopy(refs[(ErrorResponse, "serialization")]), description
                    )
                    response["content"]["application/json"]["example"] = {"error": {"code": code}}
                    if path == "/auth/login" and status == 401:
                        response["content"]["application/json"]["example"]["error"]["code"] = (
                            "INVALID_CREDENTIALS"
                        )
                    if path == "/auth/refresh" and status == 401:
                        response["content"]["application/json"]["example"]["error"]["code"] = (
                            "INVALID_TOKEN"
                        )
                    operation["responses"][str(status)] = response
                model = SUCCESS_MODELS.get(path, {}).get(method)
                if model is not None:
                    status = next(code for code in operation["responses"] if code.startswith("2"))
                    operation["responses"][status] = json_response(refs[(model, "serialization")])
                document_transports(path, method, operation, refs)
        schema["x-websockets"] = {
            "/ws": {
                "authentication": "JWT en query token; cierre 4401 al vencer o invalidarse.",
                "receive": refs[(SubscriptionMessage, "serialization")],
                "send": {
                    "oneOf": [
                        refs[(model, "serialization")]
                        for model in (SnapshotMessage, NotificationMessage, PingMessage)
                    ]
                },
                "ping_interval_s": 25,
                "close_codes": {
                    "4400": "Mensaje inválido.",
                    "4401": "NOT_AUTHENTICATED",
                    "4403": "FORBIDDEN",
                    "1013": "Servicio temporalmente no disponible: Redis o colector.",
                },
            },
            "/ws/public/{plant_slug}": {
                "authentication": "Acceso público mientras la planta siga siendo pública.",
                "send": refs[(SnapshotMessage, "serialization")],
                "close_codes": {
                    "4404": "NOT_FOUND",
                    "1013": "Servicio temporalmente no disponible: Redis o colector.",
                },
            },
        }
        app.openapi_schema = schema
        return schema

    app.openapi = documented_openapi
