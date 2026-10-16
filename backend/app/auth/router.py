from typing import Any

from fastapi import APIRouter, Request, Response

from app.auth import service
from app.auth.schemas import LoginIn
from app.config import get_settings
from app.deps import DB, Me
from app.errors import ok
from app.users.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])
COOKIE = "masso_refresh"
COOKIE_PATH = "/api/auth"


def _set_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        COOKIE,
        token,
        max_age=s.refresh_token_ttl_days * 86400,
        httponly=True,
        secure=s.cookie_secure,
        samesite="strict",
        path=COOKIE_PATH,
    )


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response, db: DB) -> dict[str, Any]:
    ip = request.client.host if request.client else None
    out, refresh = await service.login(db, body.email, body.password, ip)
    _set_cookie(response, refresh)
    return ok(out.model_dump(mode="json"))


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: DB) -> dict[str, Any]:
    out, token = await service.refresh(db, request.cookies.get(COOKIE))
    _set_cookie(response, token)
    return ok(out.model_dump(mode="json"))


@router.post("/logout")
async def logout(request: Request, response: Response, db: DB) -> dict[str, Any]:
    await service.logout(db, request.cookies.get(COOKIE))
    response.delete_cookie(COOKIE, path=COOKIE_PATH)
    return ok({"logged_out": True})


@router.get("/me")
async def me(user: Me, db: DB) -> dict[str, Any]:
    row = await db.get(User, user.id)
    assert row is not None
    return ok(service.brief(row).model_dump(mode="json"))
