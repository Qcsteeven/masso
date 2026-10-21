// Demo mode only (VITE_DEMO=true, the GitHub Pages build): the whole MASSO backend imitated in the browser.
// Screens show data recorded from a real stand (fixtures.json); the student flow is stateful: generation, a training
// server with a terminal (server.ts), an incident, hints, checks, a report — and the teacher sees the new session.

import fixtures from "./fixtures.json";
import { applyIncident, exec, newServer, runChecks, type Fault, type ServerState } from "./server";

type Role = "student" | "teacher" | "methodist" | "admin" | "sysadmin";
type Json = Record<string, unknown>;
interface Recorded { status: number; body: { status: string; data?: unknown; error?: unknown } }
interface DemoEvent { id: string; session_id: string; type: string; severity: string; payload: Json; created_at: string }
interface DemoSession {
  id: string;
  code: string;
  kind: "container" | "document";
  status: string;
  started_at: string;
  finished_at: string | null;
  paused_at: number | null;
  incident_due: number;
  incident_applied: boolean;
  hints: { number: number; text: string; created_at: string }[];
  events: DemoEvent[];
  answers: Json;
  documents: { id: string; title: string; markdown: string }[];
  server: ServerState | null;
  report: Json | null;
  verification: Json | null;
}
interface DemoDb { role: Role | null; mode: string; sessions: DemoSession[]; runs: Record<string, string> }

const F = fixtures as unknown as {
  recorded: Record<string, Recorded>;
  extra: {
    templates: Record<string, { template: Json; spec: { spec: Json }; view: Json | null }>;
    devops_view: Json;
    files: Record<string, string>;
    student1_sessions: Json[];
  };
};

export const DEMO_ACCOUNTS: { role: Role; email: string; label: string }[] = [
  { role: "student", email: "student1@masso.local", label: "Обучающийся" },
  { role: "teacher", email: "teacher@masso.local", label: "Преподаватель" },
  { role: "methodist", email: "methodist@masso.local", label: "Методист" },
  { role: "admin", email: "admin@masso.local", label: "Администратор" },
  { role: "sysadmin", email: "ops@masso.local", label: "Системный администратор" },
];
export const DEMO_PASSWORD = "masso-demo";
export const INCIDENT_AFTER_SEC = 75;
const KEY = "masso-demo-db";
const NOT_IN_DEMO = "В демо-версии это действие не сохраняется. Полная система разворачивается по инструкции в README.";
const PAUSED_FIXTURE = F.extra.student1_sessions.find((s) => s.status !== "completed")?.id as string | undefined;

let db: DemoDb = load();
const listeners = new Map<string, Set<(e: DemoEvent) => void>>();

function load(): DemoDb {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoDb;
  } catch { /* storage unavailable */ }
  return { role: null, mode: "external", sessions: [], runs: {} };
}
function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage unavailable */ }
}

const uid = () => crypto.randomUUID();
const iso = (t = Date.now()) => new Date(t).toISOString();
const ok = (data: unknown, status = 200) => ({ status, body: { request_id: uid(), status: "success", data } });
const err = (code: string, message: string, status: number, details: Json = {}) =>
  ({ status, body: { request_id: uid(), status: "error", error: { code, message, details } } });

function recorded(role: Role, method: string, path: string, query: URLSearchParams): Recorded | undefined {
  const q = [...query].filter(([k]) => k !== "from" && k !== "to").sort();
  const exact = `${role}|${method} ${path}${q.length ? "?" + new URLSearchParams(q).toString() : ""}`;
  if (F.recorded[exact]) return F.recorded[exact];
  const prefix = `|${method} ${path}`;
  const sameRole = Object.keys(F.recorded).find((k) => k.startsWith(role + prefix) && (k.length === (role + prefix).length || k[(role + prefix).length] === "?"));
  if (sameRole) return F.recorded[sameRole];
  const any = Object.keys(F.recorded).find((k) => k.slice(k.indexOf("|")) === prefix);
  return any ? F.recorded[any] : undefined;
}
const recData = <T>(role: Role, path: string, q = new URLSearchParams()) => recorded(role, "GET", path, q)?.body.data as T | undefined;

// --- events ------------------------------------------------------------------------------------------------------

