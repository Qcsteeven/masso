// Helpers that emit literal HTML for the МАССО mockup artboards (Claude Design .dc.html).
// Tokens = frontend/src/index.css (light @theme, dark :root[data-theme="dark"]).

export const LIGHT = {
  bg: "#faf7f2", surface: "#ffffff", sunken: "#f5f0e8", line: "#ece6dc", "line-soft": "#f3eee6", field: "#ddd5c8",
  text: "#1c1917", muted: "#78716c", label: "#57534e", nav: "#1c1917", "nav-hover": "#f5f0e8", "nav-ink": "#57534e",
  "nav-label": "#a8a29e", "on-nav": "#faf7f2", accent: "#ea580c", "accent-dark": "#c2410c", "on-accent": "#ffffff",
  "blue-bg": "#e8effc", "blue-ink": "#1d4ed8", "green-bg": "#e6f4ea", "green-ink": "#166534", green: "#16a34a",
  "amber-bg": "#ffedd5", "amber-ink": "#9a3412", amber: "#ea8a0c", "red-bg": "#fde8e6", "red-ink": "#b42318", red: "#dc2626",
  "grey-bg": "#f5f0e8", "grey-ink": "#57534e", term: "#1c1917", "term-bar": "#292524", "term-ink": "#e7e5e4",
  shadow: "0 1px 2px rgb(28 25 23 / 0.04), 0 6px 24px rgb(28 25 23 / 0.05)",
  "banner-line": "#f0d68a", "banner-ink": "#5c3b00",
  "cm-bg": "#ffffff", "cm-gutter": "#f5f0e8", "cm-gutter-ink": "#78716c", "cm-active": "#fff6ec", "cm-active-gutter": "#ffedd5",
  "cm-text": "#1c1917", "cm-kw": "#770088", "cm-def": "#0000ff", "cm-str": "#aa1111", "cm-com": "#994400", "cm-num": "#116644",
  backdrop: "rgb(0 0 0 / 0.4)",
};
export const DARK = {
  bg: "#141210", surface: "#1e1b18", sunken: "#262220", line: "#2f2a26", "line-soft": "#282421", field: "#443d37",
  text: "#f5f2ed", muted: "#a8a29e", label: "#d6d3d1", nav: "#f5f2ed", "nav-hover": "#262220", "nav-ink": "#d6d3d1",
  "nav-label": "#78716c", "on-nav": "#1c1917", accent: "#fb923c", "accent-dark": "#fdba74", "on-accent": "#1c1917",
  "blue-bg": "#172340", "blue-ink": "#93b4fd", "green-bg": "#10291a", "green-ink": "#86efac", green: "#22c55e",
  "amber-bg": "#3a1f0b", "amber-ink": "#fdba74", amber: "#f59e0b", "red-bg": "#3b1212", "red-ink": "#fca5a5", red: "#ef4444",
  "grey-bg": "#262220", "grey-ink": "#d6d3d1", term: "#1c1917", "term-bar": "#292524", "term-ink": "#e7e5e4",
  shadow: "0 1px 2px rgb(0 0 0 / 0.3), 0 6px 24px rgb(0 0 0 / 0.25)",
  "banner-line": "#5a3a16", "banner-ink": "#fdba74",
  "cm-bg": "#1c1917", "cm-gutter": "#1c1917", "cm-gutter-ink": "#7d8799", "cm-active": "#292524", "cm-active-gutter": "#292524",
  "cm-text": "#abb2bf", "cm-kw": "#c678dd", "cm-def": "#61afef", "cm-str": "#98c379", "cm-com": "#7d8799", "cm-num": "#d19a66",
  backdrop: "rgb(0 0 0 / 0.55)",
};
const vars = (t) => Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(";");

