import random

from app.scenarios.generators import audit_reconciliation, legal_supply_contract, reference_answer
from app.scenarios.spec import Check
from app.verification.engine import CheckContext, run_check


async def _run(checks: list[Check], answers: dict, applied: set[str] | None = None) -> list[bool]:
    ctx = CheckContext(answers=answers, applied_incidents=applied or set())
    return [(await run_check(c, ctx)).passed for c in checks]


def test_generators_deterministic() -> None:
    a = legal_supply_contract(random.Random(5))
    b = legal_supply_contract(random.Random(5))
    assert a.documents == b.documents and a.answer_key == b.answer_key


async def test_legal_reference_answer_passes_and_quotes_present() -> None:
    g = legal_supply_contract(random.Random(1))
    text = "\n".join(d.markdown for d in g.documents)
    assert all(k.quote in text for k in g.answer_key)
    ideal = reference_answer(g.answer_key, g.checks)
    res = await _run(g.checks, ideal)
    # the norm check is skipped (incident not applied) -> counted as passed
    assert all(res)
    assert not all(await _run(g.checks, {"findings": []}))


async def test_legal_incident_requires_new_finding() -> None:
    g = legal_supply_contract(random.Random(2))
    ideal = reference_answer(g.answer_key, g.checks)
    res = await _run(g.checks, ideal, {"inc_norm"})
    assert not all(res)  # norm finding missing after the incident
    ideal["findings"].append({"section": "5", "defect_type": "outdated_norm_reference", "proposed_text": "п. 5.1"})
    assert all(await _run(g.checks, ideal, {"inc_norm"}))


async def test_audit_arithmetic_consistent() -> None:
    for seed in range(20):
        g = audit_reconciliation(random.Random(seed))
        ideal = reference_answer(g.answer_key, g.checks)
        assert all(await _run(g.checks, ideal)), seed
        wrong = dict(ideal, correct_sum=ideal["correct_sum"] + 1)
        assert not all(await _run(g.checks, wrong))


async def test_numeric_parsing_accepts_russian_format() -> None:
    g = audit_reconciliation(random.Random(3))
    ideal = reference_answer(g.answer_key, g.checks)
    s = f"{ideal['correct_sum']:,.2f}".replace(",", " ").replace(".", ",")
    assert all(await _run(g.checks, dict(ideal, correct_sum=s)))