function push(s: DemoSession, type: string, payload: Json, severity = "info", notify = true): DemoEvent {
  const e: DemoEvent = { id: uid(), session_id: s.id, type, severity, payload, created_at: iso() };
  s.events.push(e);
  if (notify && type !== "command" && type !== "answer") listeners.get(s.id)?.forEach((cb) => cb(e));
  return e;
}

function security(s: DemoSession, kind: string, cmd: string) {
  push(s, "security", { kind, cmd, message: "Действие заблокировано политикой учебной среды." }, "critical");
}

/** Worker imitation: applies the incident when it is due (called on every request and every second). */
function tick() {
  const now = Date.now();
  let changed = false;
  for (const s of db.sessions) {
    if (s.status !== "active" || s.incident_applied || now < s.incident_due) continue;
    s.incident_applied = true;
    const spec = specOf(s.code);
    const inc = (spec.incidents as Json[] | undefined)?.[0];
    if (!inc) continue;
    if (s.server) applyIncident(s.server, now);
    const mut = inc.mutation as { doc_id: string; find: string; replace: string } | null;
    if (mut) {
      const d = s.documents.find((x) => x.id === mut.doc_id);
      if (d) d.markdown = d.markdown.replace(mut.find, mut.replace);
    }
    push(s, "incident", { id: inc.id, message: inc.message, document: mut?.doc_id ?? null }, "warning");
    changed = true;
  }
  if (changed) save();
}
setInterval(tick, 1000);

const specOf = (code: string) => F.extra.templates[code].spec.spec;

// --- views -------------------------------------------------------------------------------------------------------

function scenarioOf(code: string): Json {
  const t = F.extra.templates[code];
  return (t.view ? t.view.scenario : F.extra.devops_view.scenario) as Json;
}

function view(s: DemoSession): Json {
  const sc: Json = { ...scenarioOf(s.code), documents: s.documents };
  const limit = Number(sc.time_limit_min) * 60;
  const ref = s.status === "paused" && s.paused_at ? s.paused_at : Date.now();
  const elapsed = Math.floor((ref - Date.parse(s.started_at)) / 1000);
  return {
    id: s.id, run_id: sc.run_id, status: s.status, kind: s.kind, started_at: s.started_at, finished_at: s.finished_at,
    time_limit_min: sc.time_limit_min, remaining_sec: Math.max(0, limit - elapsed), hints_used: s.hints.length, hints_max: 3,
    scenario: sc, answers: s.answers, events: s.events.filter((e) => e.type !== "command"),
  };
}

function startSession(code: string): DemoSession {
  const tpl = F.extra.templates[code];
  const kind = tpl.template.kind as "container" | "document";
  const now = Date.now();
  const spec = specOf(code);
  const chosen = (spec.chosen as Json | undefined)?.initial_fault as Fault | undefined;
  const s: DemoSession = {
    id: uid(), code, kind, status: "active", started_at: iso(now), finished_at: null, paused_at: null,
    incident_due: now + INCIDENT_AFTER_SEC * 1000, incident_applied: false, hints: [], events: [], answers: {},
    documents: kind === "document" ? structuredClone(scenarioOf(code).documents as DemoSession["documents"]) : [],
    server: kind === "container" ? newServer(F.extra.files, chosen ?? "db_wrong_user", now) : null,
    report: null, verification: null,
  };
  push(s, "status", { status: "starting", message: "Подготовка учебной среды…" }, "info", false);
  push(s, "status", { status: "active", message: "Учебная среда готова.", startup_sec: 6.4 }, "info", false);
  db.sessions.push(s);
  return s;
}

// --- checks and report -------------------------------------------------------------------------------------------

const NUM = /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;
const nums = (t: string) => new Set((t.match(NUM) ?? []).map((x) => x.replace(/\s/g, "").replace(",", ".")));
const hasNum = (found: Set<string>, exp: string) => {
  const e = exp.replace(/\s/g, "").replace(",", ".");
  return [...found].some((n) => n === e || (!e.includes(".") && n.split(".")[0] === e));
};
const norm = (t: string) => t.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

