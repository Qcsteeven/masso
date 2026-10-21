// Records the demo fixtures, step 2 of 2: API reads the UI crawl misses and the paused DevOps session view.
const fs = require("fs");
const B = "http://localhost", PW = "masso-demo";
const F = "src/demo/fixtures.json";
const d = JSON.parse(fs.readFileSync(F, "utf8"));
async function call(token, method, path) {
  const r = await fetch(B + path, { method, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: r.status, body: await r.json() };
}
const tok = async (e) => (await (await fetch(B + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: PW }) })).json()).data.access_token;
const key = (role, path) => { const u = new URL(B + path); const q = [...u.searchParams].filter(([k]) => !["from", "to"].includes(k)).sort(); return `${role}|GET ${u.pathname}${q.length ? "?" + new URLSearchParams(q) : ""}`; };
(async () => {
  const period = "from=2026-09-01T00:00:00Z&to=2026-12-31T00:00:00Z";
  const t = { student: await tok("student1@masso.local"), teacher: await tok("teacher@masso.local"), methodist: await tok("methodist@masso.local"), admin: await tok("admin@masso.local"), sysadmin: await tok("ops@masso.local") };
  const paths = {
    student: ["/api/scenarios/templates", "/api/llm/status", "/api/sessions/mine", ...["devops", "security", "legal", "audit"].map((x) => `/api/skills/recommendations?domain=${x}`)],
    admin: [`/api/admin/audit?${period}`, `/api/admin/security-events?${period}`, "/api/skills/graph", "/api/llm/status"],
    sysadmin: [`/api/admin/audit?${period}`, `/api/admin/security-events?${period}`, "/api/llm/status"],
    methodist: ["/api/llm/status", "/api/scenarios/spec-schema"],
    teacher: [`/api/reports?group=${encodeURIComponent("ИСИб-23-1")}&${period}`],
  };
  for (const [role, ps] of Object.entries(paths)) for (const p of ps) { const r = await call(t[role], "GET", p); d.recorded[key(role, p)] = r; console.log(role, p, r.status); }
  const sid = d.extra.student1_sessions.find((s) => s.status !== "completed").id;
  d.extra.devops_view = (await call(t.student, "GET", `/api/sessions/${sid}`)).body.data;
  console.log("devops view status", d.extra.devops_view.status, Object.keys(d.extra.devops_view.scenario));
  fs.writeFileSync(F, JSON.stringify(d));
})();
