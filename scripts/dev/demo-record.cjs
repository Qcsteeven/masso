// Records the demo fixtures (frontend/src/demo/fixtures.json) from a running stand, step 1 of 2: every /api response
// the real UI receives per role. Users must be anonymised in the stand DB first (Обучающийся 1…6, student1…6@masso.local).
// Run from frontend/: PW_CHROMIUM=<chrome> node ../scripts/dev/demo-record.cjs, then demo-record-api.cjs.
// Records every /api response the real UI receives, per role, into src/demo/fixtures.json (demo mode data).
const { chromium } = require(require.resolve("@playwright/test", { paths: [process.cwd()] }));
const fs = require("fs");
const B = "http://localhost", PW = "masso-demo";
const rec = {}; // key "role|METHOD path?query" -> {status, body}
const keyOf = (role, method, u) => {
  const url = new URL(u); const q = [...url.searchParams].filter(([k]) => !["from", "to", "token"].includes(k)).sort();
  return `${role}|${method} ${url.pathname}${q.length ? "?" + new URLSearchParams(q) : ""}`;
};
async function apiCall(token, method, path, body) {
  const r = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
async function tokenOf(email) { return (await apiCall(null, "POST", "/api/auth/login", { email, password: PW })).data.access_token; }
(async () => {
  const extra = {};
  // document sessions for templates (student2), and hidden specs via methodist
  const st2 = await tokenOf("student2@masso.local"), meth = await tokenOf("methodist@masso.local");
  const tpls = (await apiCall(st2, "GET", "/api/scenarios/templates")).data;
  extra.templates = {};
  for (const t of tpls) {
    const run = (await apiCall(st2, "POST", "/api/scenarios/generate", { template_id: t.id })).data;
    const spec = (await apiCall(meth, "GET", `/api/scenarios/runs/${run.run_id}`)).data;
    let view = null;
    if (t.kind === "document") view = (await apiCall(st2, "POST", "/api/sessions", { run_id: run.run_id })).data;
    extra.templates[t.code] = { template: t, run, spec, view };
  }
  const st1 = await tokenOf("student1@masso.local");
  const mine = (await apiCall(st1, "GET", "/api/sessions/mine")).data;
  extra.student1_sessions = mine;
  for (const s of (Array.isArray(mine) ? mine : mine.items || [])) if (s.status === "active") extra.devops_view = (await apiCall(st1, "GET", `/api/sessions/${s.id}`)).data;

  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  const roles = {
    student: ["student1@masso.local", ["/student", "/student/reports", "/student/skills"]],
    teacher: ["teacher@masso.local", ["/teacher", "/teacher/assignments", "/teacher/export"]],
    methodist: ["methodist@masso.local", ["/methodist/skills", "/methodist/targets", "/methodist/templates"]],
    admin: ["admin@masso.local", ["/admin/users", "/admin/llm", "/admin/audit", "/sysadmin"]],
    sysadmin: ["ops@masso.local", ["/sysadmin", "/sysadmin/audit"]],
  };
  for (const [role, [email, routes]] of Object.entries(roles)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("response", async (r) => {
      const u = r.url(); if (!u.includes("/api/") || u.includes("/api/auth/login") || u.includes("/api/auth/refresh")) return;
      try { const body = await r.json(); rec[keyOf(role, r.request().method(), u)] = { status: r.status(), body }; } catch {}
    });
    await page.goto(B + "/login");
    await page.getByLabel("Email").fill(email); await page.getByLabel("Пароль").fill(PW);
    await page.getByRole("button", { name: /Войти/ }).click(); await page.waitForURL((u) => !u.pathname.endsWith("/login"));
    for (const r of routes) {
      await page.goto(B + r); await page.waitForTimeout(1500);
      for (const b of await page.getByRole("button", { name: /Применить|Показать/ }).all()) { await b.click().catch(() => {}); await page.waitForTimeout(800); }
      const links = await page.locator("a[href^='/student/reports/'], a[href^='/teacher/sessions/'], a[href^='/methodist/templates/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
      for (const l of links) { await page.goto(B + l); await page.waitForTimeout(1500); }
      if (r === "/methodist/skills") for (const d of await page.locator("aside button, [role=tree] button, button:has-text('Экономика'), button:has-text('Юрис'), button:has-text('Информац')").all()) { await d.click().catch(() => {}); await page.waitForTimeout(600); }
      if (r === "/admin/users") { const rows = await page.locator("tbody tr").all(); for (const row of rows.slice(0, 10)) { await row.click().catch(() => {}); await page.waitForTimeout(400); } }
    }
    if (role === "student" && extra.devops_view) { await page.goto(B + `/student/sessions/${extra.devops_view.id}`); await page.waitForTimeout(2500); }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync("src/demo/fixtures.json", JSON.stringify({ recorded: rec, extra }));
  console.log("keys:", Object.keys(rec).length); console.log(Object.keys(rec).sort().join("\n"));
})().catch((e) => { console.error(e); process.exit(1); });