/** Light port of the Verification Engine for the document checks of the recorded variants. */
function documentChecks(s: DemoSession): Json[] {
  const spec = specOf(s.code);
  const findings = ((s.answers.findings as Json[] | undefined) ?? []).filter((f) => f && typeof f === "object");
  return (spec.checks as Json[]).map((c) => {
    const p = c.params as Json;
    let passed = false;
    let skipped = false;
    if (p.requires_incident && !s.incident_applied) { passed = true; skipped = true; }
    else if (c.type === "rule_match" && p.defect_type) {
      const f = findings.find((x) => x.defect_type === p.defect_type && (!p.section || String(x.section ?? "") === p.section));
      const must = (p.must_contain as string[] | undefined) ?? [];
      const n = f ? nums(`${String(f.comment ?? "")} ${String(f.proposed_text ?? "")}`) : new Set<string>();
      passed = !!f && (!must.length || (n.size <= Number(p.max_numbers ?? 3) && must.every((m) => hasNum(n, m))));
    } else if (c.type === "rule_match") {
      passed = String(s.answers[String(p.field)] ?? "") === String(p.expected);
    } else if (c.type === "numeric_match") {
      const v = Number(String(s.answers[String(p.field)] ?? "").replace(/\s/g, "").replace(",", "."));
      const exp = Number(p.expected);
      passed = Number.isFinite(v) && Math.abs((p.abs ? Math.abs(v) - Math.abs(exp) : v - exp)) <= Number(p.tolerance ?? 0.01);
    } else if (c.type === "semantic_similarity") {
      const f = p.defect_type ? findings.find((x) => x.defect_type === p.defect_type) : null;
      const text = p.defect_type ? String(f?.proposed_text ?? "") : String(s.answers[String(p.field ?? "")] ?? "");
      const must = (p.must_contain as string[] | undefined) ?? [];
      const n = nums(text);
      passed = !!text.trim() && must.length > 0 && must.every((m) => /^[\d\s.,]+$/.test(m) ? hasNum(n, m) && n.size <= 3 : norm(text).includes(norm(m)));
    }
    return { id: c.id, title: c.title, type: c.type, weight: c.weight, critical: !!c.critical, passed, skipped, judge: "" };
  });
}

function containerChecks(s: DemoSession): Json[] {
  const defs = (specOf(s.code).checks as Json[]);
  const res = new Map(runChecks(s.server!).map((r) => [r.id, r.passed]));
  return defs.map((c) => ({ id: c.id, title: c.title, type: c.type, weight: c.weight, critical: !!c.critical, passed: res.get(String(c.id)) ?? true, skipped: false, judge: "" }));
}

function score(checks: Json[], hints: number, violations: number, threshold: number): Json {
  const used = checks.filter((c) => !c.skipped);
  const total = used.reduce((a, c) => a + Number(c.weight), 0) || 1;
  let base = Math.round((100 * used.reduce((a, c) => a + (c.passed ? Number(c.weight) : 0), 0)) / total);
  const criticalFailed = used.some((c) => c.critical && !c.passed);
  if (criticalFailed) base = Math.min(base, 49);
  const final = Math.max(0, Math.round(base * (1 - 0.1 * hints)) - 10 * violations);
  return {
    base, final, passed: final >= threshold, critical_failed: criticalFailed, hints, violations, threshold,
    formula: `${base} × (1 − 0,1 × ${hints}) − 10 × ${violations} = ${final}`,
  };
}

