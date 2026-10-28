import json
import time

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.db

HIDDEN = ("answer_key", "expected_fix", "faults", "checks", 'params":', "brief", "variants", "fix")


async def _template_id(client: AsyncClient, headers: dict[str, str], code: str) -> str:
    items = (await client.get("/api/scenarios/templates", headers=headers)).json()["data"]
    return next(t["id"] for t in items if t["code"] == code)


@pytest.mark.parametrize("code", ["legal.supply_contract", "audit.invoice_reconciliation"])
async def test_generate_document_template_mode(
    client: AsyncClient, seeded: None, as_student: dict[str, str], code: str
) -> None:
    tid = await _template_id(client, as_student, code)
    t0 = time.monotonic()
    r = await client.post("/api/scenarios/generate", headers=as_student, json={"template_id": tid})
    assert r.status_code == 201, r.text
    assert time.monotonic() - t0 < 120
    data = r.json()["data"]
    assert data["status"] == "published" and data["generation_mode"] == "template"
    pub = (await client.get(f"/api/scenarios/runs/{data['run_id']}", headers=as_student)).json()["data"]
    assert pub["documents"] and pub["legend"] and pub["criteria"]
    assert pub["skills"]  # target skill codes for the student's theory
    raw = json.dumps(pub, ensure_ascii=False)
    for word in HIDDEN:
        assert word not in raw, word


async def test_other_student_cannot_read_run(client: AsyncClient, seeded: None, as_student: dict[str, str]) -> None:
    from tests.conftest import login

    tid = await _template_id(client, as_student, "audit.invoice_reconciliation")
    run_id = (await client.post("/api/scenarios/generate", headers=as_student, json={"template_id": tid})).json()[
        "data"
    ]["run_id"]
    other = await login(client, "petrova.md@masso.local")
    r = await client.get(f"/api/scenarios/runs/{run_id}", headers=other)
    assert r.status_code == 403


async def test_unsolvable_template_rejected(client: AsyncClient, seeded: None, as_methodist: dict[str, str]) -> None:
    spec = {
        "kind": "document",
        "code": "audit.broken",
        "domain": "audit",
        "title": "Сломанный кейс",
        "target_skills": [{"skill": "AUD.ARITH", "weight": 1}],
        "generator": "code",
        "builder": "",
        "legend": {"template": "Проверьте документ и найдите ошибку в расчётах поставщика."},
        "documents": [{"id": "invoice", "title": "Счёт", "markdown": "Итого: 100 руб."}],
        "answer_key": [
            {"id": "a", "field": "document_with_error", "defect_type": "invoice", "quote": "Итого: 999 руб."}
        ],
        "checks": [
            {
                "id": "c",
                "title": "Документ",
                "type": "rule_match",
                "weight": 1,
                "critical": True,
                "params": {"field": "document_with_error", "expected": "invoice"},
            }
        ],
        "hints": {"ladder": ["a", "b", "c"]},
    }
    r = await client.post("/api/scenarios/templates", headers=as_methodist, json={"spec": spec})
    assert r.status_code == 201, r.text
    tid = r.json()["data"]["id"]
    r = await client.post(f"/api/scenarios/templates/{tid}/publish", headers=as_methodist)
    assert r.json()["error"]["code"] == "SCENARIO_NOT_VALID"
    r = await client.post(f"/api/scenarios/templates/{tid}/validate", headers=as_methodist)
    report = r.json()["data"]["validation_report"]
    assert report["status"] == "rejected"
    assert any(s["step"] == "quotes" and not s["ok"] for s in report["steps"])
    r = await client.post(f"/api/scenarios/templates/{tid}/publish", headers=as_methodist)
    assert r.json()["error"]["code"] == "SCENARIO_NOT_VALID"


async def test_validate_and_publish_good_template(
    client: AsyncClient, seeded: None, as_methodist: dict[str, str]
) -> None:
    tid = await _template_id(client, as_methodist, "legal.supply_contract")
    t = (await client.get(f"/api/scenarios/templates/{tid}", headers=as_methodist)).json()["data"]
    spec = dict(t["spec"], title="Проверка договора поставки (ред.)")
    r = await client.patch(f"/api/scenarios/templates/{tid}", headers=as_methodist, json={"spec": spec})
    assert r.json()["data"]["status"] == "draft" and r.json()["data"]["version"] == 2
    r = await client.post(f"/api/scenarios/templates/{tid}/validate", headers=as_methodist)
    assert r.json()["data"]["validation_report"]["status"] == "published"
    r = await client.post(f"/api/scenarios/templates/{tid}/publish", headers=as_methodist)
    assert r.json()["data"]["status"] == "published"


async def test_assignments(
    client: AsyncClient, seeded: None, as_teacher: dict[str, str], as_student: dict[str, str]
) -> None:
    tid = await _template_id(client, as_teacher, "devops.web_recovery")
    r = await client.post(
        "/api/scenarios/assignments",
        headers=as_teacher,
        json={"template_id": tid, "group_code": "ИСИб-23-1", "due_at": "2026-10-24T18:00:00+08:00"},
    )
    assert r.status_code == 201, r.text
    r = await client.post(
        "/api/scenarios/assignments", headers=as_teacher, json={"template_id": tid, "group_code": "ДРУГАЯ-1"}
    )
    assert r.status_code == 403
    mine = (await client.get("/api/scenarios/assignments/me", headers=as_student)).json()["data"]
    assert [a["template"]["code"] for a in mine] == ["devops.web_recovery"]
