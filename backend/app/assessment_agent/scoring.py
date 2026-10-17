"""Score formula (spec §6, ТЗ 4.10). Pure functions."""

from dataclasses import dataclass
from typing import Any

CRITICAL_CAP = 49
HINT_PENALTY = 0.10
VIOLATION_PENALTY = 10


@dataclass(frozen=True)
class Score:
    base: int
    final: int
    passed: bool
    critical_failed: bool
    hints: int
    violations: int
    threshold: int

    def formula(self) -> str:
        return f"{self.base} × (1 − 0,1 × {self.hints}) − 10 × {self.violations} = {self.final}"


def compute_score(checks: list[dict[str, Any]], hints: int, violations: int, threshold: int = 75) -> Score:
    """base = 100·Σ(w·passed)/Σw; a failed critical check caps base at 49;
    final = round(base·(1 − 0.1·hints)) − 10·violations, not below 0. Skipped checks are ignored."""
    counted = [c for c in checks if not c.get("skipped")]
    total = sum(float(c["weight"]) for c in counted)
    got = sum(float(c["weight"]) for c in counted if c["passed"])
    base = round(100 * got / total) if total > 0 else 0
    critical_failed = any(c.get("critical") and not c["passed"] for c in counted)
    if critical_failed:
        base = min(base, CRITICAL_CAP)
    final = max(0, round(base * (1 - HINT_PENALTY * hints)) - VIOLATION_PENALTY * violations)
    return Score(
        base=base,
        final=final,
        passed=final >= threshold,
        critical_failed=critical_failed,
        hints=hints,
        violations=violations,
        threshold=threshold,
    )
