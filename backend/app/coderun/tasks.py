# ruff: noqa: E501  (task statements and solution sources are data)
"""Algorithm tasks with code (engine `code`, Д-44): variant builders, reference solutions and typical mistakes.

Sources are templates with `$func` (string.Template): the same text is shipped into the sandbox and executed by
the backend to compute expected answers, so the student never receives the reference or the expected values.
Mutants are typical mistakes the student's own tests must catch; wrong solutions must fail the hidden checks
(dynamic validation of every variant).
"""

import random
from dataclasses import dataclass, field
from string import Template
from typing import Any

from app.scenarios.spec import Check, CodeExample, Incident

# ---------------------------------------------------------------- shared


@dataclass
class CodeVariant:
    func: str
    statement: str
    files: dict[str, str]
    examples: list[CodeExample]
    hidden: dict[str, Any]  # group -> list of argument lists, or {"recipe": source, "kwargs": {...}}
    task: dict[str, Any]  # variant parameters used by the sources below
    incidents: list[Incident]
    checks: list[Check]
    params: dict[str, Any] = field(default_factory=dict)


def _src(template: str, task: dict[str, Any]) -> str:
    return Template(template).substitute(task).strip() + "\n"


def load_function(source: str, func: str) -> Any:
    """Trusted code only (our references and recipes)."""
    ns: dict[str, Any] = {}
    exec(source, ns)  # noqa: S102
    return ns[func]


def _checks(incident_id: str, incident_title: str, perf_limit: float) -> list[Check]:
    return [
        Check(
            id="examples",
            title="Решение проходит примеры из условия",
            type="code_cases",
            weight=10,
            params={"group": "examples", "time_limit": 5},
        ),
        Check(
            id="basic",
            title="Верные ответы на типовых данных",
            type="code_cases",
            weight=30,
            critical=True,
            params={"group": "basic", "time_limit": 5},
        ),
        Check(
            id="edge",
            title="Крайние случаи обработаны",
            type="code_cases",
            weight=20,
            params={"group": "edge", "time_limit": 5},
        ),
        Check(
            id="perf",
            title="Укладывается в ограничение по времени на больших данных",
            type="code_cases",
            weight=20,
            params={"group": "perf", "time_limit": perf_limit},
        ),
        Check(
            id="own_tests",
            title="Ваши тесты находят типичные ошибки",
            type="code_student_tests",
            weight=20,
            params={"min_killed": 2},
        ),
        Check(
            id="incident",
            title=incident_title,
            type="code_cases",
            weight=15,
            params={"group": incident_id, "time_limit": 5, "requires_incident": incident_id},
        ),
    ]


TEST_HINT = (
    "\n# Добавьте свои тесты: функции с именами test_..., проверка через assert.\n"
    "# Хорошие тесты ловят типичные ошибки: пустые входы, граничные элементы, отсутствие ответа.\n"
)

# ---------------------------------------------------------------- 1. binary search

BS_REFERENCE = """
def $func(ids, target):
    lo, hi = 0, len(ids)
    while lo < hi:
        mid = (lo + hi) // 2
        if ids[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo if lo < len(ids) and ids[lo] == target else -1
"""
BS_MUTANTS = [
    """
def $func(ids, target):  # the last element is never checked
    lo, hi = 0, len(ids) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if ids[mid] == target:
            return mid
        if ids[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return -1
""",
    """
def $func(ids, target):  # returns the insertion point instead of -1
    lo, hi = 0, len(ids)
    while lo < hi:
        mid = (lo + hi) // 2
        if ids[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo
""",
    """
def $func(ids, target):  # fails on an empty list
    if ids[0] > target or ids[-1] < target:
        return -1
    lo, hi = 0, len(ids)
    while lo < hi:
        mid = (lo + hi) // 2
        if ids[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo if ids[lo] == target else -1
""",
]
BS_WRONG = [
    """
def $func(ids, target):  # linear: correct but O(n) per call
    for i, x in enumerate(ids):
        if x == target:
            return i
    return -1
""",
    BS_MUTANTS[0],
]
BS_TESTS = """
from solution import $func


def test_found():
    assert $func([1, 3, 5, 7], 5) == 2


def test_missing():
    assert $func([1, 3, 5, 7], 4) == -1


def test_empty():
    assert $func([], 1) == -1


def test_single_and_last():
    assert $func([9], 9) == 0
    assert $func([1, 3, 5, 7], 7) == 3
"""
BS_RECIPE = """
import random
def make_cases(n, q, seed):
    rng = random.Random(seed)
    ids = sorted(rng.sample(range(10 * n), n))
    targets = [rng.choice(ids) if rng.random() < 0.6 else rng.randrange(10 * n) for _ in range(q)]
    return [[ids, t] for t in targets]
"""


