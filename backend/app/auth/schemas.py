import uuid

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=255)


class UserBrief(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    roles: list[str]
    group_code: str | None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105
    expires_in: int
    user: UserBrief