export const CSS = `body{margin:0}
.t-light{${vars(LIGHT)};color-scheme:light}
.t-dark{${vars(DARK)};color-scheme:dark}
*{box-sizing:border-box}
a{color:var(--accent);text-decoration:none} a:hover{color:var(--accent-dark)}
h1,h2,h3,h4,p,ul,ol,pre,fieldset,figure{margin:0}
button,input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.t-light .ico-sun{display:none} .t-dark .ico-moon{display:none}
.mono{font-family:'IBM Plex Mono',ui-monospace,monospace}
.muted{color:var(--muted)} .xs{font-size:12px} .s13{font-size:13px} .sm{font-size:14px}
.b{font-weight:600} .m{font-weight:500}
.row{display:flex;align-items:center} .col{display:flex;flex-direction:column} .wrap{flex-wrap:wrap}
.between{justify-content:space-between} .grow{flex:1 1 0;min-width:0} .nw{white-space:nowrap} .tr{text-align:right}
.trunc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hdr{background:color-mix(in srgb,var(--bg) 85%,transparent)}
.top-in{max-width:1440px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:12px 24px;width:100%}
.pills{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:999px;background:var(--surface);padding:4px;box-shadow:var(--shadow)}
.brand{display:flex;align-items:center;gap:8px;padding:0 12px 0 6px;font-size:15px;font-weight:600;letter-spacing:.04em;flex-shrink:0}
.grp{display:flex;align-items:center;gap:4px;flex-shrink:0}
.pill{display:flex;align-items:center;gap:8px;min-height:36px;padding:0 16px;border-radius:999px;font-size:14px;text-decoration:none;color:var(--nav-ink);flex-shrink:0}
.pill:hover{background:var(--nav-hover);color:var(--text)}
.pill.on,.pill.on:hover{background:var(--nav);color:var(--on-nav)}
.tt{display:grid;place-items:center;width:40px;height:40px;flex-shrink:0;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--label);box-shadow:var(--shadow);cursor:pointer;padding:0;text-decoration:none}
.tt:hover{color:var(--accent)}
.ubox{display:flex;align-items:center;gap:4px;flex-shrink:0;border:1px solid var(--line);border-radius:999px;background:var(--surface);padding:4px;box-shadow:var(--shadow)}
.ava{display:grid;place-items:center;width:32px;height:32px;border-radius:999px;background:var(--amber-bg);color:var(--amber-ink);font-size:12px;font-weight:600}
.uname{max-width:180px;padding:0 8px;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.out{display:grid;place-items:center;width:32px;height:32px;border-radius:999px;color:var(--label);text-decoration:none}
.out:hover{background:var(--nav-hover);color:var(--text)}
.wrapc{max-width:1440px;margin:0 auto;width:100%;min-width:0;display:flex;flex-direction:column;flex:1 1 auto}
.ph{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;padding:24px 32px 4px}
.ph h1{font-size:28px;font-weight:600;line-height:1.25;letter-spacing:-.015em}
.ph .sub{margin-top:4px;font-size:14px;color:var(--muted)}
.ph .crumbs{margin-bottom:4px;font-size:13px;color:var(--muted)}
.ph .acts{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.page{display:flex;flex-direction:column;gap:20px;padding:20px 32px 40px}
.card{min-width:0;border-radius:20px;border:1px solid color-mix(in srgb,var(--line) 70%,transparent);background:var(--surface);box-shadow:var(--shadow);padding:20px}
.card.np{padding:0}
.ct{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ct h2{font-size:16px;font-weight:600}
.cth{padding:20px 20px 12px}
.g{display:grid;gap:20px;align-items:start}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.kpi{display:flex;flex-direction:column;gap:6px}
.kpi b{font-size:32px;font-weight:600;line-height:1;letter-spacing:-.015em}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--text);padding:0 20px;min-height:44px;font-size:14px;font-weight:500;text-decoration:none;cursor:pointer}
.btn:hover{background:var(--sunken);color:var(--text)}
.btn.s{min-height:36px;padding:0 16px}
.btn.p{border-color:var(--accent);background:var(--accent);color:var(--on-accent)}
.btn.p:hover{background:var(--accent-dark);border-color:var(--accent-dark);color:var(--on-accent)}
.btn.d{border-color:color-mix(in srgb,var(--red) 60%,transparent);color:var(--red-ink)}
.btn.d:hover{background:var(--red-bg)}
.btn.gh{border-color:transparent;background:transparent}
.btn.gh:hover{background:var(--sunken)}
.btn[disabled],.btn.dis{opacity:.5;cursor:not-allowed}
.chip{display:inline-flex;align-items:center;gap:6px;height:24px;white-space:nowrap;border-radius:999px;padding:0 10px;font-size:12px;font-weight:500;background:var(--grey-bg);color:var(--grey-ink)}
.chip.blue,.bn.blue{background:var(--blue-bg);color:var(--blue-ink)}
.chip.green,.bn.green{background:var(--green-bg);color:var(--green-ink)}
.chip.amber,.bn.amber{background:var(--amber-bg);color:var(--amber-ink)}
.chip.red,.bn.red{background:var(--red-bg);color:var(--red-ink)}
.chip.grey,.bn.grey{background:var(--grey-bg);color:var(--grey-ink)}
.dot{width:6px;height:6px;border-radius:999px;background:currentColor}
.bn{display:flex;align-items:flex-start;gap:10px;border-radius:16px;padding:12px 16px;font-size:14px;line-height:1.4}
.bn svg{margin-top:1px;flex-shrink:0}
.in{height:44px;width:100%;border-radius:12px;border:1px solid var(--field);background:var(--surface);padding:0 14px;font-size:14px;color:var(--text)}
.in:hover{border-color:color-mix(in srgb,var(--label) 50%,var(--field))}
textarea.in{height:auto;padding:12px;line-height:1.45;resize:vertical}
.in.sm9{height:36px}
.in::placeholder{color:var(--muted)}
.fr{display:grid;grid-template-columns:34% 66%;align-items:center}
.fr.top{align-items:start}
.fr>label,.fr>.lb{font-size:14px;color:var(--label)}
.fr.top>label{padding-top:10px}
.req{color:var(--red-ink)}
.flt{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:500;color:var(--label)}
.tbl{width:100%;border-collapse:collapse;font-size:14px}
.tbl th{white-space:nowrap;border-bottom:1px solid var(--line);padding:10px 12px;text-align:left;font-size:12px;font-weight:500;color:var(--muted)}
.tbl td{border-bottom:1px solid var(--line-soft);padding:10px 12px;vertical-align:middle}
.tbl tbody tr:hover{background:color-mix(in srgb,var(--sunken) 60%,transparent)}
.bar{height:8px;overflow:hidden;border-radius:999px;background:var(--sunken)}
.bar span{display:block;height:100%;border-radius:999px}
.f-accent{background:var(--accent)} .f-green{background:var(--green)} .f-amber{background:var(--amber)} .f-red{background:var(--red)}
.code{border-radius:4px;background:var(--grey-bg);padding:2px 6px;font-family:'IBM Plex Mono',monospace;font-size:13px}
.hr{border-top:1px solid var(--line-soft)}
.cb{width:16px;height:16px;accent-color:var(--accent)}
.tabs{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--line)}
.ico{flex-shrink:0}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.overlay{position:absolute;inset:0;background:var(--backdrop);backdrop-filter:blur(4px);display:flex;align-items:flex-start;justify-content:center;padding-top:150px;z-index:5}
.dlg{width:560px;max-width:94%;border-radius:20px;border:1px solid var(--line);background:var(--surface);color:var(--text);box-shadow:var(--shadow);padding:24px;display:flex;flex-direction:column;gap:16px}
.dlg h2{font-size:18px;font-weight:600}
`;

