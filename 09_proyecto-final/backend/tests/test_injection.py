from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.collector.state import MachineRuntime
from app.collector.storage import persist_runtimes
from app.models import (
    DowntimeReason,
    LineDowntime,
    LineDowntimeMachine,
    MachineTelemetry,
    Mold,
    PlantMember,
    ProductionOrder,
    ProductionRun,
    ResinLot,
)
from app.services.modbus import Registers
from app.services.telemetry import base_measurements, decode_variable, measurement


@pytest.fixture
async def injection(client, register, auth_headers):
    owner = await register()
    headers = auth_headers(owner)

    async def post(path, body=None, expected=201):
        response = await client.post("/api/v1" + path, json=body, headers=headers)
        assert response.status_code == expected, response.text
        return response.json()

    plant = await post("/plants", {"name": "Inyeccion", "timezone": "America/Mexico_City"})
    prefix = f"/plants/{plant['id']}"
    product = await post(
        prefix + "/products", {"code": "PART-01", "name": "Tapa", "part_weight_g": "12.5"}
    )
    mold = await post(
        prefix + "/molds", {"code": "M-01", "name": "Molde tapa", "nominal_cavities": 4}
    )
    resin = await post(
        prefix + "/resins",
        {"code": "PP-01", "name": "Polipropileno", "polymer": "PP", "grade": "G1"},
    )
    recipe = await post(
        prefix + "/injection-recipes",
        {
            "code": "R-01",
            "name": "Tapa PP",
            "product_id": product["id"],
            "mold_id": mold["id"],
            "resin_id": resin["id"],
            "ideal_cycle_s": "20",
            "active_cavities": 4,
        },
    )
    order = await post(
        prefix + "/production-orders",
        {"code": "OP-01", "recipe_id": recipe["id"], "target_pieces": 1000},
    )
    machine = await post(
        prefix + "/machines",
        {
            "name": "Inyectora 01",
            "host": "127.0.0.1",
            "port": 5020,
            "unit_id": 1,
            "ideal_cycle_s": 20,
        },
    )
    return dict(
        post=post,
        prefix=prefix,
        plant=plant,
        product=product,
        mold=mold,
        resin=resin,
        recipe=recipe,
        order=order,
        machine=machine,
        headers=headers,
        owner=owner,
    )


async def test_cavities_are_validated_and_context_is_frozen(client, injection, db_session):
    data = injection
    response = await client.post(
        f"/api/v1/machines/{data['machine']['id']}/production-runs",
        json={"order_id": data["order"]["id"], "active_cavities": 5},
        headers=data["headers"],
    )
    assert response.status_code == 422
    run = await data["post"](
        f"/machines/{data['machine']['id']}/production-runs",
        {"order_id": data["order"]["id"], "active_cavities": 3},
    )
    assert run["active_cavities"] == 3 and run["nominal_cavities"] == 4
    mold = await db_session.get(Mold, data["mold"]["id"])
    mold.nominal_cavities = 8
    await db_session.commit()
    response = await client.get(
        f"/api/v1/production-runs/{run['id']}/traceability", headers=data["headers"]
    )
    assert response.json()["run"]["nominal_cavities"] == 4
    assert response.json()["ideal_seconds_per_piece"] == pytest.approx(20 / 3)


async def test_only_one_open_run_per_machine_and_mold(client, injection):
    data = injection
    path = f"/machines/{data['machine']['id']}/production-runs"
    run = await data["post"](path, {"order_id": data["order"]["id"]})
    response = await client.post(
        "/api/v1" + path, json={"order_id": data["order"]["id"]}, headers=data["headers"]
    )
    assert response.status_code == 409
    machine2 = await data["post"](
        data["prefix"] + "/machines",
        {
            "name": "Inyectora 02",
            "host": "127.0.0.1",
            "port": 5020,
            "unit_id": 2,
            "ideal_cycle_s": 20,
        },
    )
    response = await client.post(
        f"/api/v1/machines/{machine2['id']}/production-runs",
        json={"order_id": data["order"]["id"]},
        headers=data["headers"],
    )
    assert response.status_code == 409
    await data["post"](f"/production-runs/{run['id']}/end", expected=200)
    run2 = await data["post"](path, {"order_id": data["order"]["id"]})
    assert run2["id"] != run["id"]


