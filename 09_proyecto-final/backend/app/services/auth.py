import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import select, update

from app.config import settings
from app.errors import ApiError
from app.models import RefreshToken, User

_hasher = PasswordHasher()
COOKIE_NAME = "refresh_token"
COOKIE_PATH = "/api/v1/auth"


def now():
    return datetime.now(UTC)


def aware(value):
    return value.replace(tzinfo=value.tzinfo or UTC)


def hash_password(value):
    return _hasher.hash(value)


def verify_password(password_hash, value):
    try:
        return _hasher.verify(password_hash, value)
    except (VerificationError, InvalidHashError):
        return False


def token_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


def issue_access_token(user):
    return jwt.encode(
        {
            "sub": str(user.id),
            "iat": now(),
            "exp": now() + timedelta(minutes=15),
            "type": "access",
            "pwd": token_hash(user.password_hash),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_access_token(token):
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub", "iat"]},
        )
        if payload.get("type") != "access" or not str(payload["sub"]).isdigit():
            raise ValueError("Wrong token type")
        return payload
    except (jwt.PyJWTError, ValueError, TypeError):
        raise ApiError(401, "NOT_AUTHENTICATED") from None


def set_refresh_cookie(response, raw):
    response.set_cookie(
        COOKIE_NAME,
        raw,
        max_age=14 * 86400,
        httponly=True,
        secure=True,
        samesite="lax",
        path=COOKIE_PATH,
    )


def clear_refresh_cookie(response):
    response.delete_cookie(
        COOKIE_NAME, path=COOKIE_PATH, secure=True, httponly=True, samesite="lax"
    )


async def new_refresh(session, user_id, family_id=None):
    raw = secrets.token_urlsafe(48)
    session.add(
        RefreshToken(
            token_hash=token_hash(raw),
            user_id=user_id,
            family_id=family_id or uuid.uuid4().hex,
            expires_at=now() + timedelta(days=14),
        )
    )
    return raw


async def lock_user(session, user_id):
    return await session.scalar(
        select(User)
        .where(User.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


async def rotate_refresh(session, raw):
    if not raw:
        raise ApiError(401, "NOT_AUTHENTICATED") from None
    owner_id = await session.scalar(
        select(RefreshToken.user_id).where(RefreshToken.token_hash == token_hash(raw))
    )
    if owner_id is None or await lock_user(session, owner_id) is None:
        raise ApiError(401, "INVALID_TOKEN")
    token = await session.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == token_hash(raw))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if token is None:
        raise ApiError(401, "INVALID_TOKEN") from None
    if token.revoked_at is not None:
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == token.family_id)
            .values(revoked_at=now())
        )
        await session.commit()
        raise ApiError(401, "INVALID_TOKEN") from None
    if aware(token.expires_at) <= now():
        raise ApiError(401, "INVALID_TOKEN") from None
    token.revoked_at = now()
    replacement = await new_refresh(session, token.user_id, token.family_id)
    return token.user_id, replacement


async def revoke_all(session, user_id):
    await session.execute(
        update(RefreshToken).where(RefreshToken.user_id == user_id).values(revoked_at=now())
    )
