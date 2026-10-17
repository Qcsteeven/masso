"""Load test (ТЗ 6.3 «Нагрузка», спека §12): N parallel DevOps sessions through the public API.

Each worker logs in as a demo student, generates a variant, starts a session (= the sandbox is deployed),
checks that the session is active, then submits it so the sandbox is removed. Reported: p50/p95 of
deployment (generate + start), submit/cleanup time, error share and the containers left behind.

Usage (stack is up and seeded):
    cd backend && uv run python ../scripts/loadtest.py -n 6 [--base http://localhost:8080] [--template devops.web_recovery]
The demo password is taken from SEED_DEFAULT_PASSWORD (default masso-demo).
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


def leftover_containers() -> int | None:
    try:
        out = subprocess.run(
            ["docker", "ps", "-q", "--filter", "label=masso.kind=session"], capture_output=True, text=True, timeout=10
        )
        return len(out.stdout.split())
    except (OSError, subprocess.SubprocessError):
        return None


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=6, help="parallel sessions (one per demo student, max 6)")
    ap.add_argument("--base", default=os.environ.get("E2E_BASE_URL", "http://localhost:8080"))
    ap.add_argument("--template", default="devops.web_recovery")
    args = ap.parse_args()
    n = max(1, min(args.n, len(STUDENTS)))
    password = os.environ.get("SEED_DEFAULT_PASSWORD", "masso-demo")
    async with httpx.AsyncClient(base_url=args.base, timeout=300) as client:
        t0 = time.perf_counter()
        results = await asyncio.gather(*(one(client, e, password, args.template) for e in STUDENTS[:n]))
        total = time.perf_counter() - t0
    await asyncio.sleep(3)
    deploy = [r.deploy_s for r in results if r.deploy_s is not None]
    submit = [r.submit_s for r in results if r.submit_s is not None]
    errors = [r for r in results if not r.ok]
    print(f"Сессий: {n}, шаблон {args.template}, общее время {total:.1f} с")
    for r in results:
        line = f"  {r.user:28} {'OK ' if r.ok else 'ERR'}"
        if r.deploy_s is not None:
            line += f" развёртывание {r.deploy_s:5.1f} с"
        if r.submit_s is not None:
            line += f" · проверка+очистка {r.submit_s:5.1f} с · балл {r.score}"
        if r.error:
            line += f" · {r.error}"
        print(line)
    print(f"Развёртывание: p50 {pct(deploy, 0.5):.1f} с, p95 {pct(deploy, 0.95):.1f} с, max {max(deploy, default=float('nan')):.1f} с")
    if submit:
        print(f"Проверка и очистка: p50 {pct(submit, 0.5):.1f} с, p95 {pct(submit, 0.95):.1f} с")
    print(f"Доля ошибок: {len(errors)}/{n} = {100 * len(errors) / n:.0f} %")
    left = leftover_containers()
    print(f"Учебных контейнеров после завершения: {'n/a' if left is None else left}")
    if deploy:
        print(f"Среднее развёртывание {statistics.mean(deploy):.1f} с (требование ТЗ: среда готова ≤ 60 с)")


if __name__ == "__main__":
    asyncio.run(main())
