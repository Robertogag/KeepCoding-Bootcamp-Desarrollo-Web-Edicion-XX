from datetime import UTC, datetime, timedelta

import jwt

from app.config import settings
from app.errors import ApiError


def unfollow_token(user_id, machine_id):
    return jwt.encode(
        {
            "sub": str(user_id),
            "machine_id": machine_id,
            "type": "unfollow",
            "exp": datetime.now(UTC) + timedelta(days=30),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def verify_unfollow(token):
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub", "type", "machine_id"]},
        )
        if payload["type"] != "unfollow":
            raise ValueError
        return int(payload["sub"]), int(payload["machine_id"])
    except (jwt.InvalidTokenError, ValueError, TypeError) as error:
        raise ApiError(400, "INVALID_TOKEN") from error