function submit(s: DemoSession): Json {
  const spec = specOf(s.code);
  const checks = s.kind === "container" ? containerChecks(s) : documentChecks(s);
  const violations = s.events.filter((e) => e.type === "security").length;
  const sc = score(checks, s.hints.length, violations, Number((spec.success as Json | undefined)?.threshold ?? 75));
  const now = Date.now();
  s.status = "completed";
  s.finished_at = iso(now);
  push(s, "status", { status: "checking", message: "Результат отправлен на проверку." });
  for (const c of checks) push(s, "check", { id: c.id, title: c.title, passed: c.passed, critical: c.critical }, c.passed ? "info" : "warning", false);
  const errors = checks.filter((c) => !c.passed).map((c) => ({ check: c.title, critical: c.critical }));
  const base = recData<Json>("student", `/api/reports/by-session/${String(F.extra.student1_sessions.find((x) => x.status === "completed")?.id)}`);
  const skillChanges = ((base?.skill_changes as Json[] | undefined) ?? []).map((c) => ({ ...c, passed: sc.passed }));
  s.report = {
    id: uid(), session_id: s.id, title: scenarioOf(s.code).title, domain: scenarioOf(s.code).domain, kind: s.kind,
    legend: scenarioOf(s.code).legend, score: sc, checks: checks.map(({ type: _t, judge: _j, ...c }) => c), errors,
    hints: s.hints.map((h) => ({ ...h, penalty_percent: 10 })),
    incidents: s.events.filter((e) => e.type === "incident").map((e) => ({ message: e.payload.message, created_at: e.created_at })),
    violations, commands: s.events.filter((e) => e.type === "command").length,
    time_spent_sec: Math.round((now - Date.parse(s.started_at)) / 1000), time_limit_min: scenarioOf(s.code).time_limit_min,
    skill_changes: sc.passed ? skillChanges : [], recommendation: base?.recommendation ?? null, teacher: null,
    student: { id: "demo-student", full_name: "Обучающийся 1", group: "ИСИб-23-1" }, created_at: iso(now),
  };
  s.verification = {
    session_id: s.id, checks, base_score: sc.base, final_score: sc.final, status: sc.passed ? "passed" : "failed", errors,
    corrected_score: null, correction_reason: null, corrected_by: null, review_status: "pending", created_at: iso(now),
  };
  push(s, "status", { status: "completed", score: sc.final, passed: sc.passed, report_id: s.report.id, message: "Проверка завершена." });
  return { report_id: s.report.id, status: "completed", score: sc };
}

// --- router ------------------------------------------------------------------------------------------------------

const find = (id: string) => db.sessions.find((s) => s.id === id);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ROLE_BY_EMAIL = Object.fromEntries(DEMO_ACCOUNTS.map((a) => [a.email, a.role]));

