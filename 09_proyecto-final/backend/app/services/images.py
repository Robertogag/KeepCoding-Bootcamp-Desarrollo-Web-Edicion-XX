import io
import re
import uuid
import warnings
from datetime import timedelta
from pathlib import Path

import jwt
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings
from app.errors import ApiError
from app.services.auth import now

SIZES = {"sm": 320, "md": 768, "lg": 1280}
MAX_FILE_SIZE = 5 * 1024 * 1024


def photo_path(key, size):
    if not re.fullmatch(r"[a-f0-9]{32}", key) or size not in SIZES.values():
        raise ApiError(404, "NOT_FOUND")
    return Path(settings.upload_dir) / "machines" / f"{key}_{size}.webp"


def photo_urls(machine, public=False, user_id=None):
    if not machine.photo_key:
        return None
    query = ""
    if not public:
        token = jwt.encode(
            {
                "type": "photo",
                "sub": str(user_id),
                "key": machine.photo_key,
                "exp": now() + timedelta(hours=1),
            },
            settings.jwt_secret,
            algorithm="HS256",
        )
        query = f"?token={token}"
    return {
        label: f"/api/v1/media/machines/{machine.photo_key}_{size}.webp{query}"
        for label, size in SIZES.items()
    }


def photo_user(token, key):
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub"]}
        )
        if payload.get("type") != "photo" or payload.get("key") != key:
            return None
        return int(payload["sub"])
    except (jwt.PyJWTError, ValueError, TypeError):
        return None


def save_photo(content):
    if len(content) > MAX_FILE_SIZE:
        raise ApiError(413, "FILE_TOO_LARGE", "file")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as source:
                if (
                    source.format not in {"JPEG", "PNG", "WEBP"}
                    or source.width * source.height > 36_000_000
                ):
                    raise ApiError(415, "UNSUPPORTED_FILE", "file") from None
                source.load()
                converted = ImageOps.exif_transpose(source).convert("RGB")
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise ApiError(415, "UNSUPPORTED_FILE", "file") from None
    key = uuid.uuid4().hex
    try:
        for size in SIZES.values():
            target = photo_path(key, size)
            target.parent.mkdir(parents=True, exist_ok=True)
            scale = min(size / converted.width, size / converted.height)
            dimensions = (
                max(1, round(converted.width * scale)),
                max(1, round(converted.height * scale)),
            )
            resized = converted.resize(dimensions, Image.Resampling.LANCZOS)
            resized.save(target, format="WEBP", quality=85)
    except Exception:
        delete_photo(key)
        raise
    return key


def delete_photo(key):
    if key and re.fullmatch(r"[a-f0-9]{32}", key):
        for size in SIZES.values():
            photo_path(key, size).unlink(missing_ok=True)
