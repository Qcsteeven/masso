import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog, SecurityEvent
from tests.conftest import login

pytestmark = pytest.mark.db


async def test_health(client: AsyncClient) -> None:
    r = await client.get("/api/health")
    body = r.json()
    assert r.status_code == 200
    assert body["status"] == "success" and body["data"]["db"] == "ok"
    assert body["request_id"]


async def test_login_wrong_password(client: AsyncClient, db: AsyncSession) -> None:
    r = await client.post("/api/auth/login", json={"email": "admin@masso.local", "password": "nope"})
    assert r.status_code == 401
    err = r.json()["error"]
    assert err["code"] == "AUTH_INVALID_CREDENTIALS"
    assert "парол" in err["message"]
    events = (await db.scalars(select(SecurityEvent).where(SecurityEvent.kind == "login_failed"))).all()
    assert len(events) == 1


async def test_login_and_me(client: AsyncClient) -> None:
    headers = await login(client, "demonov.la@masso.local")
    r = await client.get("/api/auth/me", headers=headers)
    data = r.json()["data"]
    assert data["roles"] == ["student"] and data["group_code"] == "ИСИб-23-1"


async def test_no_token(client: AsyncClient) -> None:
    r = await client.get("/api/auth/me")
    assert r.status_code == 401 and r.json()["error"]["code"] == "AUTH_INVALID_CREDENTIALS"


async def test_student_forbidden_on_admin(client: AsyncClient, as_student: dict[str, str]) -> None:
    r = await client.get("/api/users", headers=as_student)
    assert r.status_code == 403 and r.json()["error"]["code"] == "AUTH_FORBIDDEN"


async def test_refresh_rotates_and_detects_reuse(client: AsyncClient) -> None:
    await login(client, "teacher@masso.local")
    first = client.cookies.get("masso_refresh")
    assert first
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 200 and r.json()["data"]["access_token"]
    second = client.cookies.get("masso_refresh")
    assert second and second != first
    # reuse of the old token revokes the family
    client.cookies.set("masso_refresh", first, path="/api/auth")
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 401
    client.cookies.set("masso_refresh", second, path="/api/auth")
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 401


async def test_logout_revokes(client: AsyncClient) -> None:
    await login(client, "teacher@masso.local")
    token = client.cookies.get("masso_refresh")
    await client.post("/api/auth/logout")
    client.cookies.set("masso_refresh", token or "", path="/api/auth")
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 401


async def test_role_change_audited(client: AsyncClient, as_admin: dict[str, str], db: AsyncSession) -> None:
    users = (await client.get("/api/users", params={"q": "иванов"}, headers=as_admin)).json()["data"]["items"]
    uid = users[0]["id"]
    r = await client.put(
        f"/api/users/{uid}/roles", json={"roles": ["student", "teacher"], "reason": "ассистент"}, headers=as_admin
    )
    assert r.status_code == 200 and r.json()["data"]["roles"] == ["student", "teacher"]
    entry = await db.scalar(select(AuditLog).where(AuditLog.action == "user.roles"))
    assert entry is not None
    assert entry.before == {"roles": ["student"]} and entry.after == {"roles": ["student", "teacher"]}
    assert entry.reason == "ассистент"


async def test_blocked_user_cannot_login(client: AsyncClient, as_admin: dict[str, str]) -> None:
    users = (await client.get("/api/users", params={"q": "захаров"}, headers=as_admin)).json()["data"]["items"]
    r = await client.patch(f"/api/users/{users[0]['id']}", json={"status": "blocked"}, headers=as_admin)
    assert r.json()["data"]["status"] == "blocked"
    r = await client.post("/api/auth/login", json={"email": "zakharov.ni@masso.local", "password": "masso-demo"})
    assert r.status_code == 401


async def test_validation_error_envelope(client: AsyncClient, as_admin: dict[str, str]) -> None:
    r = await client.post("/api/users", json={"email": "x"}, headers=as_admin)
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_unknown_route_not_found(client: AsyncClient) -> None:
    r = await client.get("/api/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"