async function handle(method: string, url: URL, body: Json): Promise<Recorded> {
  tick();
  const p = url.pathname;
  const role = db.role;
  if (p === "/api/auth/login") {
    const r = ROLE_BY_EMAIL[String(body.email ?? "").trim().toLowerCase()] as Role | undefined;
    if (!r || body.password !== DEMO_PASSWORD) return err("AUTH_INVALID_CREDENTIALS", "Неверный email или пароль.", 401);
    db.role = r;
    save();
    return ok({ access_token: `demo.${r}`, expires_in: 900, user: recData(r, "/api/auth/me") });
  }
  if (p === "/api/auth/refresh") return role ? ok({ access_token: `demo.${role}`, expires_in: 900 }) : err("AUTH_INVALID_CREDENTIALS", "Сессия истекла. Войдите снова.", 401);
  if (p === "/api/auth/logout") { db.role = null; save(); return ok({}); }
  if (!role) return err("AUTH_INVALID_CREDENTIALS", "Требуется вход в систему.", 401);
  await sleep(120 + Math.random() * 200);

  // --- student flow
  if (p === "/api/scenarios/generate" && method === "POST") {
    const tpl = Object.values(F.extra.templates).find((t) => t.template.id === body.template_id);
    if (!tpl) return err("NOT_FOUND", "Шаблон не найден.", 404);
    await sleep(1800);
    const runId = uid();
    db.runs[runId] = String(tpl.template.code);
    save();
    return ok({ run_id: runId, status: "published", generation_mode: db.mode === "external" ? "template" : db.mode, duration_ms: 1800 }, 201);
  }
  if (p === "/api/sessions" && method === "POST") {
    const code = db.runs[String(body.run_id)];
    if (!code) return err("NOT_FOUND", "Сценарий не найден.", 404);
    const busy = db.sessions.find((s) => s.kind === "container" && (s.status === "active" || s.status === "paused"));
    if (F.extra.templates[code].template.kind === "container" && busy) {
      return err("SESSION_NOT_READY", "У вас уже есть незавершённая сессия с учебным сервером. Завершите её, чтобы начать новую.", 409);
    }
    await sleep(1200);
    const s = startSession(code);
    save();
    return ok(view(s), 201);
  }
  const sm = /^\/api\/sessions\/([^/]+)(?:\/(.+))?$/.exec(p);
  if (sm && sm[1] !== "mine") {
    const s = find(sm[1]);
    if (!s) return err("NOT_FOUND", "Сессия не найдена: демо-данные хранятся только в этой вкладке браузера.", 404);
    const action = sm[2];
    if (!action) return ok(view(s));
    if (action === "ws-token") return ok({ token: `demo.${s.id}`, expires_in: 60 });
    if (action === "pause" && s.status === "active") { s.status = "paused"; s.paused_at = Date.now(); push(s, "status", { status: "paused", message: "Сессия приостановлена." }); save(); return ok(view(s)); }
    if (action === "resume" && s.status === "paused") {
      const shift = Date.now() - (s.paused_at ?? Date.now());
      s.started_at = iso(Date.parse(s.started_at) + shift);
      s.incident_due += shift;
      s.status = "active"; s.paused_at = null;
      push(s, "status", { status: "active", message: "Сессия возобновлена." });
      save();
      return ok(view(s));
    }
    if (action === "answers") {
      s.answers = (body.answers as Json) ?? {};
      push(s, "answer", { findings: ((s.answers.findings as unknown[]) ?? []).length }, "info", false);
      save();
      return ok({ answers: s.answers });
    }
    if (action === "hints") {
      if (s.status !== "active" && s.status !== "paused") return err("SESSION_NOT_READY", "Подсказки доступны только во время выполнения сценария.", 409);
      if (s.hints.length >= 3) return err("HINT_LIMIT_EXCEEDED", "Лимит подсказок исчерпан: доступно не более трёх.", 409);
      await sleep(900);
      const q = String(body.question ?? "");
      if (/игнорируй|ignore (all |the )?(previous|prior)|системн\w* промпт|system prompt/i.test(q)) {
        security(s, "prompt_injection", q.slice(0, 200));
      }
      const ladder = (specOf(s.code).hints as { ladder: string[] }).ladder;
      const n = s.hints.length + 1;
      const text = ladder[Math.min(n, ladder.length) - 1];
      s.hints.push({ number: n, text, created_at: iso() });
      push(s, "hint", { number: n, text, penalty_percent: 10, source: "ladder" });
      save();
      return ok({ number: n, hint: text, penalty_percent: 10, remaining: 3 - n, source: "ladder" });
    }
    if (action === "submit") {
      if (s.status !== "active" && s.status !== "paused") return err("SESSION_NOT_READY", "Сессия уже завершена или ещё не запущена.", 409);
      await sleep(1500);
      const res = submit(s);
      save();
      return ok(res);
    }
  }
  const newest = db.sessions.slice().reverse();
  if (p === "/api/sessions/mine") {
    const mine = newest.map((s) => ({ id: s.id, status: s.status, kind: s.kind, title: scenarioOf(s.code).title, code: s.code, started_at: s.started_at, finished_at: s.finished_at }));
    return ok([...mine, ...F.extra.student1_sessions.filter((x) => x.id !== PAUSED_FIXTURE)]);
  }
  if (p === "/api/scenarios/assignments/me") {
    const list = (recData<Json[]>("student", p) ?? []).map((a) => {
      const code = String((a.template as Json).code);
      const last = newest.find((s) => s.code === code);
      const base = a.last_session_id === PAUSED_FIXTURE ? { ...a, last_session_id: null, last_session_status: null, last_score: null } : a;
      return last ? { ...base, last_session_id: last.id, last_session_status: last.status, last_score: (last.report?.score as Json | undefined)?.final ?? null } : base;
    });
    return ok(list);
  }
  if (p === "/api/reports/mine") {
    const mine = newest.filter((s) => s.report).map((s) => ({ id: s.report!.id, session_id: s.id, title: s.report!.title, domain: s.report!.domain, score: (s.report!.score as Json).final, passed: (s.report!.score as Json).passed, created_at: s.report!.created_at }));
    return ok([...mine, ...(recData<Json[]>("student", p) ?? [])]);
  }
  const rb = /^\/api\/reports\/by-session\/(.+)$/.exec(p);
  if (rb && find(rb[1])) {
    const s = find(rb[1])!;
    return s.report ? ok(s.report) : err("SESSION_NOT_READY", "Отчёт ещё не сформирован.", 409);
  }
  const ev = p === "/api/events" ? find(url.searchParams.get("session_id") ?? "") : undefined;
  if (ev) return ok(ev.events.filter((e) => role !== "student" || e.type !== "command"));
  const vm = /^\/api\/verification\/(.+)$/.exec(p);
  if (vm && find(vm[1])) {
    const s = find(vm[1])!;
    if (method === "PATCH" && s.verification) {
      const val = Number(body.score);
      const reason = String(body.reason ?? "").trim();
      if (reason.length < 5) return err("VALIDATION_ERROR", "Укажите причину изменения оценки.", 422);
      const confirmed = val === s.verification.final_score;
      Object.assign(s.verification, { corrected_score: val, correction_reason: reason, corrected_by: "Преподаватель кафедры", review_status: confirmed ? "confirmed" : "corrected" });
      if (s.report) s.report.teacher = { score: val, reason, confirmed, by: "Преподаватель кафедры", at: iso(), alternative: !!body.alternative };
      save();
    }
    return s.verification ? ok(s.verification) : err("SESSION_NOT_READY", "Проверка ещё не выполнена.", 409);
  }
  if (p === "/api/reports" && role !== "student") {
    const base = structuredClone(recData<Json>(role, p, url.searchParams) ?? recData<Json>("teacher", p, url.searchParams)) as Json | undefined;
    if (base) {
      const extra = newest.filter((s) => s.report && s.verification).map((s) => ({
        session_id: s.id, student: "Обучающийся 1", student_id: "demo-student", group: "ИСИб-23-1", title: s.report!.title,
        domain: s.report!.domain, finished_at: s.finished_at, auto_score: (s.report!.score as Json).final,
        expert_score: s.verification!.corrected_score, review_status: s.verification!.review_status,
        verification_status: s.verification!.status, hints: s.hints.length,
      }));
      const sessions = [...extra, ...((base.sessions as Json[]) ?? [])];
      const scores = sessions.map((x) => Number(x.expert_score ?? x.auto_score));
      const kpi = base.kpi as Json;
      Object.assign(kpi, {
        sessions: sessions.length,
        avg_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        pending_review: sessions.filter((x) => x.review_status === "pending").length,
      });
      base.sessions = sessions;
      return ok(base);
    }
  }
  if (p === "/api/admin/llm/switch-mode" && method === "POST") {
    if (String(body.reason ?? "").trim().length < 3) return err("VALIDATION_ERROR", "Укажите причину переключения.", 422);
    db.mode = String(body.mode);
    save();
    return ok({ generation_mode: db.mode, reason: body.reason, updated_at: iso() });
  }
  if (p === "/api/llm/status") {
    const base = recData<Json>(role, p) ?? {};
    return ok({ ...base, generation_mode: db.mode, reason: db.mode === "external" ? null : base.reason });
  }

  // --- everything else: recorded data for reads, a polite refusal for writes
  if (method === "GET") {
    const r = recorded(role, method, p, url.searchParams);
    return r ?? err("NOT_FOUND", "В демо-версии эти данные недоступны.", 404);
  }
  return err("VALIDATION_ERROR", NOT_IN_DEMO, 422);
}

