import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BeforeValidator, EmailStr, Field

from app.schemas.common import Input


def strip(value):
    return value.strip() if isinstance(value, str) else value


def email(value):
    return value.strip().lower() if isinstance(value, str) else value


def password(value):
    if not re.search(r"[A-Za-z]", value) or not re.search(r"[0-9]", value):
        raise ValueError("password requires a letter and a digit")
    return value


Username = Annotated[
    str, Field(min_length=3, max_length=30, pattern=r"^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$")
]
Email = Annotated[EmailStr, Field(max_length=254), BeforeValidator(email)]
Name = Annotated[str, Field(min_length=2, max_length=80), BeforeValidator(strip)]
Password = Annotated[str, Field(min_length=8, max_length=128), AfterValidator(password)]


class Register(Input):
    username: Username
    email: Email
    full_name: Name
    password: Password
    language: Literal["es", "en"] = "es"


class Login(Input):
    username: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class Forgot(Input):
    email: Email


class Reset(Input):
    token: str = Field(min_length=1, max_length=512)
    new_password: Password


class UserPatch(Input):
    username: Username | None = None
    email: Email | None = None
    full_name: Name | None = None
    language: Literal["es", "en"] | None = None


class PasswordChange(Input):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password


class AccountDelete(Input):
    password: str = Field(min_length=1, max_length=128)
