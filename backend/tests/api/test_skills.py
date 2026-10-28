import json
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog
from app.skills.service import import_graph_data

pytestmark = pytest.mark.db
SEED = json.loads((Path(__file__).parents[2] / "seed" / "skills.json").read_text("utf-8"))


@pytest.fixture
async def graph(db: AsyncSession) -> None:
    await import_graph_data(db, SEED, actor_id=None, replace=False)
    await db.commit()


async def _ids(client: AsyncClient, headers: dict[str, str]) -> dict[str, str]:
    g = (await client.get("/api/skills/graph", headers=headers)).json()["data"]
    return {s["code"]: s["id"] for s in g["skills"]}


async def test_graph_by_domain(client: AsyncClient, graph: None, as_student: dict[str, str]) -> None:
    r = await client.get("/api/skills/graph", params={"domain": "devops"}, headers=as_student)
    data = r.json()["data"]
    codes = {s["code"] for s in data["skills"]}
    assert {"LNX.BASE", "WEB.NGINX.DIAG"} <= codes
    nginx = next(s for s in data["skills"] if s["code"] == "WEB.NGINX.DIAG")
    assert nginx["dependents"] == 5  # LB, TLS, HA, MON, INCIDENT
    assert any(t["required_level"] == 3 for t in data["targets"])


async def test_create_skill_and_cycle_rejected(
    client: AsyncClient, graph: None, as_methodist: dict[str, str], db: AsyncSession
) -> None:
    ids = await _ids(client, as_methodist)
    r = await client.post(
        "/api/skills",
        headers=as_methodist,
        json={
            "code": "WEB.CACHE",
            "domain_code": "devops",
            "name": "Кэширование на прокси",
            "requires": [{"skill_id": ids["WEB.NGINX.DIAG"], "weight": 0.7}],
        },
    )
    assert r.status_code == 201, r.text
    new_id = r.json()["data"]["id"]
    # LNX.BASE requires WEB.CACHE -> cycle
    r = await client.patch(
        f"/api/skills/{ids['LNX.BASE']}", headers=as_methodist, json={"requires": [{"skill_id": new_id, "weight": 0.5}]}
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "цикл" in r.json()["error"]["message"]
    assert await db.scalar(select(AuditLog).where(AuditLog.action == "skill.create")) is not None


async def test_student_cannot_edit_graph(client: AsyncClient, graph: None, as_student: dict[str, str]) -> None:
    r = await client.post("/api/skills", headers=as_student, json={"code": "X1", "domain_code": "devops", "name": "x"})
    assert r.status_code == 403


async def test_import_json_cycle_rejected(client: AsyncClient, as_methodist: dict[str, str]) -> None:
    content = json.dumps(
        {
            "skills": [
                {"code": "A1", "domain": "devops", "name": "A", "requires": [{"code": "B1", "weight": 0.5}]},
                {"code": "B1", "domain": "devops", "name": "B", "requires": [{"code": "A1", "weight": 0.5}]},
            ]
        }
    )
    r = await client.post("/api/skills/import", headers=as_methodist, json={"format": "json", "content": content})
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    g = (await client.get("/api/skills/graph", headers=as_methodist)).json()["data"]
    assert not any(s["code"] in ("A1", "B1") for s in g["skills"])  # rolled back


async def test_import_csv(client: AsyncClient, as_methodist: dict[str, str]) -> None:
    content = "code,domain,name,level_max,requires,required_level\nC1,audit,Первый,5,,3\nC2,audit,Второй,5,C1:0.7,2\n"
    r = await client.post("/api/skills/import", headers=as_methodist, json={"format": "csv", "content": content})
    assert r.status_code == 200, r.text
    assert r.json()["data"] == {"created": 2, "updated": 0, "edges": 1, "targets": 2}


async def test_student_profile_and_deficits(client: AsyncClient, graph: None, as_student: dict[str, str]) -> None:
    mine = (await client.get("/api/skills/me", params={"domain": "devops"}, headers=as_student)).json()["data"]
    assert all(m["level"] == 0 for m in mine) and len(mine) >= 9
    rec = (await client.get("/api/skills/recommendations", params={"domain": "devops"}, headers=as_student)).json()
    defs = rec["data"]["deficits"]
    assert defs and defs[0]["priority"] == "critical"  # LNX.BASE has > 3 dependents
    assert rec["data"]["recommendations"] == []  # no templates yet


async def test_teacher_sees_own_group_only(
    client: AsyncClient, graph: None, as_teacher: dict[str, str], as_admin: dict[str, str]
) -> None:
    users = (await client.get("/api/users", params={"q": "демонов"}, headers=as_admin)).json()["data"]["items"]
    r = await client.get("/api/skills/recommendations", params={"user_id": users[0]["id"]}, headers=as_teacher)
    assert r.status_code == 200
    other = (
        await client.post(
            "/api/users",
            headers=as_admin,
            json={
                "email": "other@masso.local",
                "full_name": "Студент другой группы",
                "password": "password1",
                "group_code": "ИСИб-23-2",
                "roles": ["student"],
            },
        )
    ).json()["data"]
    r = await client.get("/api/skills/recommendations", params={"user_id": other["id"]}, headers=as_teacher)
    assert r.status_code == 403


async def test_methodist_edits_theory_student_reads_it(
    client: AsyncClient, graph: None, as_methodist: dict[str, str], as_student: dict[str, str], db: AsyncSession
) -> None:
    ids = await _ids(client, as_methodist)
    theory = "## Процессы\n\nКоманда `ps` показывает процессы."
    r = await client.patch(f"/api/skills/{ids['LNX.BASE']}", headers=as_methodist, json={"theory": theory})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["theory"] == theory
    g = (await client.get("/api/skills/graph", params={"domain": "devops"}, headers=as_student)).json()["data"]
    assert next(s for s in g["skills"] if s["code"] == "LNX.BASE")["theory"] == theory
    audit = (await db.scalars(select(AuditLog).where(AuditLog.action == "skill.update"))).all()
    assert any((a.after or {}).get("theory_changed") for a in audit)
    r = await client.patch(f"/api/skills/{ids['LNX.BASE']}", headers=as_student, json={"theory": "x"})
    assert r.status_code == 403


async def test_seed_import_fills_empty_theory_only(db: AsyncSession) -> None:
    from app.skills.models import Skill

    base = {"skills": [{"code": "TH.ONE", "domain": "devops", "name": "Тема", "theory": "из сида"}]}
    await import_graph_data(db, base, actor_id=None, replace=False)
    s = await db.scalar(select(Skill).where(Skill.code == "TH.ONE"))
    assert s is not None and s.theory == "из сида"
    s.theory = "правка методиста"
    await import_graph_data(
        db, {"skills": [{**base["skills"][0], "theory": "новый сид"}]}, actor_id=None, replace=False
    )
    assert s.theory == "правка методиста"
    s.theory = ""
    await import_graph_data(
        db, {"skills": [{**base["skills"][0], "theory": "новый сид"}]}, actor_id=None, replace=False
    )
    assert s.theory == "новый сид"
