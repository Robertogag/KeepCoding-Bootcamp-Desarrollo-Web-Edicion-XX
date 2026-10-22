import httpx
import pytest

from app.main import app
from app.schemas.responses import ErrorResponse


@pytest.fixture(scope="module")
def schema():
    return app.openapi()


def resolve(schema, value):
    while "$ref" in value:
        path = value["$ref"].removeprefix("#/").split("/")
        value = schema
        for part in path:
            value = value[part]
    return value


def test_all_success_payloads_have_schemas(schema):
    for path, methods in schema["paths"].items():
        for method, operation in methods.items():
            for code, response in operation["responses"].items():
                if code.startswith("2") and code != "204":
                    assert response.get("content"), (path, method, code)
                    for payload in response["content"].values():
                        assert payload.get("schema"), (path, method, code)
                        assert resolve(schema, payload["schema"]).get("type")
                if code == "204":
                    assert "content" not in response, (path, method)


def test_all_schema_references_resolve(schema):
    def visit(node):
        if isinstance(node, dict):
            if "$ref" in node:
                assert resolve(schema, node)
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    visit(schema)


def test_pagination_and_oee_array_remain_distinct(schema):
    response = schema["paths"]["/api/v1/plants/{plant_id}/machines"]["get"]["responses"]["200"]
    page = resolve(schema, response["content"]["application/json"]["schema"])
    assert set(page["required"]) == {"items", "page", "page_size", "total", "has_next", "has_prev"}
    response = schema["paths"]["/api/v1/machines/{machine_id}/oee"]["get"]["responses"]["200"]
    series = resolve(schema, response["content"]["application/json"]["schema"])
    assert series["type"] == "array"
    assert resolve(schema, series["items"])["required"]
    assert schema["components"]["schemas"]["OeeMetrics"]["properties"]["oee"]["anyOf"] == [
        {"maximum": 1, "minimum": 0, "type": "number"},
        {"type": "null"},
    ]


def test_public_dtos_do_not_expose_private_fields(schema):
    forbidden = {"host", "port", "unit_id", "members", "comment", "is_watched", "photo_key"}
    for name in (
        "PublicPlant",
        "PublicPlantListItem",
        "PublicMachine",
        "PublicMachineDetail",
        "Snapshot",
    ):
        assert not forbidden.intersection(schema["components"]["schemas"][name]["properties"])
    assert set(schema["components"]["schemas"]["NotificationResponse"]["properties"]) == {
        "id",
        "type",
        "created_at",
        "read_at",
        "payload",
    }


def test_error_envelopes_replace_fastapi_validation_details(schema):
    assert "HTTPValidationError" not in schema["components"]["schemas"]
    assert "ValidationError" not in schema["components"]["schemas"]
    for methods in schema["paths"].values():
        for operation in methods.values():
            for code, response in operation["responses"].items():
                if code.startswith("4") or code == "502":
                    body = resolve(schema, response["content"]["application/json"]["schema"])
                    assert set(body["properties"]) == {"error"}
                    ErrorResponse.model_validate(response["content"]["application/json"]["example"])
    detail = schema["components"]["schemas"]["ErrorDetail"]
    assert detail["required"] == ["code"]
    assert detail["properties"]["field"]["type"] == "string"


def test_download_redirect_and_cookie_documentation(schema):
    csv = schema["paths"]["/api/v1/plants/{plant_id}/reports/oee.csv"]["get"]["responses"]["200"]
    assert set(csv["content"]) == {"text/csv"}
    assert "Content-Disposition" in csv["headers"]
    media = schema["paths"]["/api/v1/media/machines/{filename}"]["get"]["responses"]["200"]
    assert set(media["content"]) == {"image/webp"}
    unfollow = schema["paths"]["/api/v1/watchlist/unfollow"]["get"]["responses"]
    assert "200" not in unfollow
    assert "Location" in unfollow["303"]["headers"]
    assert "content" not in unfollow["303"]
    refresh = schema["paths"]["/api/v1/auth/refresh"]["post"]
    assert refresh["security"] == [{"RefreshCookie": []}]
    cookie = refresh["responses"]["200"]["headers"]["Set-Cookie"]["description"]
    assert all(
        flag in cookie for flag in ("HttpOnly", "Secure", "SameSite=Lax", "Path=/api/v1/auth")
    )


def test_websocket_payloads_use_same_snapshot_schema(schema):
    realtime = schema["x-websockets"]
    public_message = resolve(schema, realtime["/ws/public/{plant_slug}"]["send"])
    assert public_message["properties"]["snapshot"] == {"$ref": "#/components/schemas/Snapshot"}
    assert realtime["/ws"]["ping_interval_s"] == 25
    assert realtime["/ws"]["close_codes"]["4403"] == "FORBIDDEN"
    assert "1013" in realtime["/ws"]["close_codes"]
    assert "1013" in realtime["/ws/public/{plant_slug}"]["close_codes"]


def test_board_layout_and_chart_contracts_are_private_and_typed(schema):
    operations = (
        ("/api/v1/plants/{plant_id}/board", "get"),
        ("/api/v1/plants/{plant_id}/layout", "get"),
        ("/api/v1/plants/{plant_id}/layout", "put"),
        ("/api/v1/machines/{machine_id}/telemetry/series", "get"),
    )
    for path, method in operations:
        operation = schema["paths"][path][method]
        assert operation["security"]
        assert {"401", "404"}.issubset(operation["responses"])
        body = resolve(
            schema, operation["responses"]["200"]["content"]["application/json"]["schema"]
        )
        assert body["type"] == "object"
    layout = schema["paths"]["/api/v1/plants/{plant_id}/layout"]["put"]
    assert "403" in layout["responses"]
    chart = schema["paths"]["/api/v1/machines/{machine_id}/telemetry/series"]["get"]
    parameters = {row["name"]: row for row in chart["parameters"]}
    assert all(parameters[name]["required"] for name in ("from", "to", "codes"))
    assert parameters["codes"]["schema"]["type"] == "array"
    assert parameters["codes"]["schema"]["maxItems"] == 12
    bucket = schema["components"]["schemas"]["TelemetryBucket"]
    assert {"type": "null"} in bucket["properties"]["avg"]["anyOf"]
    machine = schema["components"]["schemas"]["BoardMachine"]
    assert machine["properties"]["snapshot"] == {"$ref": "#/components/schemas/Snapshot"}


async def test_openapi_endpoint_and_real_validation_agree():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        docs = await client.get("/api/v1/openapi.json")
        assert docs.status_code == 200
        assert docs.json()["components"]["schemas"]["ErrorResponse"]["required"] == ["error"]
        response = await client.post("/api/v1/auth/register", json={})
        assert response.status_code == 422
        error = ErrorResponse.model_validate(response.json())
        assert error.error["code"] == "VALIDATION_ERROR"
        assert error.error["field"] == "username"