def build_binary_search(rng: random.Random) -> CodeVariant:
    func = rng.choice(["find_order", "find_position", "locate_id"])
    entity = rng.choice(["заказов", "посылок", "билетов", "накладных"])
    task = {"func": func}

    def uniq(n: int) -> list[int]:
        return sorted(rng.sample(range(1, 30 * max(n, 1) + 2), n))

    basic: list[list[Any]] = []
    for _ in range(10):
        ids = uniq(rng.randint(5, 60))
        t = rng.choice(ids) if rng.random() < 0.6 else rng.randint(-5, ids[-1] + 5)
        basic.append([ids, t])
    edge: list[list[Any]] = [[[], 3], [[5], 5], [[5], 4], [[2, 4], 1], [[2, 4], 9], [[2, 4], 4], [[2, 4, 8, 16], 2]]
    ids = uniq(40)
    edge += [[ids, ids[0]], [ids, ids[-1]], [ids, ids[0] - 1], [ids, ids[-1] + 1]]
    dups: list[list[Any]] = []
    for _ in range(8):
        base = uniq(rng.randint(4, 20))
        arr = sorted(base + [rng.choice(base) for _ in range(rng.randint(2, 10))])
        dups.append([arr, rng.choice(arr)])
    dups += [[[3, 3, 3], 3], [[1, 2, 2, 2, 5], 2]]
    statement = f"""\
Реализуйте функцию `{func}(ids, target)` в файле `solution.py`.

- `ids` — список номеров {entity}, **отсортированный по возрастанию**, номера не повторяются; длина до 200 000.
- `target` — номер, который нужно найти.
- Верните **индекс** `target` в списке или `-1`, если его там нет.

Функцию вызывают очень часто: проверка делает 20 000 запросов к списку из 200 000 номеров, на всё отводится несколько секунд. Просмотр списка подряд не уложится — используйте упорядоченность.

#### Примеры
| Вызов | Результат |
|---|---|
| `{func}([1, 3, 5, 7], 5)` | `2` |
| `{func}([1, 3, 5, 7], 4)` | `-1` |

В `test_solution.py` напишите собственные тесты: они оцениваются отдельно — должны проходить на правильном решении и находить типичные ошибки."""
    return CodeVariant(
        func=func,
        statement=statement,
        files={
            "solution.py": f'def {func}(ids, target):\n    """Индекс target в отсортированном списке ids или -1."""\n    # TODO: реализуйте поиск\n    return -1\n',
            "test_solution.py": f"from solution import {func}\n\n\ndef test_example():\n    assert {func}([1, 3, 5, 7], 5) == 2\n{TEST_HINT}",
        },
        examples=[CodeExample(args=[[1, 3, 5, 7], 5], expected=2), CodeExample(args=[[1, 3, 5, 7], 4], expected=-1)],
        hidden={
            "basic": basic,
            "edge": edge,
            "perf": {
                "recipe": BS_RECIPE.strip(),
                "kwargs": {"n": 200_000, "q": 20_000, "seed": rng.randrange(1 << 30)},
            },
            "inc_dups": dups,
        },
        task=task,
        incidents=[
            Incident(
                id="inc_dups",
                after_min=(2, 5),
                message=(
                    f"Заказчик уточнил: в журнале {entity} теперь бывают повторяющиеся номера (список по-прежнему отсортирован). "
                    "Если номер встречается несколько раз, верните индекс его ПЕРВОГО вхождения."
                ),
            )
        ],
        checks=_checks("inc_dups", "Учтено новое требование: индекс первого вхождения при повторах", 4.0),
        params={"entity": entity},
    )


