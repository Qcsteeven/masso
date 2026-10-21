// Demo mode only: an in-browser imitation of the masso/webstack training server (nginx → store-api → PostgreSQL
// under supervisord). Plain-JSON state so that it survives a page reload via sessionStorage.

export type Fault = "db_wrong_user" | "db_wrong_password";
type Svc = "nginx" | "store-api" | "postgresql";
type SvcState = "RUNNING" | "BACKOFF" | "STOPPED" | "FATAL";

export interface ServerState {
  files: Record<string, string>;
  cwd: string;
  services: Record<Svc, { state: SvcState; since: number; pid: number }>;
  incident: boolean;
  history: string[];
}

export interface ExecResult {
  out: string;
  security?: string;
}

const ENV = "/srv/app/.env";
const STORE_CONF = "/srv/nginx/store.conf";
const HBA = "/srv/pgdata/pg_hba.conf";
const GOOD = { DB_HOST: "127.0.0.1", DB_PORT: "5432", DB_NAME: "store", DB_USER: "store", DB_PASSWORD: "Sh0p-2026-store" };

const SUSPICIOUS: [string, RegExp][] = [
  ["sandbox_escape", /docker\.sock|\/proc\/1\/root|\bnsenter\b|\bchroot\b|\bmount\b|\/var\/run\/docker/],
  ["privilege_escalation", /(^|[;&|\s])(sudo|su|doas|pkexec)(\s|$)/],
  ["network_scan", /\b(nmap|masscan|zmap)\b|\bnc\s+-[a-z]*z|\bping\s+-f\b/],
  ["forbidden_file", /\/etc\/shadow|\/root\/|\.ssh\//],
  ["forbidden_file", /(>>?|\btee(\s+-a)?)\s*\/(etc|usr|bin|sbin|lib|boot)\/|\b(touch|rm|chmod|chown|sed\s+-i\S*)\b[^;&|]*\s\/(etc|usr|bin|sbin|lib|boot)\//],
];

export function classify(cmd: string): string | undefined {
  return SUSPICIOUS.find(([, re]) => re.test(cmd))?.[0];
}

const stamp = (t: number) => new Date(t).toISOString().replace("T", " ").slice(0, 19);
const pad2 = (n: number) => String(n).padStart(2, "0");

export function newServer(srvFiles: Record<string, string>, fault: Fault, now = Date.now()): ServerState {
  const example = srvFiles["/srv/app/.env.example"] ?? "";
  const env = fault === "db_wrong_user"
    ? example.replace(/^DB_USER=.*$/m, "DB_USER=shop")
    : example.replace(/^DB_PASSWORD=.*$/m, "DB_PASSWORD=Shop-2026-store");
  const s: ServerState = {
    files: {
      ...srvFiles,
      [ENV]: env,
      [HBA]: "# TYPE  DATABASE  USER  ADDRESS       METHOD\nlocal   all       all                 scram-sha-256\nhost    all       all   127.0.0.1/32  scram-sha-256\n",
      "/srv/log/store-api.log": "",
      "/srv/log/nginx-error.log": "",
      "/srv/log/postgresql.log": `${stamp(now)} UTC [17] LOG:  database system is ready to accept connections\n`,
    },
    cwd: "/srv",
    services: {
      postgresql: { state: "RUNNING", since: now, pid: 17 },
      "store-api": { state: "BACKOFF", since: now, pid: 0 },
      nginx: { state: "RUNNING", since: now, pid: 19 },
    },
    incident: false,
    history: [],
  };
  for (let i = 0; i < 3; i++) failStart(s, now + i * 1000);
  return s;
}

function env(s: ServerState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of (s.files[ENV] ?? "").split("\n")) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const envOk = (s: ServerState) => Object.entries(GOOD).every(([k, v]) => env(s)[k] === v);
const upstreamPort = (s: ServerState) => /server\s+127\.0\.0\.1:(\d+)\s*;/.exec(s.files[STORE_CONF] ?? "")?.[1] ?? "";

function nginxConfigOk(s: ServerState): boolean {
  const conf = s.files[STORE_CONF] ?? "";
  const open = (conf.match(/{/g) ?? []).length;
  const close = (conf.match(/}/g) ?? []).length;
  return open === close && /upstream\s+store_api/.test(conf) && /proxy_pass\s+http:\/\/store_api;/.test(conf);
}

function appendLog(s: ServerState, file: string, line: string) {
  s.files[file] = (s.files[file] ?? "") + line + "\n";
}

function failStart(s: ServerState, now: number) {
  const user = env(s).DB_USER ?? "";
  const reason = env(s).DB_PASSWORD !== GOOD.DB_PASSWORD || user !== GOOD.DB_USER
    ? `FATAL:  password authentication failed for user "${user}"`
    : `FATAL:  database "${env(s).DB_NAME ?? ""}" does not exist`;
  appendLog(s, "/srv/log/store-api.log",
    `${stamp(now)} ERROR store-api: startup: cannot connect to database: connection to server at "${env(s).DB_HOST ?? ""}", port ${env(s).DB_PORT ?? ""} failed: ${reason}`);
}

function startService(s: ServerState, name: Svc, now: number): string {
  const svc = s.services[name];
  if (name === "store-api") {
    if (!envOk(s) || s.services.postgresql.state !== "RUNNING") {
      failStart(s, now);
      svc.state = "BACKOFF";
      return `${name}: ERROR (spawn error)`;
    }
    appendLog(s, "/srv/log/store-api.log", `${stamp(now)} INFO store-api: store-api started on 127.0.0.1:8000`);
  }
  if (name === "nginx" && !nginxConfigOk(s)) {
    appendLog(s, "/srv/log/nginx-error.log", `${stamp(now)} [emerg] invalid configuration in ${STORE_CONF}`);
    svc.state = "FATAL";
    return `${name}: ERROR (spawn error)`;
  }
  svc.state = "RUNNING";
  svc.since = now;
  svc.pid = 20 + Math.floor((now / 1000) % 500);
  return `${name}: started`;
}

/** The scheduled incident of the DevOps scenario: the proxy starts sending requests to a wrong port. */
export function applyIncident(s: ServerState, now = Date.now()) {
  s.incident = true;
  s.files[STORE_CONF] = (s.files[STORE_CONF] ?? "").replace("server 127.0.0.1:8000;", "server 127.0.0.1:8001;");
  startService(s, "nginx", now);
}

function health(s: ServerState, port: string, now: number): { code: number; body: string } {
  if (port === "8000") {
    return s.services["store-api"].state === "RUNNING" ? { code: 200, body: '{"status": "ok", "db": "ok"}' } : { code: 0, body: "" };
  }
  if (s.services.nginx.state !== "RUNNING") return { code: 0, body: "" };
  if (upstreamPort(s) !== "8000" || s.services["store-api"].state !== "RUNNING") {
    appendLog(s, "/srv/log/nginx-error.log",
      `${stamp(now)} [error] 21#21: *1 connect() failed (111: Connection refused) while connecting to upstream, upstream: "http://127.0.0.1:${upstreamPort(s)}/health"`);
    return { code: 502, body: "<html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body>\r\n<center><h1>502 Bad Gateway</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>" };
  }
  return { code: 200, body: '{"status": "ok", "db": "ok"}' };
}

export interface CheckResult { id: string; passed: boolean }

/** Same criteria as the real web_recovery template checks. */
export function runChecks(s: ServerState): CheckResult[] {
  const hostLines = (s.files[HBA] ?? "").split("\n").filter((l) => /^\s*host/.test(l)).join("\n");
  return [
    { id: "health", passed: health(s, "8080", Date.now()).code === 200 },
    { id: "app_running", passed: s.services["store-api"].state === "RUNNING" },
    { id: "password_auth", passed: /scram-sha-256|md5/.test(hostLines) && !/trust/.test(hostLines) },
    { id: "nginx_config", passed: nginxConfigOk(s) },
    { id: "container_ok", passed: true },
  ];
}

// --- shell -------------------------------------------------------------------------------------------------------

function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q: string | null = null;
  let has = false;
  for (const ch of line) {
    if (q) {
      if (ch === q) q = null;
      else cur += ch;
    } else if (ch === "'" || ch === '"') {
      q = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (cur || has) out.push(cur);
      cur = "";
      has = false;
    } else cur += ch;
  }
  if (cur || has) out.push(cur);
  return out;
}

/** Splits `a && b; c || d` (outside quotes) into steps with their connectors. */
function splitChain(line: string): { cmd: string; op: string }[] {
  const steps: { cmd: string; op: string }[] = [];
  let cur = "";
  let q: string | null = null;
  let op = ";";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; cur += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    const two = line.slice(i, i + 2);
    if (two === "&&" || two === "||") { steps.push({ cmd: cur, op }); op = two; cur = ""; i++; continue; }
    if (ch === ";") { steps.push({ cmd: cur, op }); op = ";"; cur = ""; continue; }
    cur += ch;
  }
  steps.push({ cmd: cur, op });
  return steps.filter((x) => x.cmd.trim());
}

