"""Incident pool of a container template: each variant gets a random subset (Д-41)."""

import json
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from app.scenario_agent.graph import ScenarioAgent
from app.scenarios.spec import parse_spec

BASE: dict[str, Any] = json.loads(
    (Path(__file__).parents[2] / "seed" / "templates" / "web_recovery.json").read_text("utf-8")
)


async def _pick(seed: int) -> list[str]:
    agent = ScenarioAgent(None, None, None)  # type: ignore[arg-type]  # select_params uses neither DB nor LLM
    out = await agent.select_params({"seed": seed, "base": BASE})  # type: ignore[typeddict-item]
    variant = parse_spec(out["spec"])  # a variant with one incident must stay a valid spec
    assert variant.incidents_pick is None
    return [i.id for i in variant.incidents]


async def test_variants_get_one_or_two_incidents_from_the_pool() -> None:
    pool = {i["id"] for i in BASE["incidents"]}
    assert len(pool) >= 4 and BASE["incidents_pick"] == [1, 2]
    seen: set[str] = set()
    counts: set[int] = set()
    for seed in range(60):
        ids = await _pick(seed)
        assert 1 <= len(ids) <= 2 and len(set(ids)) == len(ids) and set(ids) <= pool
        seen |= set(ids)
        counts.add(len(ids))
    assert seen == pool and counts == {1, 2}
    assert await _pick(7) == await _pick(7)  # reproducible from the run seed


def test_pick_range_is_validated() -> None:
    for bad in ([0, 1], [2, 1], [1, 99]):
        with pytest.raises(ValidationError):
            parse_spec({**BASE, "incidents_pick": bad})
    assert parse_spec({**BASE, "incidents_pick": None}).incidents_pick is None