# ---------------------------------------------------------------- 2. brackets

BR_REFERENCE = """
def $func(s):
    pairs = $pairs
    opening = set(pairs.values())
    stack = []
    in_quotes = False
    for ch in s:
        if ch == '"':
            in_quotes = not in_quotes
        elif in_quotes:
            continue
        elif ch in opening:
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack
"""
BR_MUTANTS = [
    """
def $func(s):  # one counter for all bracket types: "([)]" passes
    pairs = $pairs
    depth = 0
    for ch in s:
        if ch in pairs.values():
            depth += 1
        elif ch in pairs:
            depth -= 1
            if depth < 0:
                return False
    return depth == 0
""",
    """
def $func(s):  # forgets that unclosed brackets remain at the end
    pairs = $pairs
    stack = []
    for ch in s:
        if ch in pairs.values():
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return True
""",
    """
def $func(s):  # ignores a closing bracket on an empty stack
    pairs = $pairs
    stack = []
    for ch in s:
        if ch in pairs.values():
            stack.append(ch)
        elif ch in pairs:
            if stack and stack.pop() != pairs[ch]:
                return False
    return not stack
""",
]
BR_WRONG = [
    """
def $func(s):  # repeated replace: correct but quadratic
    pairs = $pairs
    t = "".join(ch for ch in s if ch in pairs or ch in pairs.values())
    while True:
        u = t
        for close, open_ in pairs.items():
            u = u.replace(open_ + close, "")
        if u == t:
            return t == ""
        t = u
""",
    BR_MUTANTS[0],
]
BR_TESTS = """
from solution import $func


def test_ok():
    assert $func("a(b)[c]")


def test_wrong_order():
    assert not $func("([)]")


def test_unclosed_and_extra():
    assert not $func("((")
    assert not $func("())(")
    assert not $func(")")


def test_empty():
    assert $func("")
"""
BR_RECIPE = """
import random
def make_cases(n, seed, pairs):
    rng = random.Random(seed)
    opens = list(pairs.values())
    closes = {v: k for k, v in pairs.items()}
    nested = "".join(opens[i % len(opens)] for i in range(n // 2))
    deep = nested + "".join(closes[ch] for ch in reversed(nested))
    stack, out = [], []
    for _ in range(n):
        if stack and rng.random() < 0.45:
            out.append(closes[stack.pop()])
        elif rng.random() < 0.2:
            out.append(rng.choice("abcxyz =:"))
        else:
            ch = rng.choice(opens)
            stack.append(ch)
            out.append(ch)
    out.extend(closes[ch] for ch in reversed(stack))
    mixed = "".join(out)
    return [[deep], [mixed], [mixed[:-1]], [deep[:-1] + opens[0]]]
"""