// --- fake WebSocket ----------------------------------------------------------------------------------------------

const PROMPT = (s: ServerState) => `\x1b[01;32mstudent@masso-srv\x1b[00m:\x1b[01;34m${s.cwd === "/home/student" ? "~" : s.cwd}\x1b[00m$ `;
const BANNER = "\x1b[33mДемо-версия: учебный сервер имитируется в браузере. Команда help — список поддерживаемых команд.\x1b[0m\r\n";

class DemoSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 0;
  binaryType: BinaryType = "blob";
  readonly url: string;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  private line = "";
  private unsubscribe: (() => void) | null = null;
  private readonly sessionId: string;
  private readonly channel: string;

  constructor(url: string) {
    super();
    this.url = url;
    const m = /\/ws\/sessions\/([^/]+)\/(events|terminal)/.exec(url);
    this.sessionId = m?.[1] ?? "";
    this.channel = m?.[2] ?? "";
    setTimeout(() => this.open(), 150);
  }

  private emit(data: string) {
    if (this.readyState !== 1) return;
    const ev = new MessageEvent("message", { data });
    this.onmessage?.(ev);
    this.dispatchEvent(ev);
  }

  private open() {
    const s = find(this.sessionId);
    if (!s) { this.close(); return; }
    this.readyState = 1;
    const ev = new Event("open");
    this.onopen?.(ev);
    this.dispatchEvent(ev);
    if (this.channel === "events") {
      this.emit(JSON.stringify({ type: "status", payload: { status: s.status } }));
      const cb = (e: DemoEvent) => this.emit(JSON.stringify({ type: e.type, severity: e.severity, payload: e.payload, created_at: e.created_at }));
      if (!listeners.has(s.id)) listeners.set(s.id, new Set());
      listeners.get(s.id)!.add(cb);
      this.unsubscribe = () => listeners.get(s.id)?.delete(cb);
    } else if (s.server) {
      this.emit(BANNER + PROMPT(s.server));
    }
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (this.channel !== "terminal" || this.readyState !== 1) return;
    const text = typeof data === "string" ? data : new TextDecoder().decode(data as ArrayBuffer);
    if (text.startsWith("{")) return; // resize frames
    const s = find(this.sessionId);
    if (!s?.server) return;
    let echo = "";
    // eslint-disable-next-line no-control-regex -- strip terminal escape sequences (arrows) from the input
    for (const ch of text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")) {
      if (ch === "\r" || ch === "\n") {
        const cmd = this.line.trim();
        this.line = "";
        echo += "\r\n";
        if (cmd) {
          if (s.status === "paused") { s.status = "active"; s.paused_at = null; }
          const r = exec(s.server, cmd);
          push(s, "command", { cmd, cwd: s.server.cwd }, "info", false);
          if (r.security) security(s, r.security, cmd);
          if (r.out) echo += r.out.replace(/\n/g, "\r\n") + "\r\n";
          save();
        }
        echo += PROMPT(s.server);
      } else if (ch === "\x7f" || ch === "\b") {
        if (this.line) { this.line = this.line.slice(0, -1); echo += "\b \b"; }
      } else if (ch === "\x03") {
        this.line = "";
        echo += "^C\r\n" + PROMPT(s.server);
      } else if (ch === "\t") {
        continue;
      } else if (ch >= " ") {
        this.line += ch;
        echo += ch;
      }
    }
    if (echo) this.emit(echo);
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.unsubscribe?.();
    const ev = new CloseEvent("close", { code: 1000 });
    this.onclose?.(ev);
    this.dispatchEvent(ev);
  }
}

