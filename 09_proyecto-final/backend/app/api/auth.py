import logging
import secrets
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Query, Request, Response
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from app.api.deps import Session
from app.errors import ApiError
from app.models import PasswordResetToken, RefreshToken, User
from app.schemas.auth import Forgot, Login, Register, Reset
from app.schemas.common import utc_iso
from app.services.auth import (
    COOKIE_NAME,
    aware,
    clear_refresh_cookie,
    hash_password,
    issue_access_token,
    lock_user,
    new_refresh,
    now,
    revoke_all,
    rotate_refresh,
    set_refresh_cookie,
    token_hash,
    verify_password,
)
from app.services.mailer import send_password_reset

router = APIRouter(prefix="/auth", tags=["auth"])
_dummy_hash = hash_password("DummyPassword1428")


def user_data(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "language": user.language,
        "created_at": utc_iso(user.created_at),
    }


async def check_unique(session, username=None, email=None, exclude_id=None):
    for field, value, code in [
        ("username", username, "USERNAME_TAKEN"),
        ("email", email, "EMAIL_TAKEN"),
    ]:
        if value is not None:
            query = select(User.id).where(getattr(User, field) == value)
            if exclude_id is not None:
                query = query.where(User.id != exclude_id)
            if await session.scalar(query):
                raise ApiError(409, code, field)


@router.post("/register", status_code=201)
async def register(data: Register, response: Response, session: Session):
    await check_unique(session, data.username, data.email)
    user = User(**data.model_dump(exclude={"password"}), password_hash=hash_password(data.password))
    session.add(user)
    try:
        await session.flush()
        raw = await new_refresh(session, user.id)
        await session.commit()
    except IntegrityError:
        await session.rollback()
        await check_unique(session, data.username, data.email)
        raise ApiError(422, "VALIDATION_ERROR") from None
    await session.refresh(user)
    set_refresh_cookie(response, raw)
    return {"user": user_data(user), "access_token": issue_access_token(user)}


@router.post("/login")
async def login(data: Login, response: Response, session: Session):
    user = await session.scalar(
        select(User).where(User.username == data.username).with_for_update()
    )
    valid = verify_password(user.password_hash if user else _dummy_hash, data.password)
    if not user or not valid:
        raise ApiError(401, "INVALID_CREDENTIALS")
    raw = await new_refresh(session, user.id)
    await session.commit()
    set_refresh_cookie(response, raw)
    return {"user": user_data(user), "access_token": issue_access_token(user)}


@router.post("/refresh")
async def refresh(request: Request, response: Response, session: Session):
    user_id, raw = await rotate_refresh(session, request.cookies.get(COOKIE_NAME))
    user = await session.get(User, user_id)
    if user is None:
        raise ApiError(401, "NOT_AUTHENTICATED") from None
    await session.commit()
    set_refresh_cookie(response, raw)
    return {"access_token": issue_access_token(user)}


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, session: Session):
    raw = request.cookies.get(COOKIE_NAME)
    if raw:
        token = await session.get(RefreshToken, token_hash(raw))
        if token and await lock_user(session, token.user_id):
            await session.execute(
                update(RefreshToken)
                .where(RefreshToken.family_id == token.family_id)
                .values(revoked_at=now())
            )
            await session.commit()
    clear_refresh_cookie(response)


async def _deliver_reset(user, token):
    try:
        await send_password_reset(user, token)
    except Exception:
        logging.getLogger(__name__).exception("Password reset email delivery failed")


@router.post("/password/forgot", status_code=204)
async def forgot(data: Forgot, tasks: BackgroundTasks, session: Session):
    user = await session.scalar(select(User).where(User.email == data.email))
    if user:
        raw = secrets.token_urlsafe(48)
        session.add(
            PasswordResetToken(
                token_hash=token_hash(raw), user_id=user.id, expires_at=now() + timedelta(hours=1)
            )
        )
        await session.commit()
        tasks.add_task(_deliver_reset, user, raw)


@router.post("/password/reset", status_code=204)
async def reset(data: Reset, session: Session):
    token = await session.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == token_hash(data.token))
        .with_for_update()
    )
    if token is None or token.used_at is not None or aware(token.expires_at) <= now():
        raise ApiError(400, "INVALID_TOKEN")
    user = await lock_user(session, token.user_id)
    if user is None:
        raise ApiError(400, "INVALID_TOKEN")
    token.used_at = now()
    user.password_hash = hash_password(data.new_password)
    await revoke_all(session, user.id)
    await session.commit()


@router.get("/availability")
async def availability(
    session: Session,
    username: str | None = Query(default=None, max_length=30),
    email: str | None = Query(default=None, max_length=254),
):
    return {
        "username_available": not bool(
            username and await session.scalar(select(User.id).where(User.username == username))
        ),
        "email_available": not bool(
            email
            and await session.scalar(select(User.id).where(User.email == email.strip().lower()))
        ),
    }