def build_brackets(rng: random.Random) -> CodeVariant:
    func = rng.choice(["is_balanced", "check_brackets", "brackets_ok"])
    kinds = rng.choice(["()[]{}", "()[]{}<>"])
    pairs = {kinds[i + 1]: kinds[i] for i in range(0, len(kinds), 2)}
    task = {"func": func, "pairs": repr(pairs)}
    opens = list(pairs.values())

    def balanced(n: int) -> str:
        stack: list[str] = []
        out: list[str] = []
        for _ in range(n):
            if stack and rng.random() < 0.45:
                out.append({v: k for k, v in pairs.items()}[stack.pop()])
            elif rng.random() < 0.25:
                out.append(rng.choice("abc xyz=:,"))
            else:
                ch = rng.choice(opens)
                stack.append(ch)
                out.append(ch)
        out.extend({v: k for k, v in pairs.items()}[ch] for ch in reversed(stack))
        return "".join(out)

    basic: list[list[Any]] = []
    for _ in range(10):
        s = balanced(rng.randint(6, 40))
        if rng.random() < 0.5 and len(s) > 2:
            i = rng.randrange(len(s))
            s = s[:i] + rng.choice(list(pairs)) + s[i:]
        basic.append([s])
    o, c = opens[1], list(pairs)[1]
    edge: list[list[Any]] = [
        [""],
        ["abc"],
        [")"],
        ["("],
        [")("],
        ["()" + o + c],
        ["(" + o + ")" + c],
        ["((" + o + c + ")"],
        ["())("],
    ]
    q = '"'
    inc = [[f"key={q}({q}"], [f"a({q}){q}b)"], [f"{q}[{q}]"], [f"x({q}{o}{q}){q}{c}{q}"], [f"({q}){q}"], [f"{q}{q}()"]]
    shown = " ".join(f"`{a}{b}`" for b, a in pairs.items())
    statement = f"""\
Реализуйте функцию `{func}(s)` в файле `solution.py`.

Строка `s` — фрагмент конфигурационного файла длиной до 1 000 000 символов. В нём встречаются скобки {shown} и любые другие символы (буквы, пробелы, знаки), которые нужно пропускать.

Верните `True`, если скобки расставлены правильно: каждой открывающей соответствует закрывающая того же вида и вложенность не нарушена. Иначе — `False`.

На проверке есть строки длиной миллион символов и глубокая вложенность: решение должно работать за один проход.

#### Примеры
| Вызов | Результат |
|---|---|
| `{func}("a(b)[c]")` | `True` |
| `{func}("([)]")` | `False` |

В `test_solution.py` напишите собственные тесты: они оцениваются отдельно — должны проходить на правильном решении и находить типичные ошибки."""
    return CodeVariant(
        func=func,
        statement=statement,
        files={
            "solution.py": f'def {func}(s):\n    """True, если скобки в строке s расставлены правильно."""\n    # TODO: реализуйте проверку\n    return True\n',
            "test_solution.py": f'from solution import {func}\n\n\ndef test_example():\n    assert {func}("a(b)[c]")\n{TEST_HINT}',
        },
        examples=[CodeExample(args=["a(b)[c]"], expected=True), CodeExample(args=["([)]"], expected=False)],
        hidden={
            "basic": basic,
            "edge": edge,
            "perf": {
                "recipe": BR_RECIPE.strip(),
                "kwargs": {"n": 1_000_000, "seed": rng.randrange(1 << 30), "pairs": pairs},
            },
            "inc_quotes": inc,
        },
        task=task,
        incidents=[
            Incident(
                id="inc_quotes",
                after_min=(2, 5),
                message=(
                    'Заказчик уточнил: в конфигурации появились строковые значения в двойных кавычках ("..."). '
                    "Скобки внутри кавычек не учитываются; кавычки всегда парные."
                ),
            )
        ],
        checks=_checks("inc_quotes", "Учтено новое требование: скобки в кавычках не учитываются", 4.0),
    )


# ---------------------------------------------------------------- 3. BFS on a grid

BFS_REFERENCE = """
from collections import deque


def $func(grid):
    start = goal = None
    for r, line in enumerate(grid):
        for c, ch in enumerate(line):
            if ch == "S":
                start = (r, c)
            elif ch == "G":
                goal = (r, c)
    if start is None or goal is None:
        return -1
    dist = {start: 0}
    queue = deque([start])
    while queue:
        r, c = queue.popleft()
        if (r, c) == goal:
            return dist[(r, c)]
        moves = ((0, 1),) if grid[r][c] == ">" else ((1, 0), (-1, 0), (0, 1), (0, -1))
        for dr, dc in moves:
            nr, nc = r + dr, c + dc
            if 0 <= nr < len(grid) and 0 <= nc < len(grid[nr]) and grid[nr][nc] != "#" and (nr, nc) not in dist:
                dist[(nr, nc)] = dist[(r, c)] + 1
                queue.append((nr, nc))
    return -1
"""