export const P = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  terminal: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 9l3 3-3 3M12 15h5",
  report: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  graph: "M8.5 6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M20.5 6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M14.5 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M7.2 8.2l3.6 7.6M16.8 8.2l-3.6 7.6M8.5 6h7",
  users: "M12.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2",
  template: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M8 8h8M8 12h8M8 16h5",
  chip: "M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4",
  shield: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM9 12l2 2 4-4",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  alert: "M12 3l10 18H2zM12 10v5M12 18v.01",
  check: "M5 12l5 5 9-10",
  x: "M6 6l12 12M18 6L6 18",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upload: "M12 20V9M7 14l5-5 5 5M5 4h14",
  print: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  back: "M15 6l-6 6 6 6",
  fwd: "M9 6l6 6-6 6",
  down: "M6 9l6 6 6-6",
  up: "M6 15l6-6 6 6",
  target: "M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6M12 7.5v.01",
  spinner: "M12 3a9 9 0 1 0 9 9",
  plus: "M12 5v14M5 12h14",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  minus: "M5 12h14",
  fit: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
};

export const I = (name, size = 20, style = "") =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${style ? ` style="${style}"` : ""}><path d="${P[name]}"></path></svg>`;

export const LOGO = (size = 30) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 44 44" aria-hidden="true"><rect width="44" height="44" rx="14" fill="var(--accent)"></rect><g stroke="var(--on-accent)" stroke-width="2.4" fill="none"><path d="M14 15l8 14M30 15l-8 14M14 15h16"></path></g><g fill="var(--on-accent)"><circle cx="14" cy="15" r="3.8"></circle><circle cx="30" cy="15" r="3.8"></circle><circle cx="22" cy="29" r="3.8"></circle></g></svg>`;

