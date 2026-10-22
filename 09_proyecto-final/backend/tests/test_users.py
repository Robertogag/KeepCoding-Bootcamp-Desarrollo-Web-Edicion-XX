from sqlalchemy import func, select
from test_permissions import create_machine, create_plant

from app.models import Machine, Plant, RefreshToken, User


async def test_delete_account_cascades_only_sole_owner_plants(
    client, register, auth_headers, db_session
):
    first = await register()
    second = await register("second")
    own = auth_headers(first)
    sole = await create_plant(client, own, "Sole plant")
    shared = await create_plant(client, own, "Shared plant")
    machine = await create_machine(client, own, sole["id"])
    result = await client.post(
        f"/api/v1/plants/{shared['id']}/members",
        headers=own,
        json={"username": "second", "role": "owner"},
    )
    assert result.status_code == 201
    wrong = await client.request("DELETE", "/api/v1/me", headers=own, json={"password": "wrong"})
    assert wrong.status_code == 400
    deleted = await client.request(
        "DELETE", "/api/v1/me", headers=own, json={"password": "Password123!"}
    )
    assert deleted.status_code == 204
    assert await db_session.scalar(select(User.id).where(User.id == first["user"]["id"])) is None
    assert await db_session.scalar(select(Plant.id).where(Plant.id == sole["id"])) is None
    assert await db_session.scalar(select(Machine.id).where(Machine.id == machine["id"])) is None
    assert await db_session.scalar(select(Plant.id).where(Plant.id == shared["id"])) == shared["id"]
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(RefreshToken)
            .where(RefreshToken.user_id == first["user"]["id"])
        )
        == 0
    )
    assert (
        await client.get(f"/api/v1/plants/{shared['id']}", headers=auth_headers(second))
    ).status_code == 200


async def test_edit_user_and_change_password(client, register, auth_headers):
    account = await register()
    headers = auth_headers(account)
    result = await client.patch(
        "/api/v1/me", headers=headers, json={"full_name": "  Updated Name  ", "language": "en"}
    )
    assert result.status_code == 200 and result.json()["full_name"] == "Updated Name"
    assert (
        await client.put(
            "/api/v1/me/password",
            headers=headers,
            json={"current_password": "wrong", "new_password": "Changed123!"},
        )
    ).status_code == 400
    assert (
        await client.put(
            "/api/v1/me/password",
            headers=headers,
            json={"current_password": "Password123!", "new_password": "Changed123!"},
        )
    ).status_code == 204
    assert (await client.get("/api/v1/me", headers=headers)).status_code == 401
    assert (await client.post("/api/v1/auth/refresh")).status_code == 401
