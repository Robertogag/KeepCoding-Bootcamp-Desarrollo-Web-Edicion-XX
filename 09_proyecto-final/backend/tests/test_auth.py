from datetime import timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models import PasswordResetToken, RefreshToken
from app.services.auth import now, token_hash
from app.services.mailer import send_password_reset


@pytest.mark.parametrize(
    ("language", "subject", "phrase"),
    [
        ("es", "Restablecer tu contraseña", "Crear una contraseña nueva"),
        ("en", "Reset your password", "Create a new password"),
    ],
)
async def test_password_email_localizes_both_alternatives(monkeypatch, language, subject, phrase):
    captured = []

    async def send(message, **kwargs):
        captured.append(message)

    monkeypatch.setattr("app.services.mailer.aiosmtplib.send", send)
    user = SimpleNamespace(language=language, full_name="User", email="user@example.com")
    await send_password_reset(user, "example-reset-token")
    message = captured[0]
    assert message["Subject"] == subject
    plain = message.get_body(preferencelist=("plain",)).get_content()
    html = message.get_body(preferencelist=("html",)).get_content()
    assert phrase in plain and phrase in html
    assert f"/{language}/reset-password?token=example-reset-token" in plain


async def test_registration_cookie_login_and_case_insensitive_email(
    client, register, auth_headers, db_session
):
    account = await register(email="  PERSON@EXAMPLE.COM  ")
    assert account["user"]["email"] == "person@example.com"
    assert "password_hash" not in account["user"]
    cookie = client.cookies.jar._cookies["testserver.local"]["/api/v1/auth"]["refresh_token"]
    assert cookie.secure and cookie.has_nonstandard_attr("HttpOnly")
    assert cookie.get_nonstandard_attr("SameSite").lower() == "lax"
    stored = await db_session.scalar(select(RefreshToken))
    assert stored.token_hash != cookie.value
    assert stored.token_hash == token_hash(cookie.value)
    me = await client.get("/api/v1/me", headers=auth_headers(account))
    assert me.status_code == 200 and me.json() == account["user"]
    duplicate = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "other",
            "email": "PERSON@example.com",
            "full_name": "Other",
            "language": "en",
            "password": "Password123!",
        },
    )
    assert duplicate.status_code == 409 and duplicate.json()["error"]["code"] == "EMAIL_TAKEN"
    assert (
        await client.post("/api/v1/auth/login", json={"username": "owner", "password": "incorrect"})
    ).status_code == 401
    logged_in = await client.post(
        "/api/v1/auth/login", json={"username": "owner", "password": "Password123!"}
    )
    assert logged_in.status_code == 200


async def test_refresh_rotation_reuse_revokes_family(client, register):
    await register()
    original = client.cookies.get("refresh_token")
    first = await client.post("/api/v1/auth/refresh")
    assert first.status_code == 200
    rotated = client.cookies.get("refresh_token")
    assert original != rotated
    replay = await client.post(
        "/api/v1/auth/refresh", headers={"Cookie": f"refresh_token={original}"}
    )
    assert replay.status_code == 401
    assert replay.json() == {"error": {"code": "INVALID_TOKEN"}}
    revoked = await client.post(
        "/api/v1/auth/refresh", headers={"Cookie": f"refresh_token={rotated}"}
    )
    assert revoked.status_code == 401


async def test_reset_is_single_use_revokes_refresh_and_access(
    client, register, auth_headers, monkeypatch, db_session
):
    account = await register()
    deliveries = []

    async def send(user, token):
        deliveries.append((user.email, token))

    monkeypatch.setattr("app.api.auth.send_password_reset", send)
    assert (
        await client.post("/api/v1/auth/password/forgot", json={"email": "missing@example.com"})
    ).status_code == 204
    assert not deliveries
    assert (
        await client.post("/api/v1/auth/password/forgot", json={"email": "owner@example.com"})
    ).status_code == 204
    raw = deliveries[0][1]
    row = await db_session.scalar(select(PasswordResetToken))
    assert row.token_hash == token_hash(raw) and row.token_hash != raw
    body = {"token": raw, "new_password": "Changed123!"}
    assert (await client.post("/api/v1/auth/password/reset", json=body)).status_code == 204
    assert (await client.post("/api/v1/auth/password/reset", json=body)).status_code == 400
    assert (await client.post("/api/v1/auth/refresh")).status_code == 401
    assert (await client.get("/api/v1/me", headers=auth_headers(account))).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login", json={"username": "owner", "password": "Changed123!"}
        )
    ).status_code == 200


async def test_expired_reset_and_logout(client, register, db_session):
    account = await register()
    db_session.add(
        PasswordResetToken(
            token_hash=token_hash("expired"),
            user_id=account["user"]["id"],
            expires_at=now() - timedelta(seconds=1),
        )
    )
    await db_session.commit()
    assert (
        await client.post(
            "/api/v1/auth/password/reset", json={"token": "expired", "new_password": "Changed123!"}
        )
    ).status_code == 400
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 204 and response.content == b""
    assert (await client.post("/api/v1/auth/refresh")).status_code == 401


async def test_invalid_fields_have_contract_errors(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "x",
            "email": "x@example.com",
            "full_name": "Name",
            "language": "es",
            "password": "Password123!",
        },
    )
    assert response.status_code == 422
    assert response.json() == {"error": {"code": "VALIDATION_ERROR", "field": "username"}}
    assert (await client.get("/api/v1/me")).json() == {"error": {"code": "NOT_AUTHENTICATED"}}
