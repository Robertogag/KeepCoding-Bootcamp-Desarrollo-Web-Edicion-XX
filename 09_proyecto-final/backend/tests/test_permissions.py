import io

from PIL import Image


async def create_plant(client, headers, name="Private plant", public=False):
    result = await client.post(
        "/api/v1/plants",
        headers=headers,
        json={"name": name, "timezone": "America/Mexico_City", "is_public": public},
    )
    assert result.status_code == 201, result.text
    return result.json()


async def create_machine(client, headers, plant_id):
    result = await client.post(
        f"/api/v1/plants/{plant_id}/machines",
        headers=headers,
        json={
            "name": "Machine one",
            "brand": "Brand",
            "model": "M1",
            "host": "simulator",
            "port": 5020,
            "unit_id": 1,
            "ideal_cycle_s": 28.0,
            "is_active": True,
        },
    )
    assert result.status_code == 201, result.text
    return result.json()


async def test_private_resources_hidden_roles_and_last_owner(client, register, auth_headers):
    owner = await register()
    viewer = await register("viewer")
    outsider = await register("outsider")
    own = auth_headers(owner)
    plant = await create_plant(client, own)
    pid = plant["id"]
    assert (
        await client.get(f"/api/v1/plants/{pid}", headers=auth_headers(outsider))
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v1/plants/{pid}/members",
            headers=own,
            json={"username": "viewer", "role": "viewer"},
        )
    ).status_code == 201
    assert (
        await client.patch(
            f"/api/v1/plants/{pid}", headers=auth_headers(viewer), json={"name": "No access"}
        )
    ).status_code == 403
    assert (
        await client.delete(f"/api/v1/plants/{pid}/members/{owner['user']['id']}", headers=own)
    ).status_code == 403
    assert (
        await client.patch(
            f"/api/v1/plants/{pid}/members/{owner['user']['id']}",
            headers=own,
            json={"role": "viewer"},
        )
    ).status_code == 403
    assert (await client.get(f"/api/v1/public/plants/{plant['slug']}")).status_code == 404
    machine = await create_machine(client, own, pid)
    assert (
        await client.get(f"/api/v1/machines/{machine['id']}", headers=auth_headers(outsider))
    ).status_code == 404
    assert (
        await client.delete(f"/api/v1/machines/{machine['id']}", headers=auth_headers(viewer))
    ).status_code == 403


async def test_photos_private_signed_urls_public_sanitization_and_removal(
    client, register, auth_headers, tmp_path
):
    owner = await register()
    own = auth_headers(owner)
    plant = await create_plant(client, own)
    machine = await create_machine(client, own, plant["id"])
    image = io.BytesIO()
    Image.new("RGB", (1600, 800), "blue").save(image, format="PNG")
    response = await client.post(
        f"/api/v1/machines/{machine['id']}/photo",
        headers=own,
        files={"file": ("machine.png", image.getvalue(), "image/png")},
    )
    assert response.status_code == 200, response.text
    photo = response.json()["photo"]
    assert set(photo) == {"sm", "md", "lg"}
    for label, width in [("sm", 320), ("md", 768), ("lg", 1280)]:
        url = photo[label]
        assert (await client.get(url.split("?")[0])).status_code == 404
        downloaded = await client.get(url)
        assert downloaded.status_code == 200
        assert Image.open(io.BytesIO(downloaded.content)).size == (width, width // 2)
    await client.patch(f"/api/v1/plants/{plant['id']}", headers=own, json={"is_public": True})
    public = (
        await client.get(f"/api/v1/public/plants/{plant['slug']}/machines/{machine['slug']}")
    ).json()
    assert not {"host", "port", "unit_id", "is_watched", "photo_key", "comment"}.intersection(
        public
    )
    assert "token=" not in public["photo"]["sm"]
    assert (await client.get(public["photo"]["sm"])).status_code == 200
    await client.patch(f"/api/v1/plants/{plant['id']}", headers=own, json={"is_public": False})
    assert (await client.get(public["photo"]["sm"])).status_code == 404
    assert (
        await client.delete(f"/api/v1/machines/{machine['id']}", headers=own)
    ).status_code == 204
    assert (await client.get(photo["sm"])).status_code == 404
    assert not list((tmp_path / "uploads").rglob("*.webp"))


async def test_shift_validation_partial_updates_and_pagination(client, register, auth_headers):
    own = auth_headers(await register())
    plant = await create_plant(client, own)
    path = f"/api/v1/plants/{plant['id']}/shifts"
    body = {"name": "Night", "start_time": "22:00", "end_time": "06:00", "days_of_week": [7, 1]}
    response = await client.post(path, headers=own, json=body)
    assert response.status_code == 201
    shift = response.json()
    assert shift["days_of_week"] == [1, 7]
    assert (
        await client.patch(f"/api/v1/shifts/{shift['id']}", headers=own, json={"end_time": "22:00"})
    ).status_code == 422
    assert (
        await client.patch(
            f"/api/v1/shifts/{shift['id']}", headers=own, json={"days_of_week": None}
        )
    ).status_code == 422
    body["days_of_week"] = [1, 1]
    assert (await client.post(path, headers=own, json=body)).status_code == 422
    result = (await client.get(path + "?page=3&page_size=1", headers=own)).json()
    assert result == {
        "items": [],
        "total": 1,
        "page": 3,
        "page_size": 1,
        "has_next": False,
        "has_prev": False,
    }


async def test_invalid_upload_and_connection_authorization(
    client, register, auth_headers, monkeypatch
):
    own = auth_headers(await register())
    plant = await create_plant(client, own)
    machine = await create_machine(client, own, plant["id"])
    response = await client.post(
        f"/api/v1/machines/{machine['id']}/photo",
        headers=own,
        files={"file": ("attack.png", b"not a picture", "image/png")},
    )
    assert response.status_code == 415

    async def connected(host, port, unit_id):
        return {"ok": True, "latency_ms": 0.2, "registers": {"state": 1}}

    monkeypatch.setattr("app.api.machines.test_connection", connected)
    assert (
        await client.post(
            f"/api/v1/plants/{plant['id']}/machines/test-connection",
            headers=own,
            json={"host": "simulator", "port": 5020, "unit_id": 1},
        )
    ).status_code == 200
    assert (
        await client.patch(f"/api/v1/machines/{machine['id']}", headers=own, json={"host": None})
    ).status_code == 422