// --- install -------------------------------------------------------------------------------------------------------

/** Replaces fetch for /api/* and WebSocket for /ws/* with the in-browser demo backend. */
export function install(): void {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    if (!url.pathname.startsWith("/api/")) return realFetch(input, init);
    const method = (init?.method ?? "GET").toUpperCase();
    let body: Json = {};
    try { body = init?.body ? (JSON.parse(String(init.body)) as Json) : {}; } catch { /* not JSON */ }
    const r = await handle(method, url, body);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  };
  // A demo notice: expanded at first, then collapsed into a small pill so that it does not cover page controls.
  const badge = document.createElement("button");
  badge.type = "button";
  badge.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:50;max-width:min(380px,calc(100vw - 32px));" +
    "background:#FFF3D1;color:#7A4F00;border:1px solid #E9D49A;border-radius:10px;padding:8px 12px;text-align:left;" +
    "font:13px/1.45 'IBM Plex Sans',system-ui,sans-serif;box-shadow:0 6px 18px rgba(20,33,46,.12);cursor:pointer";
  const full = "<b>Демо-версия.</b> Сервер, база данных и учебный терминал имитируются в браузере, " +
    `инцидент приходит через ${INCIDENT_AFTER_SEC} с, LLM заменена утверждёнными вариантами. ` +
    `<a href='${import.meta.env.BASE_URL}../' style='color:#1747A6'>О проекте</a>`;
  let expanded = true;
  const render = () => {
    badge.innerHTML = expanded ? full : "<b>Демо-версия</b> · подробнее";
    badge.setAttribute("aria-expanded", String(expanded));
  };
  badge.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).tagName === "A") return;
    expanded = !expanded;
    render();
  });
  render();
  setTimeout(() => { expanded = false; render(); }, 10_000);
  document.body.appendChild(badge);
  const RealWebSocket = window.WebSocket;
  window.WebSocket = new Proxy(RealWebSocket, {
    construct(target, args: [string | URL, (string | string[])?]) {
      const u = String(args[0]);
      return u.includes("/ws/sessions/") ? new DemoSocket(u) : new target(...args);
    },
  });
}
