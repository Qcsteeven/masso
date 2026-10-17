"""Load test (ТЗ 6.3 «Нагрузка», спека §12): N parallel DevOps sessions through the public API.

Each worker logs in as a demo student, generates a variant, starts a session (= the sandbox is deployed),
checks that the session is active, then submits it so the sandbox is removed. Reported: mean/p50/p95 of
generation and of deployment (session start), submit/cleanup time, error share and the containers left behind.

Usage (stack is up and seeded):
    cd backend && uv run python ../scripts/loadtest.py -n 6 [--base http://localhost:8080] [--template CODE]
The demo password is taken from SEED_DEFAULT_PASSWORD (default masso-demo). With -n above the six demo students
the missing ones (load-NN@masso.local, group LOAD) are created through the admin API as admin@masso.local.
The server-side cap SANDBOX_MAX_SESSIONS (default 20) must be at least N, otherwise extra sessions get
SANDBOX_LIMIT_EXCEEDED. Acceptance (ТЗ 6.3, 4.7): 100 % of sessions start, error share < 1 %, mean deployment
≤ 120 s; generation (≤ 120 s) is reported separately.
"""

import argparse
import asyncio
import os
import statistics
import subprocess
import time
from dataclasses import dataclass, field

import httpx

STUDENTS = [
    "demonov.la@masso.local",
    "ivanov.as@masso.local",
    "petrova.md@masso.local",
    "kim.ea@masso.local",
    "orlova.dp@masso.local",
    "zakharov.ni@masso.local",
]


@dataclass
class Result:
    user: str
    ok: bool = False
    deploy_s: float | None = None
    submit_s: float | None = None
    score: int | None = None
    error: str = ""
    stages: dict[str, float] = field(default_factory=dict)


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    s = sorted(values)
    k = (len(s) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


async def one(client: httpx.AsyncClient, email: str, password: str, template_code: str) -> Result:
    res = Result(email)
    try:
        r = await client.post("/api/auth/login", json={"email": email, "password": password})
        r.raise_for_status()
        h = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
        tpls = (await client.get("/api/scenarios/templates", headers=h)).json()["data"]
        tid = next(t["id"] for t in tpls if t["code"] == template_code)
        t0 = time.perf_counter()
        gen = (await client.post("/api/scenarios/generate", headers=h, json={"template_id": tid})).json()
        if gen["status"] != "success":
            raise RuntimeError(f"generate: {gen['error']['code']} {gen['error']['message']}")
        res.stages["generate_s"] = time.perf_counter() - t0
        st = (await client.post("/api/sessions", headers=h, json={"run_id": gen["data"]["run_id"]})).json()
        if st["status"] != "success":
            raise RuntimeError(f"session: {st['error']['code']} {st['error']['message']}")
        res.deploy_s = time.perf_counter() - t0
        sid = st["data"]["id"]
        if st["data"]["status"] != "active":
            raise RuntimeError(f"session status {st['data']['status']}")
        t1 = time.perf_counter()
        sub = (await client.post(f"/api/sessions/{sid}/submit", headers=h)).json()
        if sub["status"] != "success":
            raise RuntimeError(f"submit: {sub['error']['code']}")
        res.submit_s = time.perf_counter() - t1
        res.score = sub["data"]["score"]["final"]
        res.ok = True
    except Exception as exc:
        res.error = str(exc)[:200]
    return res


async def ensure_students(client: httpx.AsyncClient, n: int, password: str) -> list[str]:
    """Demo students first; for n > 6 create load-NN students (idempotent)."""
    emails = STUDENTS[:n] + [f"load-{i:02d}@masso.local" for i in range(1, max(0, n - len(STUDENTS)) + 1)]
    if n <= len(STUDENTS):
        return emails
    r = await client.post("/api/auth/login", json={"email": "admin@masso.local", "password": password})
    r.raise_for_status()
    h = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
    for e in emails[len(STUDENTS) :]:
        body = {"email": e, "full_name": f"Нагрузочный {e[:7]}", "password": password, "group_code": "LOAD"}
        r = await client.post("/api/users", headers=h, json=body | {"roles": ["student"]})
        if r.status_code not in (200, 201) and "уже существует" not in r.text:
            raise RuntimeError(f"create {e}: {r.text[:200]}")
    return emails


def leftover_containers() -> int | None:
    try:
        out = subprocess.run(
            ["docker", "ps", "-q", "--filter", "label=masso.kind=session"],  # noqa: S607
            capture_output=True,
            text=True,
            timeout=10,
        )
        return len(out.stdout.split())
    except (OSError, subprocess.SubprocessError):
        return None


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=6, help="parallel sessions, one per student")
    ap.add_argument("--base", default=os.environ.get("E2E_BASE_URL", "http://localhost:8080"))
    ap.add_argument("--template", default="devops.web_recovery")
    args = ap.parse_args()
    n = max(1, args.n)
    password = os.environ.get("SEED_DEFAULT_PASSWORD", "masso-demo")
    limits = httpx.Limits(max_connections=n + 10, max_keepalive_connections=n + 10)
    async with httpx.AsyncClient(base_url=args.base, timeout=600, limits=limits) as client:
        emails = await ensure_students(client, n, password)
        t0 = time.perf_counter()
        results = await asyncio.gather(*(one(client, e, password, args.template) for e in emails))
        total = time.perf_counter() - t0
    await asyncio.sleep(3)
    gen = [r.stages["generate_s"] for r in results if r.deploy_s is not None]
    start = [r.deploy_s - r.stages["generate_s"] for r in results if r.deploy_s is not None]
    total_ready = [r.deploy_s for r in results if r.deploy_s is not None]
    submit = [r.submit_s for r in results if r.submit_s is not None]
    errors = [r for r in results if not r.ok]
    print(f"Сессий: {n}, шаблон {args.template}, общее время {total:.1f} с")
    for r in results:
        line = f"  {r.user:28} {'OK ' if r.ok else 'ERR'}"
        if r.deploy_s is not None:
            g = r.stages["generate_s"]
            line += f" генерация {g:5.1f} с · запуск среды {r.deploy_s - g:5.1f} с"
        if r.submit_s is not None:
            line += f" · проверка+очистка {r.submit_s:5.1f} с · балл {r.score}"
        if r.error:
            line += f" · {r.error}"
        print(line)
    for title, values in (
        ("Генерация (с прогоном валидации)", gen),
        ("Запуск среды (развёртывание)", start),
        ("Генерация + запуск", total_ready),
        ("Проверка и очистка", submit),
    ):
        if values:
            print(
                f"{title}: среднее {statistics.mean(values):.1f} с, p50 {pct(values, 0.5):.1f} с, "
                f"p95 {pct(values, 0.95):.1f} с, max {max(values):.1f} с"
            )
    print(f"Доля ошибок: {len(errors)}/{n} = {100 * len(errors) / n:.0f} %")
    left = leftover_containers()
    print(f"Учебных контейнеров после завершения: {'n/a' if left is None else left}")
    if start:
        # ТЗ 4.7: generation ≤ 120 s and deployment ≤ 120 s are separate limits; ТЗ 6.3 checks the mean deployment
        ok = not errors and statistics.mean(gen) <= 120 and statistics.mean(start) <= 120
        verdict = "выполнен" if ok else "НЕ выполнен"
        print(f"Критерий ТЗ 6.3/4.7 (100 % стартов, ошибок < 1 %, генерация и развёртывание ≤ 120 с): {verdict}")


if __name__ == "__main__":
    asyncio.run(main())