def _bfs_mutant(change: str) -> str:
    src = BFS_REFERENCE
    if change == "cells":  # counts cells instead of moves
        return src.replace("dist = {start: 0}", "dist = {start: 1}")
    if change == "diagonal":  # diagonal moves allowed
        return src.replace(
            "((1, 0), (-1, 0), (0, 1), (0, -1))",
            "((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))",
        )
    if change == "zero":  # unreachable goal -> 0
        return src.replace("    return -1\n", "    return 0\n").replace("        return 0\n", "        return -1\n", 1)
    raise ValueError(change)


BFS_MUTANTS = [_bfs_mutant("cells"), _bfs_mutant("diagonal"), _bfs_mutant("zero")]
BFS_WRONG = [
    """
import sys


def $func(grid):  # exhaustive DFS over paths: exponential
    sys.setrecursionlimit(1_000_000)
    start = goal = None
    for r, line in enumerate(grid):
        for c, ch in enumerate(line):
            if ch == "S":
                start = (r, c)
            elif ch == "G":
                goal = (r, c)
    best = [-1]
    seen = set()

    def go(r, c, d):
        if (r, c) == goal:
            if best[0] < 0 or d < best[0]:
                best[0] = d
            return
        moves = ((0, 1),) if grid[r][c] == ">" else ((1, 0), (-1, 0), (0, 1), (0, -1))
        for dr, dc in moves:
            nr, nc = r + dr, c + dc
            if 0 <= nr < len(grid) and 0 <= nc < len(grid[nr]) and grid[nr][nc] != "#" and (nr, nc) not in seen:
                seen.add((nr, nc))
                go(nr, nc, d + 1)
                seen.discard((nr, nc))

    seen.add(start)
    go(*start, 0)
    return best[0]
""",
    _bfs_mutant("diagonal"),
]
BFS_TESTS = """
from solution import $func


def test_straight():
    assert $func(["S..G"]) == 3


def test_around_wall():
    assert $func(["S#G", "...", ]) == 4


def test_unreachable():
    assert $func(["S#G"]) == -1


def test_no_diagonal():
    assert $func(["S.", ".G"]) == 2
"""
BFS_RECIPE = """
import random
def make_cases(size, seed):
    rng = random.Random(seed)
    cases = []
    for density in (0.22, 0.3):
        rows = [["#" if rng.random() < density else "." for _ in range(size)] for _ in range(size)]
        rows[0][0], rows[size - 1][size - 1] = "S", "G"
        cases.append(["".join(r) for r in rows])
    open_rows = ["." * size for _ in range(size)]
    open_rows[0] = "S" + open_rows[0][1:]
    open_rows[-1] = open_rows[-1][:-1] + "G"
    cases.append(open_rows)
    return [[g] for g in cases]
"""


def _grid(rng: random.Random, rows: int, cols: int, density: float) -> list[str]:
    g = [["#" if rng.random() < density else "." for _ in range(cols)] for _ in range(rows)]
    cells = [(r, c) for r in range(rows) for c in range(cols)]
    (sr, sc), (gr, gc) = rng.sample(cells, 2)
    g[sr][sc], g[gr][gc] = "S", "G"
    return ["".join(r) for r in g]