async def test_catalogs_cannot_mix_plants_or_viewers_write(
    client, injection, register, auth_headers, db_session
):
    data = injection
    second = await data["post"]("/plants", {"name": "Otra planta", "timezone": "UTC"})
    body = {
        "code": "X",
        "name": "Cruce",
        "product_id": data["product"]["id"],
        "mold_id": data["mold"]["id"],
        "resin_id": data["resin"]["id"],
        "ideal_cycle_s": "20",
        "active_cavities": 4,
    }
    response = await client.post(
        f"/api/v1/plants/{second['id']}/injection-recipes", json=body, headers=data["headers"]
    )
    assert response.status_code == 422
    viewer = await register("viewer")
    db_session.add(
        PlantMember(plant_id=data["plant"]["id"], user_id=viewer["user"]["id"], role="viewer")
    )
    await db_session.commit()
    response = await client.post(
        "/api/v1" + data["prefix"] + "/molds",
        json={"code": "X", "name": "X", "nominal_cavities": 2},
        headers=auth_headers(viewer),
    )
    assert response.status_code == 403
    outsider = await register("outsider")
    response = await client.get(
        "/api/v1" + data["prefix"] + "/products", headers=auth_headers(outsider)
    )
    assert response.status_code == 404


async def test_resin_lots_enforce_material_and_quantity_and_people_end_with_run(client, injection):
    data = injection
    run = await data["post"](
        f"/machines/{data['machine']['id']}/production-runs", {"order_id": data["order"]["id"]}
    )
    lot = await data["post"](
        data["prefix"] + "/resin-lots",
        {"resin_id": data["resin"]["id"], "lot_code": "LOT-01", "received_kg": "25"},
    )
    await data["post"](
        f"/production-runs/{run['id']}/materials", {"resin_lot_id": lot["id"], "consumed_kg": "20"}
    )
    response = await client.post(
        f"/api/v1/production-runs/{run['id']}/materials",
        json={"resin_lot_id": lot["id"], "consumed_kg": "6"},
        headers=data["headers"],
    )
    assert response.status_code == 409
    employee = await data["post"](
        data["prefix"] + "/employees", {"code": "E-01", "name": "Operador Uno"}
    )
    assignment = await data["post"](
        f"/production-runs/{run['id']}/employees", {"employee_id": employee["id"]}
    )
    assert assignment["ended_at"] is None
    await data["post"](f"/production-runs/{run['id']}/end", expected=200)
    response = await client.get(
        f"/api/v1/production-runs/{run['id']}/traceability", headers=data["headers"]
    )
    assert len(response.json()["materials"]) == 1
    assert response.json()["employees"][0]["ended_at"] is not None


async def test_line_stoppages_are_classified_and_not_communication_failures(
    client, injection, db_session
):
    data = injection
    db_session.add(
        DowntimeReason(
            code="material",
            label_es="Falta de material",
            label_en="No material",
            category="material",
        )
    )
    await db_session.commit()
    line = await data["post"](
        data["prefix"] + "/production-lines", {"code": "L-01", "name": "Linea 1"}
    )
    response = await client.put(
        f"/api/v1/machines/{data['machine']['id']}/line",
        json={"line_id": line["id"]},
        headers=data["headers"],
    )
    assert response.status_code == 200
    down = await data["post"](
        f"/production-lines/{line['id']}/downtimes",
        {"reason_code": "material", "planned": False, "comment": "Sin resina"},
    )
    response = await client.post(
        f"/api/v1/production-lines/{line['id']}/downtimes",
        json={"reason_code": "material"},
        headers=data["headers"],
    )
    assert response.status_code == 409
    closed = await data["post"](f"/line-downtimes/{down['id']}/end", expected=200)
    assert closed["ended_at"] is not None and closed["created_by"] == data["owner"]["user"]["id"]


@pytest.mark.parametrize(
    ("dtype", "words", "value"),
    [
        ("uint16", [123], 123),
        ("int16", [65535], -1),
        ("uint32", [1, 0], 65536),
        ("int32", [65535, 65535], -1),
        ("float32", [0x41A0, 0], 20),
    ],
)
def test_decode_process_variables_with_scaling(dtype, words, value):
    mapping = {
        "data_type": dtype,
        "word_order": "big",
        "byte_order": "big",
        "scale": 0.1,
        "offset": 2,
    }
    assert decode_variable(words, mapping) == pytest.approx(value * 0.1 + 2)