function splitPipes(cmd: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let q: string | null = null;
  for (const ch of cmd) {
    if (q) { if (ch === q) q = null; cur += ch; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if (ch === "|") { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

function resolve(s: ServerState, p: string): string {
  if (!p) return s.cwd;
  const abs = p.startsWith("/") ? p : `${s.cwd}/${p}`;
  const parts: string[] = [];
  for (const seg of abs.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return "/" + parts.join("/");
}

const isDir = (s: ServerState, p: string) => p === "/" || Object.keys(s.files).some((f) => f.startsWith(p + "/"));
const SYSTEM = /^\/(etc|usr|bin|sbin|lib|boot|var|opt|root|proc)(\/|$)/;

function sedApply(text: string, expr: string): string {
  let out = text;
  for (const part of expr.split(/;\s*(?=s.)/)) {
    const e = part.trim();
    if (!e.startsWith("s") || e.length < 4) continue;
    const d = e[1];
    const pieces: string[] = [];
    let cur = "";
    for (let i = 2; i < e.length; i++) {
      if (e[i] === "\\" && e[i + 1] === d) { cur += d; i++; continue; }
      if (e[i] === d) { pieces.push(cur); cur = ""; continue; }
      cur += e[i];
    }
    pieces.push(cur);
    const [pat, rep = "", flags = ""] = pieces;
    let re: RegExp;
    try {
      re = new RegExp(pat, "m" + (flags.includes("g") ? "g" : ""));
    } catch {
      throw new Error(`sed: -e expression #1: unknown option to \`s'`);
    }
    out = out.split("\n").map((line) => line.replace(re, rep.replace(/\\(\d)/g, "$$$1").replace(/&/g, "$$&"))).join("\n");
  }
  return out;
}

function statusLine(s: ServerState, name: Svc, now: number): string {
  const v = s.services[name];
  const up = Math.max(0, Math.floor((now - v.since) / 1000));
  const info = v.state === "RUNNING"
    ? `pid ${v.pid}, uptime ${Math.floor(up / 3600)}:${pad2(Math.floor(up / 60) % 60)}:${pad2(up % 60)}`
    : v.state === "BACKOFF" ? "Exited too quickly (process log may have details)" : v.state === "FATAL" ? "Exited too quickly" : "Not started";
  return `${name.padEnd(33)}${v.state.padEnd(10)}${info}`;
}

const HELP = `Демо-версия учебного сервера. Поддерживаются основные команды:
  supervisorctl status|restart|start|stop|tail <служба>   службы: nginx, store-api, postgresql
  cat, less, head, tail [-n N], grep, diff, ls, cd, pwd, echo … > файл
  sed -i 's/шаблон/замена/' файл    curl [-i] [-s] localhost:8080/health    nginx -t
Подсказка по серверу: cat /srv/docs/README.md`;

/** Executes one command line; returns terminal output (\n line ends) and a security kind if the line is suspicious. */
export function exec(s: ServerState, line: string, now = Date.now()): ExecResult {
  const security = classify(line);
  s.history.push(line);
  const out: string[] = [];
  let ok = true;
  for (const step of splitChain(line)) {
    if ((step.op === "&&" && !ok) || (step.op === "||" && ok)) continue;
    let input: string | null = null;
    for (const part of splitPipes(step.cmd)) {
      const r = run(s, part.trim(), input, now);
      ok = r.ok;
      input = r.out;
    }
    if (input) out.push(input.replace(/\n$/, ""));
  }
  return { out: out.join("\n"), security };
}

function run(s: ServerState, cmdline: string, stdin: string | null, now: number): { out: string; ok: boolean } {
  let redirect: { file: string; append: boolean } | null = null;
  const m = /^(.*?)\s*(>>?)\s*(\S+)\s*$/.exec(cmdline);
  if (m && !/['"][^'"]*>[^'"]*['"]/.test(cmdline)) {
    redirect = { file: m[3], append: m[2] === ">>" };
    cmdline = m[1];
  }
  const argv = tokenize(cmdline);
  const [cmd, ...args] = argv;
  const res = command(s, cmd ?? "", args, stdin, now);
  if (redirect && res.ok) {
    if (redirect.file === "/dev/null") return { out: "", ok: true };
    const path = resolve(s, redirect.file);
    if (SYSTEM.test(path)) return { out: `bash: ${redirect.file}: Read-only file system`, ok: false };
    if (!path.startsWith("/srv/") && !path.startsWith("/tmp/")) return { out: `bash: ${redirect.file}: Permission denied`, ok: false };
    s.files[path] = (redirect.append ? s.files[path] ?? "" : "") + res.out + (res.out ? "\n" : "");
    return { out: "", ok: true };
  }
  return res;
}

function readFile(s: ServerState, p: string): { text?: string; err?: string } {
  const path = resolve(s, p);
  if (path === "/etc/shadow" || path.startsWith("/root")) return { err: `${p}: Permission denied` };
  if (path === "/var/run/docker.sock") return { err: `${p}: No such file or directory` };
  if (path in s.files) return { text: s.files[path] };
  if (isDir(s, path)) return { err: `${p}: Is a directory` };
  return { err: `${p}: No such file or directory` };
}

function command(s: ServerState, cmd: string, args: string[], stdin: string | null, now: number): { out: string; ok: boolean } {
  const files = args.filter((a) => !a.startsWith("-"));
  const fail = (out: string) => ({ out, ok: false });
  const okOut = (out: string) => ({ out, ok: true });
  switch (cmd) {
    case "": return okOut("");
    case "help": return okOut(HELP);
    case "pwd": return okOut(s.cwd);
    case "whoami": return okOut("student");
    case "id": return okOut("uid=1000(student) gid=1000(student) groups=1000(student)");
    case "hostname": return okOut("masso-srv");
    case "date": return okOut(new Date(now).toString());
    case "clear": return okOut("\x1b[2J\x1b[H");
    case "history": return okOut(s.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`).join("\n"));
    case "cd": {
      const path = resolve(s, files[0] ?? "/srv");
      if (!isDir(s, path)) return fail(`bash: cd: ${files[0]}: No such file or directory`);
      s.cwd = path;
      return okOut("");
    }
    case "ls": {
      const path = resolve(s, files[0] ?? s.cwd);
      const names = new Set<string>();
      for (const f of Object.keys(s.files)) if (f.startsWith(path + "/")) names.add(f.slice(path.length + 1).split("/")[0]);
      if (!names.size) return path in s.files ? okOut(files[0] ?? "") : fail(`ls: cannot access '${files[0] ?? path}': No such file or directory`);
      const list = [...names].sort();
      if (args.some((a) => a.startsWith("-l"))) {
        return okOut(list.map((n) => {
          const full = `${path}/${n}`;
          const dir = isDir(s, full) && !(full in s.files);
          return `${dir ? "drwxr-xr-x" : "-rw-r--r--"} 1 student student ${String(dir ? 4096 : (s.files[full] ?? "").length).padStart(6)} Oct 20 09:00 ${n}`;
        }).join("\n"));
      }
      return okOut(list.join("  "));
    }
    case "cat": case "less": case "more": {
      if (!files.length && stdin != null) return okOut(stdin);
      const parts: string[] = [];
      for (const f of files) {
        const r = readFile(s, f);
        if (r.err) return fail(`${cmd}: ${r.err}`);
        parts.push((r.text ?? "").replace(/\n$/, ""));
      }
      return okOut(parts.join("\n"));
    }
    case "head": case "tail": {
      const nIdx = args.indexOf("-n");
      const n = nIdx >= 0 ? Number(args[nIdx + 1]) || 10 : Number((args.find((a) => /^-\d+$/.test(a)) ?? "-10").slice(1));
      const target = files.filter((f) => f !== args[nIdx + 1]);
      let text = stdin ?? "";
      if (target.length) {
        const r = readFile(s, target[0]);
        if (r.err) return fail(`${cmd}: cannot open '${target[0]}' for reading: No such file or directory`);
        text = r.text ?? "";
      }
      const lines = text.replace(/\n$/, "").split("\n");
      const note = args.includes("-f") ? "\n(демо: режим -f не поддерживается, показаны последние строки)" : "";
      return okOut((cmd === "head" ? lines.slice(0, n) : lines.slice(-n)).join("\n") + note);
    }
    case "grep": {
      const pattern = files[0];
      if (!pattern) return fail("Usage: grep [OPTION]... PATTERNS [FILE]...");
      const flags = args.includes("-i") ? "i" : "";
      let re: RegExp;
      try { re = new RegExp(pattern, flags); } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags); }
      const sources = files.slice(1);
      const texts = sources.length ? sources.map((f) => ({ f, r: readFile(s, f) })) : [{ f: "", r: { text: stdin ?? "" } }];
      const hits: string[] = [];
      for (const { f, r } of texts) {
        if (r.err) return fail(`grep: ${r.err}`);
        (r.text ?? "").split("\n").forEach((l, i) => {
          if (re.test(l) !== args.includes("-v")) hits.push(`${sources.length > 1 ? f + ":" : ""}${args.includes("-n") ? i + 1 + ":" : ""}${l}`);
        });
      }
      if (args.includes("-c")) return okOut(String(hits.length));
      return hits.length ? okOut(hits.join("\n")) : fail("");
    }
    case "wc": return okOut(String((stdin ?? "").split("\n").filter(Boolean).length));
    case "diff": {
      const a = readFile(s, files[0] ?? "");
      const b = readFile(s, files[1] ?? "");
      if (a.err || b.err) return fail(`diff: ${a.err ?? b.err}`);
      const la = (a.text ?? "").split("\n");
      const lb = (b.text ?? "").split("\n");
      const out: string[] = [];
      for (let i = 0; i < Math.max(la.length, lb.length); i++) {
        if (la[i] !== lb[i]) out.push(`${i + 1}c${i + 1}`, `< ${la[i] ?? ""}`, "---", `> ${lb[i] ?? ""}`);
      }
      return out.length ? { out: out.join("\n"), ok: false } : okOut("");
    }
    case "echo": return okOut(args.join(" "));
    case "sed": {
      const inPlace = args.some((a) => a.startsWith("-i"));
      const exprs: string[] = [];
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-e") exprs.push(args[++i] ?? "");
        else if (args[i].startsWith("-")) continue;
        else if (!exprs.length) exprs.push(args[i]);
        else rest.push(args[i]);
      }
      if (!exprs.length) return fail("Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...");
      const target = rest[0];
      const path = target ? resolve(s, target) : "";
      if (target && SYSTEM.test(path)) return fail(`sed: couldn't open temporary file ${path}: Read-only file system`);
      const src = target ? readFile(s, target) : { text: stdin ?? "" };
      if (src.err) return fail(`sed: can't read ${target}: No such file or directory`);
      try {
        const text = exprs.reduce((t, e) => sedApply(t, e), src.text ?? "");
        if (inPlace && target) { s.files[path] = text; return okOut(""); }
        return okOut(text.replace(/\n$/, ""));
      } catch (e) {
        return fail((e as Error).message);
      }
    }
    case "touch": case "mkdir": case "rm": case "cp": case "mv": case "chmod": case "chown": {
      const path = resolve(s, files[files.length - 1] ?? "");
      if (SYSTEM.test(path)) return fail(`${cmd}: cannot ${cmd === "touch" ? "touch" : "write"} '${files[files.length - 1]}': Read-only file system`);
      if (cmd === "touch" && !(path in s.files)) s.files[path] = "";
      if (cmd === "rm") { if (!(path in s.files)) return fail(`rm: cannot remove '${files[0]}': No such file or directory`); delete s.files[path]; }
      if ((cmd === "cp" || cmd === "mv") && files.length === 2) {
        const r = readFile(s, files[0]);
        if (r.err) return fail(`${cmd}: cannot stat '${files[0]}': No such file or directory`);
        s.files[path] = r.text ?? "";
        if (cmd === "mv") delete s.files[resolve(s, files[0])];
      }
      return okOut("");
    }
    case "supervisorctl": {
      const [action = "status", ...names] = files;
      const all: Svc[] = ["nginx", "postgresql", "store-api"];
      const targets = (names.includes("all") || !names.length ? all : names) as Svc[];
      const bad = targets.find((t) => !all.includes(t));
      if (bad) return fail(`${bad}: ERROR (no such process)`);
      if (action === "status") return okOut(targets.map((t) => statusLine(s, t, now)).join("\n"));
      if (action === "tail") {
        const log = targets[0] === "nginx" ? "/srv/log/nginx-error.log" : `/srv/log/${targets[0]}.log`;
        return okOut((s.files[log] ?? "").split("\n").slice(-12).join("\n"));
      }
      const lines: string[] = [];
      for (const t of targets) {
        if (action === "stop" || action === "restart") { s.services[t].state = "STOPPED"; lines.push(`${t}: stopped`); }
        if (action === "start" || action === "restart") lines.push(startService(s, t, now));
      }
      return okOut(lines.join("\n"));
    }
    case "systemctl": case "service": return fail("System has not been booted with systemd as init system (PID 1). Can't operate.");
    case "curl": {
      const url = files.find((a) => /localhost|127\.0\.0\.1|^:?\d+/.test(a) && a !== args[args.indexOf("-w") + 1] && a !== args[args.indexOf("-o") + 1]) ?? "";
      const port = /:(\d+)/.exec(url)?.[1] ?? "80";
      if (!/localhost|127\.0\.0\.1/.test(url)) return fail(`curl: (6) Could not resolve host: ${url.replace(/^https?:\/\//, "").split("/")[0]}`);
      if (port !== "8080" && port !== "8000") return fail(`curl: (7) Failed to connect to localhost port ${port}: Connection refused`);
      const r = health(s, port, now);
      if (!r.code) return fail(`curl: (7) Failed to connect to localhost port ${port}: Connection refused`);
      const wIdx = args.indexOf("-w");
      const writeOut = wIdx >= 0 ? (args[wIdx + 1] ?? "").replace("%{http_code}", String(r.code)).replace(/\\n/g, "\n") : "";
      const silentBody = args.includes("-o");
      const head = args.includes("-i") || args.includes("-I")
        ? `HTTP/1.1 ${r.code} ${r.code === 200 ? "OK" : "Bad Gateway"}\nServer: nginx\nContent-Type: ${r.code === 200 ? "application/json" : "text/html"}\n\n` : "";
      return okOut((silentBody ? "" : head + r.body) + writeOut);
    }
    case "nginx": {
      if (!args.includes("-t")) return fail("nginx: [alert] could not open error log file: Permission denied (используйте supervisorctl restart nginx)");
      return nginxConfigOk(s)
        ? okOut("nginx: the configuration file /srv/nginx/nginx.conf syntax is ok\nnginx: configuration file /srv/nginx/nginx.conf test is successful")
        : fail(`nginx: [emerg] unexpected end of file, expecting "}" in ${STORE_CONF}\nnginx: configuration file /srv/nginx/nginx.conf test failed`);
    }
    case "ps": return okOut(["  PID USER     COMMAND", "    1 student  /usr/bin/python3 /usr/bin/supervisord",
      ...(["postgresql", "nginx", "store-api"] as Svc[]).filter((n) => s.services[n].state === "RUNNING").map((n) => `${String(s.services[n].pid).padStart(5)} student  ${n}`)].join("\n"));
    case "ss": case "netstat": return okOut(["State   Local Address:Port",
      ...(s.services.postgresql.state === "RUNNING" ? ["LISTEN  127.0.0.1:5432"] : []),
      ...(s.services["store-api"].state === "RUNNING" ? ["LISTEN  127.0.0.1:8000"] : []),
      ...(s.services.nginx.state === "RUNNING" ? ["LISTEN  0.0.0.0:8080"] : [])].join("\n"));
    case "psql": return fail("psql: в демо-версии интерактивный клиент PostgreSQL недоступен; проверьте журнал /srv/log/postgresql.log");
    case "nano": case "vim": case "vi": case "mcedit":
      return fail(`${cmd}: в демо-версии редактор недоступен — используйте sed -i 's/было/стало/' файл или echo … > файл`);
    case "ping": return fail("ping: connect: Network is unreachable");
    case "apt": case "apt-get": return fail("E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)");
    case "exit": case "logout": return okOut("logout (в демо-версии терминал остаётся открытым)");
    default: return fail(`bash: ${cmd}: command not found`);
  }
}