export const chip = (tone, text, style = "") => `<span class="chip ${tone || "grey"}"${style ? ` style="${style}"` : ""}>${text}</span>`;

/** Button or link-button. o: {v: p|d|gh, icon, s, href, dis, style, type, aria} */
export function btn(label, o = {}) {
  const cls = ["btn", o.v, o.s && "s", o.dis && o.href && "dis"].filter(Boolean).join(" ");
  const inner = `${o.icon ? I(o.icon, 18) : ""}${label}`;
  const st = o.style ? ` style="${o.style}"` : "";
  const aria = o.aria ? ` aria-label="${o.aria}" title="${o.aria}"` : "";
  if (o.href) return `<a class="${cls}" href="${o.href}"${st}${aria}>${inner}</a>`;
  return `<button type="${o.type || "button"}" class="${cls}"${o.dis ? " disabled" : ""}${st}${aria}>${inner}</button>`;
}

let uid = 0;
export const nid = (p = "f") => `${p}${++uid}`;

export const input = (o = {}) => {
  const a = [`class="in${o.cls ? " " + o.cls : ""}"`, `type="${o.type || "text"}"`];
  if (o.id) a.push(`id="${o.id}"`);
  if (o.value != null) a.push(`value="${o.value}"`);
  if (o.ph) a.push(`placeholder="${o.ph}"`);
  if (o.ro) a.push("readonly");
  if (o.aria) a.push(`aria-label="${o.aria}"`);
  if (o.style) a.push(`style="${o.style}"`);
  return `<input ${a.join(" ")}>`;
};
export const select = (opts, o = {}) => {
  const a = [`class="in${o.cls ? " " + o.cls : ""}"`];
  if (o.id) a.push(`id="${o.id}"`);
  if (o.aria) a.push(`aria-label="${o.aria}"`);
  if (o.style) a.push(`style="${o.style}"`);
  const sel = o.sel ?? 0;
  return `<select ${a.join(" ")}>${opts.map((t, i) => `<option${i === sel ? " selected" : ""}>${t}</option>`).join("")}</select>`;
};
export const textarea = (text, o = {}) => {
  const a = [`class="in${o.cls ? " " + o.cls : ""}"`, `rows="${o.rows || 3}"`];
  if (o.id) a.push(`id="${o.id}"`);
  if (o.ph) a.push(`placeholder="${o.ph}"`);
  if (o.aria) a.push(`aria-label="${o.aria}"`);
  if (o.style) a.push(`style="${o.style}"`);
  return `<textarea ${a.join(" ")}>${text || ""}</textarea>`;
};

/** Form row: label 34 %, control 66 %. ctl(id) returns the control html. */
export function fr(label, ctl, o = {}) {
  const id = nid();
  return `<div class="fr${o.top ? " top" : ""}"><label for="${id}">${label}${o.req ? ' <span class="req">*</span>' : ""}</label>${ctl(id)}</div>`;
}
export const flt = (label, control, style = "") => `<label class="flt"${style ? ` style="${style}"` : ""}>${label}${control}</label>`;

export const card = (html, o = {}) => `<section class="card${o.np ? " np" : ""}"${o.style ? ` style="${o.style}"` : ""}${o.aria ? ` aria-label="${o.aria}"` : ""}>${html}</section>`;
export const ct = (title, aside = "", tag = "h2") => `<div class="ct"><${tag}>${title}</${tag}>${aside}</div>`;
export const kpi = (label, value, hint, danger) =>
  card(`<span class="muted">${label}</span><b${danger ? ' style="color: var(--red-ink);"' : ""}>${value}</b>${hint ? `<span class="xs muted">${hint}</span>` : ""}`, { style: "display: flex; flex-direction: column; gap: 6px;" }).replace('class="card"', 'class="card kpi"');