def test_telemetry_quality_and_endianness_never_invent_zero():
    mapping = {
        "code": "pressure",
        "unit": "bar",
        "data_type": "float32",
        "word_order": "little",
        "byte_order": "big",
        "scale": 1,
        "offset": 0,
    }
    assert decode_variable([0, 0x41A0], mapping) == 20
    assert measurement(mapping)["value"] is None
    assert measurement(mapping, [0, 0x7FC0])["quality"] == "bad"
    assert base_measurements(None)["good_count"]["value"] is None
    assert base_measurements(Registers(1, 0, 0, 0, 0, 1, 200))["cycle_time_s"]["value"] is None
    assert (
        base_measurements(Registers(1, 0, 0, 0, 200, 1, 200), stale=True)["cycle_time_s"]["quality"]
        == "stale"
    )


async def test_telemetry_is_atomic_and_keeps_run_at_acquisition_time(injection, db_session):
    data = injection
    run = await data["post"](
        f"/machines/{data['machine']['id']}/production-runs", {"order_id": data["order"]["id"]}
    )
    stored_run = await db_session.get(ProductionRun, run["id"])
    now = stored_run.started_at + timedelta(seconds=1)
    runtime = MachineRuntime(data["machine"]["id"])
    runtime.observe(Registers(1, 0, 0, 0, 200, 1, 200), now)
    runtime.telemetry.append(
        {
            "machine_id": runtime.machine_id,
            "sampled_at": now,
            "source": "modbus",
            "values": base_measurements(Registers(1, 0, 0, 0, 200, 1, 200)),
        }
    )
    await persist_runtimes(db_session, [runtime])
    await db_session.rollback()
    assert list(await db_session.scalars(select(MachineTelemetry))) == []
    # The buffer is only cleared by the caller after commit.
    assert len(runtime.telemetry) == 1
    await persist_runtimes(db_session, [runtime])
    await db_session.commit()
    frame = await db_session.get(MachineTelemetry, (runtime.machine_id, now))
    assert frame.run_id == run["id"] and frame.values["cycle_time_s"]["value"] == 20
    runtime.persisted()
    assert runtime.telemetry == []


async def test_variable_mapping_and_reserved_core_codes(client, injection):
    data = injection
    path = f"/api/v1/machines/{data['machine']['id']}/variables/filling_time_s"
    body = {
        "code": "filling_time_s",
        "name": "Tiempo de llenado",
        "unit": "s",
        "address": 100,
        "data_type": "uint16",
        "scale": 0.01,
    }
    response = await client.put(path, json=body, headers=data["headers"])
    assert response.status_code == 200, response.text
    assert response.json()["scale"] == 0.01
    response = await client.put(path, json={**body, "scale": 0}, headers=data["headers"])
    assert response.status_code == 422
    response = await client.put(
        path.replace("filling_time_s", "cycle_time_s"),
        json={**body, "code": "cycle_time_s"},
        headers=data["headers"],
    )
    assert response.status_code == 422


