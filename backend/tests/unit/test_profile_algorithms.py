import uuid
from datetime import UTC, datetime, timedelta

from app.profile_agent.algorithms import (
    Edge,
    Priority,
    SkillState,
    TemplateCandidate,
    apply_result,
    compute_deficits,
    dependents_count,
    find_cycle,
    is_outdated,
    rank_templates,
)

NOW = datetime(2026, 10, 17, tzinfo=UTC)


def ids(n: int) -> list[uuid.UUID]:
    return [uuid.uuid4() for _ in range(n)]


def test_find_cycle() -> None:
    a, b, c, d = ids(4)
    assert find_cycle([(a, b), (b, c), (a, c)]) is None
    cyc = find_cycle([(a, b), (b, c), (c, a), (d, a)])
    assert cyc is not None and set(cyc) == {a, b, c}


def test_dependents_transitive() -> None:
    base, x, y, z, w = ids(5)
    # x, y require base; z requires x; w requires z  -> base has 4 dependents
    edges = [Edge(x, base, 1), Edge(y, base, 1), Edge(z, x, 1), Edge(w, z, 1)]
    assert dependents_count(edges)[base] == 4
    assert dependents_count(edges)[x] == 2


def test_gap_two_is_deficit_gap_one_fresh_is_not() -> None:
    a, b = ids(2)
    states = {
        a: SkillState(level=1, last_confirmed=NOW - timedelta(days=1)),
        b: SkillState(level=2, last_confirmed=NOW - timedelta(days=1)),
    }
    res = compute_deficits({a: 3, b: 3}, states, [], NOW)
    assert [d.skill_id for d in res] == [a]
    assert res[0].priority == Priority.MEDIUM and res[0].gap == 2


def test_staleness_30_days() -> None:
    a, b = ids(2)
    states = {
        a: SkillState(level=3, last_confirmed=NOW - timedelta(days=31)),
        b: SkillState(level=3, last_confirmed=NOW - timedelta(days=29)),
    }
    res = compute_deficits({a: 3, b: 3}, states, [], NOW)
    assert len(res) == 1 and res[0].skill_id == a and res[0].priority == Priority.LOW and res[0].stale


def test_never_confirmed_is_deficit() -> None:
    a = uuid.uuid4()
    res = compute_deficits({a: 3}, {}, [], NOW)
    assert res[0].gap == 3 and res[0].priority == Priority.HIGH


def test_critical_when_more_than_three_dependents() -> None:
    base, s1, s2, s3, s4 = ids(5)
    three = [Edge(s1, base, 1), Edge(s2, base, 1), Edge(s3, base, 1)]
    st = {base: SkillState(level=2, last_confirmed=NOW)}
    assert compute_deficits({base: 4}, st, three, NOW)[0].priority == Priority.MEDIUM
    four = [*three, Edge(s4, base, 1)]
    assert compute_deficits({base: 4}, st, four, NOW)[0].priority == Priority.CRITICAL


def test_ranking_order() -> None:
    a, b, c = ids(3)
    states = {
        a: SkillState(level=1, last_confirmed=NOW),
        b: SkillState(level=0, last_confirmed=NOW),
        c: SkillState(level=3, last_confirmed=NOW - timedelta(days=40)),
    }
    res = compute_deficits({a: 3, b: 3, c: 3}, states, [], NOW)
    assert [d.skill_id for d in res] == [b, a, c]


def test_three_successes_level_up_and_cap() -> None:
    s = SkillState(level=4)
    for _ in range(2):
        s = apply_result(s, True, NOW, level_max=5)
    assert s.level == 4 and s.success_streak == 2
    s = apply_result(s, True, NOW, level_max=5)
    assert s.level == 5 and s.success_streak == 0 and s.last_confirmed == NOW
    for _ in range(3):
        s = apply_result(s, True, NOW, level_max=5)
    assert s.level == 5  # capped


def test_failure_resets_streak() -> None:
    s = apply_result(apply_result(SkillState(), True, NOW, 5), True, NOW, 5)
    s = apply_result(s, False, NOW, 5)
    assert s.success_streak == 0 and s.fail_count == 1 and s.level == 0
    for _ in range(3):
        s = apply_result(s, True, NOW, 5)
    assert s.level == 1


def test_outdated_90_days() -> None:
    assert is_outdated(NOW - timedelta(days=91), NOW)
    assert not is_outdated(NOW - timedelta(days=89), NOW)
    assert not is_outdated(None, NOW)


def test_rank_templates() -> None:
    a, b = ids(2)
    t1, t2, t3 = ids(3)
    res = compute_deficits(
        {a: 3, b: 3}, {a: SkillState(level=0, last_confirmed=NOW), b: SkillState(level=1, last_confirmed=NOW)}, [], NOW
    )
    recs = rank_templates(
        res,
        [
            TemplateCandidate(t1, {a: 0.5}),
            TemplateCandidate(t2, {a: 0.5, b: 0.5}),
            TemplateCandidate(t3, {a: 1.0}, recently_passed=True),
        ],
    )
    assert [r.template_id for r in recs] == [t2, t1]
