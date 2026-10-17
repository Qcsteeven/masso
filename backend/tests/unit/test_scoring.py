from app.assessment_agent.scoring import compute_score


def c(w: float, passed: bool, critical: bool = False, skipped: bool = False) -> dict:
    return {"weight": w, "passed": passed, "critical": critical, "skipped": skipped}


def test_all_passed_no_penalties() -> None:
    s = compute_score([c(40, True, True), c(60, True)], 0, 0)
    assert (s.base, s.final, s.passed) == (100, 100, True)


def test_weighted_base_and_hint_penalty() -> None:
    s = compute_score([c(40, True, True), c(20, True), c(15, True), c(15, True), c(10, False)], 1, 0)
    assert s.base == 90 and s.final == 81 and s.passed  # the example from the protocol mockup


def test_critical_cap() -> None:
    s = compute_score([c(10, False, True), c(90, True)], 0, 0)
    assert s.base == 49 and s.critical_failed and not s.passed


def test_violations_and_floor() -> None:
    s = compute_score([c(1, True, True)], 3, 2)
    assert s.final == 70 - 20 == 50
    s = compute_score([c(1, False, True)], 3, 9)
    assert s.final == 0


def test_skipped_checks_ignored() -> None:
    s = compute_score([c(50, True, True), c(50, False, skipped=True)], 0, 0)
    assert s.base == 100


def test_threshold() -> None:
    assert not compute_score([c(74, True, True), c(26, False)], 0, 0).passed
    assert compute_score([c(75, True, True), c(25, False)], 0, 0).passed