async def test_order_lifecycle_and_employee_assignment_end(client, injection):
    data = injection
    order_path = f"/api/v1/production-orders/{data['order']['id']}"
    context_path = f"/api/v1/machines/{data['machine']['id']}/production-context"
    response = await client.get(context_path, headers=data["headers"])
    assert response.json() == {"run": None, "ideal_seconds_per_piece": None}
    run = await data["post"](
        f"/machines/{data['machine']['id']}/production-runs",
        {"order_id": data["order"]["id"]},
    )
    response = await client.get(context_path, headers=data["headers"])
    assert response.json()["run"]["id"] == run["id"]
    assert response.json()["ideal_seconds_per_piece"] == 5
    for status in ("planned", "completed", "cancelled"):
        response = await client.patch(order_path, json={"status": status}, headers=data["headers"])
        assert response.status_code == 409
    employee = await data["post"](
        data["prefix"] + "/employees", {"code": "E-01", "name": "Operator"}
    )
    assignment = await data["post"](
        f"/production-runs/{run['id']}/employees", {"employee_id": employee["id"]}
    )
    end_path = f"/production-runs/{run['id']}/employees/{assignment['id']}/end"
    ended = await data["post"](end_path, expected=200)
    assert ended["ended_at"] is not None
    assert (await data["post"](end_path, expected=200))["ended_at"] == ended["ended_at"]
    reassigned = await data["post"](
        f"/production-runs/{run['id']}/employees", {"employee_id": employee["id"]}
    )
    assert reassigned["id"] != assignment["id"]
    ended_run = await data["post"](f"/production-runs/{run['id']}/end", expected=200)
    assert (await data["post"](f"/production-runs/{run['id']}/end", expected=200))[
        "ended_at"
    ] == ended_run["ended_at"]
    orders = await client.get(
        "/api/v1" + data["prefix"] + "/injection/production-orders", headers=data["headers"]
    )
    assert orders.json()["items"][0]["status"] == "planned"
    assert (await client.get(context_path, headers=data["headers"])).json()["run"] is None
    for status in ("completed", "completed"):
        response = await client.patch(order_path, json={"status": status}, headers=data["headers"])
        assert response.status_code == 200 and response.json()["status"] == status
    response = await client.post(
        f"/api/v1/machines/{data['machine']['id']}/production-runs",
        json={"order_id": data["order"]["id"]},
        headers=data["headers"],
    )
    assert response.status_code == 409
    response = await client.patch(order_path, json={"status": "cancelled"}, headers=data["headers"])
    assert response.status_code == 409
    for status in ("planned", "cancelled", "planned"):
        response = await client.patch(order_path, json={"status": status}, headers=data["headers"])
        assert response.status_code == 200


async def test_line_stop_freezes_active_machines_and_blocks_moves(client, injection, db_session):
    data = injection
    db_session.add(
        DowntimeReason(
            code="material", label_es="Material", label_en="Material", category="material"
        )
    )
    await db_session.commit()
    line = await data["post"](data["prefix"] + "/production-lines", {"code": "L1", "name": "One"})
    other = await data["post"](data["prefix"] + "/production-lines", {"code": "L2", "name": "Two"})
    assigned_ids = [data["machine"]["id"]]
    for number in (2, 3):
        machine = await data["post"](
            data["prefix"] + "/machines",
            {
                "name": f"Machine {number}",
                "host": "127.0.0.1",
                "port": 5020,
                "unit_id": number,
                "ideal_cycle_s": 20,
            },
        )
        assigned_ids.append(machine["id"])
    for machine_id in assigned_ids:
        response = await client.put(
            f"/api/v1/machines/{machine_id}/line",
            json={"line_id": line["id"]},
            headers=data["headers"],
        )
        assert response.status_code == 200
    response = await client.patch(
        f"/api/v1/machines/{assigned_ids[-1]}", json={"is_active": False}, headers=data["headers"]
    )
    assert response.status_code == 200
    down = await data["post"](
        f"/production-lines/{line['id']}/downtimes", {"reason_code": "material"}
    )
    assert down["affected_machine_ids"] == assigned_ids[:2]
    for destination in (None, other["id"]):
        response = await client.put(
            f"/api/v1/machines/{assigned_ids[0]}/line",
            json={"line_id": destination},
            headers=data["headers"],
        )
        assert response.status_code == 409
    # A machine excluded because inactive may leave, but cannot join an open stop.
    inactive_path = f"/api/v1/machines/{assigned_ids[-1]}/line"
    response = await client.put(
        inactive_path, json={"line_id": other["id"]}, headers=data["headers"]
    )
    assert response.status_code == 200
    response = await client.put(
        inactive_path, json={"line_id": line["id"]}, headers=data["headers"]
    )
    assert response.status_code == 409
    ended = await data["post"](f"/line-downtimes/{down['id']}/end", expected=200)
    assert ended["affected_machine_ids"] == assigned_ids[:2]
    assert (await data["post"](f"/line-downtimes/{down['id']}/end", expected=200))[
        "ended_at"
    ] == ended["ended_at"]
    response = await client.put(
        f"/api/v1/machines/{assigned_ids[0]}/line",
        json={"line_id": other["id"]},
        headers=data["headers"],
    )
    assert response.status_code == 200
    response = await client.get(
        "/api/v1" + data["prefix"] + "/injection/line-downtimes", headers=data["headers"]
    )
    assert response.json()["items"][0]["affected_machine_ids"] == assigned_ids[:2]


