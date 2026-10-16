"""Pure algorithms of ProfileAgent (spec §6, ТЗ 4.2). No I/O — unit-tested on fixtures."""

import uuid
from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import IntEnum

STALE_DEFICIT_DAYS = 30
OUTDATED_DAYS = 90
CRITICAL_DEPENDENTS = 3  # critical if prerequisite (transitively) for MORE than 3 skills
STREAK_FOR_LEVEL_UP = 3


class Priority(IntEnum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

    @property
    def code(self) -> str:
        return self.name.lower()


@dataclass(frozen=True)
class Edge:
    skill_id: uuid.UUID  # the dependent skill
    requires_id: uuid.UUID  # its prerequisite
    weight: float


@dataclass
class SkillState:
    level: int = 0
    last_confirmed: datetime | None = None
    success_streak: int = 0
    success_count: int = 0
    fail_count: int = 0


@dataclass(frozen=True)
class Deficit:
    skill_id: uuid.UUID
    current_level: int
    required_level: int
    gap: int
    stale: bool
    days_since_confirmed: int | None
    dependents: int
    out_weight: float
    priority: Priority


def find_cycle(edges: Iterable[tuple[uuid.UUID, uuid.UUID]]) -> list[uuid.UUID] | None:
    """Returns one cycle (list of node ids) if the REQUIRES graph is cyclic, else None."""
    adj: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    nodes: set[uuid.UUID] = set()
    for a, b in edges:
        adj[a].append(b)
        nodes.update((a, b))
    white, grey, black = 0, 1, 2
    color = dict.fromkeys(nodes, white)
    parent: dict[uuid.UUID, uuid.UUID] = {}
    for start in nodes:
        if color[start] != white:
            continue
        stack: list[tuple[uuid.UUID, int]] = [(start, 0)]
        color[start] = grey
        while stack:
            node, idx = stack[-1]
            if idx < len(adj[node]):
                stack[-1] = (node, idx + 1)
                nxt = adj[node][idx]
                if color[nxt] == grey:
                    cycle = [nxt, node]
                    cur = node
                    while cur != nxt and cur in parent:
                        cur = parent[cur]
                        if cur != nxt:
                            cycle.append(cur)
                    return list(reversed(cycle))
                if color[nxt] == white:
                    color[nxt] = grey
                    parent[nxt] = node
                    stack.append((nxt, 0))
            else:
                color[node] = black
                stack.pop()
    return None


def dependents_count(edges: Iterable[Edge]) -> dict[uuid.UUID, int]:
    """Number of skills that require the given skill directly or transitively."""
    required_by: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    for e in edges:
        required_by[e.requires_id].add(e.skill_id)
    result: dict[uuid.UUID, int] = {}
    for skill in list(required_by):
        seen: set[uuid.UUID] = set()
        stack = list(required_by[skill])
        while stack:
            s = stack.pop()
            if s in seen:
                continue
            seen.add(s)
            stack.extend(required_by.get(s, ()))
        seen.discard(skill)
        result[skill] = len(seen)
    return result


def outgoing_weight(edges: Iterable[Edge]) -> dict[uuid.UUID, float]:
    """Sum of REQUIRES weights of edges in which the skill is a prerequisite."""
    w: dict[uuid.UUID, float] = defaultdict(float)
    for e in edges:
        w[e.requires_id] += e.weight
    return w


def compute_deficits(
    targets: Mapping[uuid.UUID, int], states: Mapping[uuid.UUID, SkillState], edges: Iterable[Edge], now: datetime
) -> list[Deficit]:
    edges = list(edges)
    deps = dependents_count(edges)
    outw = outgoing_weight(edges)
    out: list[Deficit] = []
    for skill_id, required in targets.items():
        st = states.get(skill_id, SkillState())
        gap = max(0, required - st.level)
        days = (now - st.last_confirmed).days if st.last_confirmed else None
        stale = st.last_confirmed is None or now - st.last_confirmed > timedelta(days=STALE_DEFICIT_DAYS)
        if gap < 2 and not stale:
            continue
        n_dep = deps.get(skill_id, 0)
        if n_dep > CRITICAL_DEPENDENTS:
            prio = Priority.CRITICAL
        elif gap >= 3:
            prio = Priority.HIGH
        elif gap >= 2:
            prio = Priority.MEDIUM
        else:
            prio = Priority.LOW
        out.append(
            Deficit(
                skill_id=skill_id,
                current_level=st.level,
                required_level=required,
                gap=gap,
                stale=stale,
                days_since_confirmed=days,
                dependents=n_dep,
                out_weight=round(outw.get(skill_id, 0.0), 2),
                priority=prio,
            )
        )
    out.sort(key=lambda d: (-d.priority, -d.gap, -d.out_weight, -(d.days_since_confirmed or 10**6)))
    return out


@dataclass(frozen=True)
class TemplateCandidate:
    template_id: uuid.UUID
    skills: Mapping[uuid.UUID, float]  # skill -> weight
    recently_passed: bool = False


@dataclass(frozen=True)
class Recommendation:
    template_id: uuid.UUID
    score: float
    covers: list[uuid.UUID] = field(default_factory=list)


def rank_templates(deficits: list[Deficit], candidates: Iterable[TemplateCandidate]) -> list[Recommendation]:
    prio = {d.skill_id: int(d.priority) for d in deficits}
    recs: list[Recommendation] = []
    for c in candidates:
        if c.recently_passed:
            continue
        covers = [s for s in c.skills if s in prio]
        if not covers:
            continue
        score = sum(c.skills[s] * prio[s] for s in covers)
        recs.append(
            Recommendation(
                template_id=c.template_id, score=round(score, 3), covers=sorted(covers, key=lambda s: -prio[s])
            )
        )
    recs.sort(key=lambda r: -r.score)
    return recs


def apply_result(state: SkillState, passed: bool, now: datetime, level_max: int) -> SkillState:
    """Update one HAS_SKILL edge after a finished scenario (ТЗ 4.2)."""
    s = SkillState(state.level, state.last_confirmed, state.success_streak, state.success_count, state.fail_count)
    if passed:
        s.success_streak += 1
        s.success_count += 1
        s.last_confirmed = now
        if s.success_streak >= STREAK_FOR_LEVEL_UP:
            s.level = min(s.level + 1, level_max)
            s.success_streak = 0
    else:
        s.success_streak = 0
        s.fail_count += 1
    return s


def is_outdated(last_confirmed: datetime | None, now: datetime) -> bool:
    return last_confirmed is not None and now - last_confirmed > timedelta(days=OUTDATED_DAYS)