def build_bfs(rng: random.Random) -> CodeVariant:
    func = rng.choice(["shortest_route", "min_steps", "path_length"])
    place = rng.choice(["складу", "сортировочному центру", "торговому залу"])
    task = {"func": func}
    basic = [[_grid(rng, rng.randint(4, 12), rng.randint(4, 12), 0.25)] for _ in range(10)]
    edge: list[list[Any]] = [
        [["SG"]],
        [["S#G"]],
        [["S", ".", "G"]],
        [["S.", ".G"]],
        [["S#.", "##.", "..G"]],
        [["S...", "###.", "G..."]],
        [[".S.", "###", ".G."]],
    ]
    belts = ["".join(rng.choice("..>#") for _ in range(8)) for _ in range(3)]
    inc: list[list[Any]] = [
        [["S>.G"]],
        [["S.>G"]],
        [["S>#", ".>G"]],
        [["G>.S"]],
        [["S..", ">#.", "G.."]],
        [[".>.", "S#G"]],
        [[*belts, "S>>>>>>G"]],
    ]
    statement = f"""\
Реализуйте функцию `{func}(grid)` в файле `solution.py`.

Курьер-робот перемещается по {place}. Карта `grid` — список строк одинаковой длины: `S` — старт, `G` — цель, `#` — стеллаж (проход закрыт), `.` — свободная клетка. За один ход робот сдвигается на соседнюю клетку вверх, вниз, влево или вправо (по диагонали нельзя).

Верните **наименьшее число ходов** от `S` до `G` или `-1`, если дойти нельзя. На карте ровно одна `S` и одна `G`.

Карты на проверке — до 300 × 300 клеток: перебор всех путей не уложится по времени.

#### Примеры
| Вызов | Результат |
|---|---|
| `{func}(["S..G"])` | `3` |
| `{func}(["S#G", "..."])` | `4` |

В `test_solution.py` напишите собственные тесты: они оцениваются отдельно — должны проходить на правильном решении и находить типичные ошибки."""
    return CodeVariant(
        func=func,
        statement=statement,
        files={
            "solution.py": f'def {func}(grid):\n    """Наименьшее число ходов от S до G или -1."""\n    # TODO: реализуйте поиск пути\n    return -1\n',
            "test_solution.py": f'from solution import {func}\n\n\ndef test_example():\n    assert {func}(["S..G"]) == 3\n{TEST_HINT}',
        },
        examples=[CodeExample(args=[["S..G"]], expected=3), CodeExample(args=[["S#G", "..."]], expected=4)],
        hidden={
            "basic": basic,
            "edge": edge,
            "perf": {"recipe": BFS_RECIPE.strip(), "kwargs": {"size": 300, "seed": rng.randrange(1 << 30)}},
            "inc_conveyor": inc,
        },
        task=task,
        incidents=[
            Incident(
                id="inc_conveyor",
                after_min=(2, 5),
                message=(
                    "Изменение на объекте: установили конвейерные ленты. Клетка `>` проходима, но с неё можно сделать ход "
                    "только вправо (зайти на неё можно с любой стороны)."
                ),
            )
        ],
        checks=_checks("inc_conveyor", "Учтено новое требование: конвейеры «>» ведут только вправо", 6.0),
        params={"place": place},
    )


# ---------------------------------------------------------------- registry


@dataclass(frozen=True)
class CodeTask:
    build: Any  # Callable[[random.Random], CodeVariant]
    reference: str
    mutants: list[str]
    wrong: list[str]
    tests: str


TASKS: dict[str, CodeTask] = {
    "alg_binary_search": CodeTask(build_binary_search, BS_REFERENCE, BS_MUTANTS, BS_WRONG, BS_TESTS),
    "alg_brackets": CodeTask(build_brackets, BR_REFERENCE, BR_MUTANTS, BR_WRONG, BR_TESTS),
    "alg_bfs": CodeTask(build_bfs, BFS_REFERENCE, BFS_MUTANTS, BFS_WRONG, BFS_TESTS),
}


def reference_source(builder: str, task: dict[str, Any]) -> str:
    return _src(TASKS[builder].reference, task)


def mutant_sources(builder: str, task: dict[str, Any]) -> list[str]:
    return [_src(m, task) for m in TASKS[builder].mutants]


def wrong_sources(builder: str, task: dict[str, Any]) -> list[str]:
    return [_src(m, task) for m in TASKS[builder].wrong]


def reference_tests(builder: str, task: dict[str, Any]) -> str:
    return _src(TASKS[builder].tests, task)