async def test_line_validation_and_run_line_context_are_frozen(client, injection, db_session):
    data = injection
    db_session.add(
        DowntimeReason(
            code="material", label_es="Material", label_en="Material", category="material"
        )
    )
    await db_session.commit()
    body = {"code": "L1", "name": "One"}
    line = await data["post"](data["prefix"] + "/production-lines", body)
    stop_path = f"/api/v1/production-lines/{line['id']}/downtimes"
    response = await client.post(
        stop_path, json={"reason_code": "material"}, headers=data["headers"]
    )
    assert response.status_code == 422
    line_path = "/api/v1" + data["prefix"] + f"/production-lines/{line['id']}"
    response = await client.put(
        line_path, json={**body, "is_active": False}, headers=data["headers"]
    )
    assert response.status_code == 200
    machine_path = f"/api/v1/machines/{data['machine']['id']}"
    response = await client.put(
        machine_path + "/line", json={"line_id": line["id"]}, headers=data["headers"]
    )
    assert response.status_code == 422
    response = await client.post(
        stop_path, json={"reason_code": "material"}, headers=data["headers"]
    )
    assert response.status_code == 422
    await client.put(line_path, json=body, headers=data["headers"])
    await client.put(machine_path + "/line", json={"line_id": line["id"]}, headers=data["headers"])
    run = await data["post"](
        f"/machines/{data['machine']['id']}/production-runs", {"order_id": data["order"]["id"]}
    )
    assert run["context"]["line_id"] == line["id"] and run["context"]["line_code"] == "L1"
    assert run["context"]["line_name"] == "One"
    assert run["context"]["mold_name"] == data["mold"]["name"]
    assert run["context"]["resin_name"] == data["resin"]["name"]
    await client.put(
        line_path, json={**body, "code": "L-RENAMED", "name": "Renamed"}, headers=data["headers"]
    )
    await client.put(machine_path + "/line", json={"line_id": None}, headers=data["headers"])
    response = await client.get(machine_path, headers=data["headers"])
    assert response.json()["line_id"] is None
    response = await client.get(
        f"/api/v1/production-runs/{run['id']}/traceability", headers=data["headers"]
    )
    assert response.json()["run"]["context"]["line_code"] == "L1"
    assert response.json()["run"]["context"]["line_name"] == "One"


async def test_new_injection_endpoints_enforce_permissions(
    client, injection, register, auth_headers, db_session
):
    data = injection
    viewer, outsider = await register("reader"), await register("unrelated")
    db_session.add(
        PlantMember(plant_id=data["plant"]["id"], user_id=viewer["user"]["id"], role="viewer")
    )
    await db_session.commit()
    run = await data["post"](
        f"/machines/{data['machine']['id']}/production-runs", {"order_id": data["order"]["id"]}
    )
    read_paths = [
        f"/machines/{data['machine']['id']}/production-context",
        f"/machines/{data['machine']['id']}/variables",
        f"/production-runs/{run['id']}/traceability",
        data["prefix"] + "/injection/production-runs",
    ]
    for path in read_paths:
        assert (await client.get("/api/v1" + path, headers=auth_headers(viewer))).status_code == 200
        assert (
            await client.get("/api/v1" + path, headers=auth_headers(outsider))
        ).status_code == 404
    for actor, status in ((viewer, 403), (outsider, 404)):
        headers = auth_headers(actor)
        response = await client.patch(
            f"/api/v1/production-orders/{data['order']['id']}",
            json={"status": "completed"},
            headers=headers,
        )
        assert response.status_code == status
        response = await client.post(
            f"/api/v1/production-runs/{run['id']}/employees/999999/end", headers=headers
        )
        assert response.status_code == status
    response = await client.post(
        f"/api/v1/production-runs/{run['id']}/employees/999999/end", headers=data["headers"]
    )
    assert response.status_code == 404