export const bar = (pct, tone = "accent") => `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemax="100"><span class="f-${tone}" style="width: ${pct}%;"></span></div>`;
export const banner = (tone, icon, html, role = "status") => `<div class="bn ${tone}" role="${role}">${icon ? I(icon, 18) : ""}<div style="min-width: 0;">${html}</div></div>`;
export const table = (heads, rows, o = {}) =>
  `<div style="overflow-x: auto;"><table class="tbl"><thead><tr>${heads.map((h) => (typeof h === "string" ? `<th>${h}</th>` : `<th style="${h.style}">${h.t}</th>`)).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
export const tr = (cells, attrs = "") => `<tr${attrs ? " " + attrs : ""}>${cells.map((c) => (typeof c === "string" || typeof c === "number" ? `<td>${c}</td>` : `<td${c.cls ? ` class="${c.cls}"` : ""}${c.style ? ` style="${c.style}"` : ""}${c.span ? ` colspan="${c.span}"` : ""}>${c.h}</td>`)).join("")}</tr>`;

export const pageHeader = (title, { sub, actions, crumbs } = {}) =>
  `<header class="ph"><div style="min-width: 0;">${crumbs ? `<div class="crumbs">${crumbs}</div>` : ""}<h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div>${actions ? `<div class="acts">${actions}</div>` : ""}</header>`;
export const page = (html, style = "") => `<main class="page"${style ? ` style="${style}"` : ""}>${html}</main>`;

export const themeToggle = (href) => {
  const inner = `<span class="ico-moon">${I("moon", 18)}</span><span class="ico-sun">${I("sun", 18)}</span>`;
  return href
    ? `<a class="tt" href="${href}" aria-label="Переключить тему" title="Переключить тему">${inner}</a>`
    : `<button type="button" class="tt" aria-label="Переключить тему (в макете — тумблер dark в Tweaks)" title="Переключить тему">${inner}</button>`;
};

export const NAV = {
  student: { user: "Обучающийся 1", ini: "О1", items: [["Мои назначения", "home", "StudentHome"], ["Протоколы", "report", "StudentReports"], ["Мои навыки", "graph", "StudentSkills"]] },
  teacher: { user: "Преподаватель 1", ini: "П1", items: [["Группы", "users", "TeacherGroup"], ["Назначения", "template", "TeacherAssignments"], ["Экспорт отчётов", "download", "TeacherExport"]] },
  methodist: { user: "Пользователь 1", ini: "П1", items: [["Граф компетенций", "graph", "SkillGraph"], ["Шаблоны сценариев", "template", "Templates"], ["Целевые уровни", "target", "Targets"]] },
  admin: { user: "Пользователь 2", ini: "П2", items: [["Пользователи и роли", "users", "AdminUsers"], ["LLM и песочницы", "chip", "AdminLlm"], ["Аудит и безопасность", "shield", "AdminAudit"]] },
  sysadmin: { user: "Пользователь 3", ini: "П3", items: [["Состояние системы", "activity", "SysHealth"], ["Аудит и безопасность", "shield", "SysAudit"]] },
};
const GROUP_TITLE = { student: "Обучающийся", teacher: "Преподаватель", methodist: "Методист", admin: "Администратор", sysadmin: "Системный администратор" };

export function appHeader(role, active) {
  const n = NAV[role];
  const items = n.items.map(([label, icon, file], i) =>
    `<a class="pill${i === active ? " on" : ""}" href="${file}.dc.html"${i === active ? ' aria-current="page"' : ""}>${I(icon, 17)}${label}</a>`).join("");
  return `<header class="hdr"><div class="top-in">
<nav class="pills" aria-label="Основное меню"><span class="brand">${LOGO(30)}МАССО</span><div class="grp" role="group" aria-label="${GROUP_TITLE[role]}">${items}</div></nav>
${themeToggle()}
<div class="ubox"><span class="ava" aria-hidden="true">${n.ini}</span><span class="uname">${n.user}</span><a class="out" href="Main.dc.html" aria-label="Выйти" title="Выйти">${I("logout", 17)}</a></div>
</div></header>`;
}

/** Full app shell (header + centred content). */
export const shell = (role, active, body, pre = "") => `${appHeader(role, active)}
<div class="wrapc">${pre}${body}</div>`;

export const FONT = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&amp;family=IBM+Plex+Sans:wght@400;500;600;700&amp;display=swap";

export function doc({ title, body, height, dark = false, extraCss = "" }) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="${FONT}">
<style>${CSS}${extraCss}</style>
</helmet>
<div class="{{theme}}" style="position: relative; width: 100%; min-height: ${height >= 900 ? 900 : height}px; display: flex; flex-direction: column; background: var(--bg); color: var(--text); font-family: 'IBM Plex Sans', system-ui, sans-serif; font-size: 14px; line-height: 1.45;">
${body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"dark":{"editor":"boolean","default":${dark}},"$preview":{"width":1440,"height":${height}}}'>
class Component extends DCLogic {
  renderVals() { return { theme: this.props.dark ? 't-dark' : 't-light' }; }
}
</script>
</body>
</html>
`;
}
