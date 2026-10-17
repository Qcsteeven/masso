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
    new_clause = g.incidents[0].adds_answer["expected_fix"].split("п. ")[1].split()[0]
    ideal["findings"].append(
        {"section": "5", "defect_type": "outdated_norm_reference", "proposed_text": f"п. {new_clause}"}
    )
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


async def test_legal_universal_answer_with_all_numbers_fails() -> None:
    """Security review, round 3: a comment listing every number must not count as naming the value."""
    every = " ".join(str(i) for i in range(1, 3000))
    universal = {
        "findings": [
            {"section": sec, "defect_type": t, "comment": every, "proposed_text": "10 15 20"}
            for sec, t in (("2", "total_sum_mismatch"), ("3", "deadline_mismatch"), ("4", "penalty_mismatch"))
        ]
        + [{"section": "5", "defect_type": "outdated_norm_reference", "comment": "5.1 5.3 6.2 7.1 8.4"}]
    }
    for seed in range(10):
        g = legal_supply_contract(random.Random(seed))
        ctx = CheckContext(answers=universal, applied_incidents={"inc_norm"})
        results = {c.id: (await run_check(c, ctx)).passed for c in g.checks}
        assert not results["find_d_total"] and not results["find_d_norm"]


async def test_legal_memorised_answer_does_not_fit_variants() -> None:
    """Security review: the defects sit in fixed sections, so a finding must name the variant's own value."""
    generic = {
        "findings": [
            {"section": "2", "defect_type": "total_sum_mismatch", "comment": "сумма не совпадает"},
            {"section": "3", "defect_type": "deadline_mismatch", "comment": "срок не совпадает"},
            {"section": "4", "defect_type": "penalty_mismatch", "comment": "неустойка не совпадает"},
            {"section": "5", "defect_type": "outdated_norm_reference", "comment": "ссылка устарела"},
        ]
    }
    for seed in range(5):
        g = legal_supply_contract(random.Random(seed))
        ctx = CheckContext(answers=generic, applied_incidents={"inc_norm"})
        results = {c.id: (await run_check(c, ctx)).passed for c in g.checks}
        assert not results["find_d_total"] and not any(v for k, v in results.items() if k.startswith("find_"))


async def test_legal_total_plus_enumerations_fails() -> None:
    """Security review, round 4: the real total plus lists of likely values for the other defects must not pass."""
    from app.assessment_agent.scoring import compute_score

    passed = 0
    for seed in range(20):
        g = legal_supply_contract(random.Random(seed))
        total = next(c for c in g.checks if c.id == "find_d_total").params["must_contain"][0]
        answer = {
            "findings": [
                {"section": "2", "defect_type": "total_sum_mismatch", "proposed_text": f"{total} руб."},
                {"section": "3", "defect_type": "deadline_mismatch", "comment": "10 15", "proposed_text": "20"},
                {"section": "4", "defect_type": "penalty_mismatch", "comment": "0,1", "proposed_text": "0,2"},
                {
                    "section": "5",
                    "defect_type": "outdated_norm_reference",
                    "comment": "5.1 6.2",
                    "proposed_text": "7.1",
                },
            ]
        }
        ctx = CheckContext(answers=answer, applied_incidents={"inc_norm"})
        res = [(await run_check(c, ctx)).as_dict() for c in g.checks]
        passed += compute_score(res, 0, 0, 75).passed
    assert passed <= 2  # only a lucky guess of both small values could pass