async def test_variables_paginate_and_telemetry_has_typed_metadata(client, injection, db_session):
    data = injection
    path = f"/api/v1/machines/{data['machine']['id']}"
    for code in ("pressure", "filling_time_s"):
        response = await client.put(
            path + f"/variables/{code}",
            json={
                "code": code,
                "name": code,
                "unit": "bar",
                "address": 100,
                "data_type": "uint16",
                "map_version": "map-v2",
            },
            headers=data["headers"],
        )
        assert response.status_code == 200 and response.json()["map_version"] == "map-v2"
    response = await client.get(path + "/variables?page_size=1", headers=data["headers"])
    assert response.json()["total"] == 2 and response.json()["has_next"] is True
    assert response.json()["items"][0]["code"] == "filling_time_s"
    response = await client.get(path + "/variables?page_size=1&page=2", headers=data["headers"])
    assert response.json()["items"][0]["code"] == "pressure"
    assert response.json()["has_prev"] is True
    from datetime import UTC, datetime

    now = datetime.now(UTC)
    db_session.add(
        MachineTelemetry(
            machine_id=data["machine"]["id"],
            sampled_at=now,
            source="modbus",
            values=base_measurements(None),
        )
    )
    await db_session.commit()
    response = await client.get(
        path + "/telemetry",
        params={
            "from": (now - timedelta(seconds=1)).isoformat(),
            "to": (now + timedelta(seconds=1)).isoformat(),
        },
        headers=data["headers"],
    )
    assert response.status_code == 200, response.text
    value = response.json()["items"][0]["values"]["good_count"]
    assert value["value"] is None and value["map_version"] == "oee-base-v1"


@pytest.mark.parametrize(
    "schema,field,payload",
    [
        ("MoldCreate", "nominal_cavities", {"code": "M", "name": "M", "nominal_cavities": True}),
        ("RunStart", "order_id", {"order_id": True}),
        ("RunStart", "active_cavities", {"order_id": 1, "active_cavities": 1.0}),
        ("MachineLine", "line_id", {"line_id": "1"}),
        ("OrderCreate", "target_pieces", {"code": "O", "recipe_id": 1, "target_pieces": False}),
    ],
)
def test_integer_ids_and_cavities_are_strict(schema, field, payload):
    from pydantic import ValidationError

    from app.schemas import injection as schemas

    with pytest.raises(ValidationError) as error:
        getattr(schemas, schema).model_validate(payload)
    assert error.value.errors()[0]["loc"] == (field,)


def test_injection_openapi_documents_new_contract():
    from app.main import app

    schema = app.openapi()
    for path, method in (
        ("/production-orders/{order_id}", "patch"),
        ("/production-runs/{run_id}/employees/{assignment_id}/end", "post"),
        ("/machines/{machine_id}/production-context", "get"),
        ("/machines/{machine_id}/variables", "get"),
        ("/plants/{plant_id}/injection/line-downtimes", "get"),
    ):
        operation = schema["paths"]["/api/v1" + path][method]
        assert "$ref" in operation["responses"]["200"]["content"]["application/json"]["schema"]
        assert operation["responses"]["409"]["content"]["application/json"]["example"] == {
            "error": {"code": "RESOURCE_CONFLICT"}
        }
    assert "line_id" in schema["components"]["schemas"]["MachineResponse"]["properties"]
    for name in ("Snapshot", "PublicMachine", "PublicMachineDetail"):
        assert "line_id" not in schema["components"]["schemas"][name]["properties"]


async def test_lot_and_order_filters_precede_pagination(client, injection, db_session):
    data = injection
    start = datetime(2026, 1, 1, tzinfo=UTC)
    lots, orders = [], []
    for index in range(25):
        when = start + timedelta(hours=index)
        lots.append(
            ResinLot(
                plant_id=data["plant"]["id"],
                resin_id=data["resin"]["id"],
                lot_code=f"LOT-{index}",
                received_kg=20,
                received_at=when,
            )
        )
        orders.append(
            ProductionOrder(
                plant_id=data["plant"]["id"],
                recipe_id=data["recipe"]["id"],
                code=f"ORDER-{index}",
                target_pieces=20,
                status="completed" if index < 2 else "planned",
                created_at=when,
            )
        )
    db_session.add_all([*lots, *orders])
    await db_session.commit()
    prefix = "/api/v1" + data["prefix"] + "/injection/"
    # These oldest rows are not on the unfiltered first page. +01:00 is normalized to UTC.
    params = {"from": "2026-01-01T01:00:00+01:00", "to": "2026-01-01T02:00:00Z", "page_size": 1}
    for resource, extra, rows in (
        ("resin-lots", {"resin_id": data["resin"]["id"]}, lots),
        ("production-orders", {"status": "completed"}, orders),
    ):
        response = await client.get(
            prefix + resource, params={**params, **extra}, headers=data["headers"]
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["total"] == 2 and body["has_next"] is True
        assert body["items"][0]["id"] == rows[1].id
        response = await client.get(
            prefix + resource, params={**params, **extra, "page": 2}, headers=data["headers"]
        )
        assert response.json()["items"][0]["id"] == rows[0].id
        assert response.json()["has_prev"] is True
        response = await client.get(
            prefix + resource, params={"to": start.isoformat()}, headers=data["headers"]
        )
        assert response.json()["total"] == 0  # Exclusive upper bound.
    response = await client.get(
        prefix + "resin-lots", params={"resin_id": 999999}, headers=data["headers"]
    )
    assert response.json()["total"] == 0


async def test_run_filters_use_overlap_and_frozen_line(client, injection, db_session):
    data = injection
    line = await data["post"](
        data["prefix"] + "/production-lines", {"code": "HIST", "name": "Historical"}
    )
    machine_path = f"/api/v1/machines/{data['machine']['id']}"
    await client.put(machine_path + "/line", json={"line_id": line["id"]}, headers=data["headers"])
    initial = await data["post"](
        f"/machines/{data['machine']['id']}/production-runs", {"order_id": data["order"]["id"]}
    )
    await data["post"](f"/production-runs/{initial['id']}/end", expected=200)
    await client.put(machine_path + "/line", json={"line_id": None}, headers=data["headers"])
    start = datetime(2026, 1, 1, tzinfo=UTC)
    runs = []
    for index in range(25):
        context = dict(initial["context"])
        if index > 0:
            context.update(line_id=None, line_code=None, line_name=None)
        runs.append(
            ProductionRun(
                plant_id=data["plant"]["id"],
                order_id=data["order"]["id"],
                machine_id=data["machine"]["id"],
                mold_id=data["mold"]["id"],
                context=context,
                nominal_cavities=4,
                active_cavities=4,
                ideal_cycle_s=20,
                part_weight_g=12.5,
                started_at=start + timedelta(hours=index),
                ended_at=start + timedelta(hours=index + 1) if index < 24 else None,
            )
        )
    db_session.add_all(runs)
    await db_session.commit()
    path = "/api/v1" + data["prefix"] + "/injection/production-runs"
    response = await client.get(
        path,
        params={
            "machine_id": data["machine"]["id"],
            "line_id": line["id"],
            "order_id": data["order"]["id"],
            "open": "false",
            "from": "2026-01-01T00:30:00Z",
            "to": "2026-01-01T01:00:00Z",
            "page_size": 1,
        },
        headers=data["headers"],
    )
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == runs[0].id
    response = await client.get(
        path,
        params={"from": "2026-01-01T01:00:00Z", "to": "2026-01-01T02:00:00Z"},
        headers=data["headers"],
    )
    assert [row["id"] for row in response.json()["items"]] == [runs[1].id]
    response = await client.get(path, params={"open": "true"}, headers=data["headers"])
    assert response.json()["total"] == 1 and response.json()["items"][0]["id"] == runs[-1].id
    response = await client.get(path, params={"machine_id": 999999}, headers=data["headers"])
    assert response.json()["total"] == 0
    second = await data["post"]("/plants", {"name": "Empty scope", "timezone": "UTC"})
    response = await client.get(
        f"/api/v1/plants/{second['id']}/injection/production-runs",
        params={"machine_id": data["machine"]["id"]},
        headers=data["headers"],
    )
    assert response.json()["total"] == 0


async def test_downtime_filters_use_captured_membership_without_duplicates(
    client, injection, db_session
):
    data = injection
    db_session.add(
        DowntimeReason(
            code="material", label_es="Material", label_en="Material", category="material"
        )
    )
    await db_session.commit()
    line = await data["post"](data["prefix"] + "/production-lines", {"code": "L1", "name": "Line"})
    other = await data["post"](
        data["prefix"] + "/machines",
        {
            "name": "Other machine",
            "host": "127.0.0.1",
            "port": 5020,
            "unit_id": 2,
            "ideal_cycle_s": 20,
        },
    )
    start = datetime(2026, 1, 1, tzinfo=UTC)
    stops = []
    for index in range(25):
        stops.append(
            LineDowntime(
                plant_id=data["plant"]["id"],
                line_id=line["id"],
                reason_code="material",
                started_at=start + timedelta(hours=index),
                ended_at=start + timedelta(hours=index + 1) if index < 24 else None,
            )
        )
    db_session.add_all(stops)
    await db_session.flush()
    for index, stop in enumerate(stops):
        db_session.add(LineDowntimeMachine(downtime_id=stop.id, machine_id=other["id"]))
        if index == 0:
            db_session.add(
                LineDowntimeMachine(downtime_id=stop.id, machine_id=data["machine"]["id"])
            )
    await db_session.commit()
    path = "/api/v1" + data["prefix"] + "/injection/line-downtimes"
    response = await client.get(
        path,
        params={
            "machine_id": data["machine"]["id"],
            "line_id": line["id"],
            "open": "false",
            "page_size": 1,
        },
        headers=data["headers"],
    )
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1 and response.json()["items"][0]["id"] == stops[0].id
    # Current machine.line_id is None; matching still comes from the historical join.
    response = await client.get(
        path,
        params={
            "line_id": line["id"],
            "from": "2026-01-01T00:30:00Z",
            "to": "2026-01-01T01:00:00Z",
        },
        headers=data["headers"],
    )
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["affected_machine_ids"] == [
        data["machine"]["id"],
        other["id"],
    ]
    response = await client.get(
        path,
        params={"from": "2026-01-01T01:00:00Z", "to": "2026-01-01T02:00:00Z"},
        headers=data["headers"],
    )
    assert [row["id"] for row in response.json()["items"]] == [stops[1].id]
    response = await client.get(path, params={"open": "true"}, headers=data["headers"])
    assert response.json()["total"] == 1 and response.json()["items"][0]["id"] == stops[-1].id
    response = await client.get(path, headers=data["headers"])
    assert response.json()["total"] == 25  # Two captured machines never duplicate the oldest stop.


async def test_operation_filters_reject_unknown_inapplicable_and_invalid_values(client, injection):
    data = injection
    resources = ("resin-lots", "production-orders", "production-runs", "line-downtimes")
    cases = [
        ("resin-lots", {"machine_id": 1}, "machine_id"),
        ("production-orders", {"open": "true"}, "open"),
        ("production-runs", {"status": "running"}, "status"),
        ("line-downtimes", {"order_id": 1}, "order_id"),
        ("production-orders", {"status": "unknown"}, "status"),
        ("production-runs", {"open": "unknown"}, "open"),
        ("production-runs", {"machine_id": 0}, "machine_id"),
    ]
    for resource in resources:
        cases.extend(
            [
                (resource, {"unknown": "x"}, "unknown"),
                (resource, {"from": "2026-01-01T00:00:00"}, "from"),
                (resource, {"to": "2026-01-01T00:00:00"}, "to"),
                (resource, {"from": "2026-01-02T00:00:00Z", "to": "2026-01-01T00:00:00Z"}, "to"),
                (resource, {"from": "2026-01-01T00:00:00Z", "to": "2026-01-01T00:00:00Z"}, "to"),
            ]
        )
    for resource, params, field in cases:
        response = await client.get(
            "/api/v1" + data["prefix"] + "/injection/" + resource,
            params=params,
            headers=data["headers"],
        )
        assert response.status_code == 422, (resource, params, response.text)
        assert response.json() == {"error": {"code": "VALIDATION_ERROR", "field": field}}


def test_operation_filters_openapi_is_specific_to_each_resource():
    from app.main import app

    schema = app.openapi()
    base = {"plant_id", "page", "page_size", "from", "to"}
    for resource, fields in (
        ("resin-lots", {"resin_id"}),
        ("production-orders", {"status"}),
        ("production-runs", {"machine_id", "line_id", "order_id", "open"}),
        ("line-downtimes", {"machine_id", "line_id", "open"}),
    ):
        operation = schema["paths"]["/api/v1/plants/{plant_id}/injection/" + resource]["get"]
        assert {parameter["name"] for parameter in operation["parameters"]} == base | fields
