// Turns docs/mockups/figma/data/*.json into use_figma scripts (docs/mockups/figma/calls/*.js):
//   00_setup.js  — color variables (modes «Светлая»/«Тёмная»), icon components, row titles
//   NN_<Screen>.js — one screen frame built from editable layers, colors bound to variables
//   99_links.js  — prototype links (click → navigate) between screens, flow start at the login screen
// usage: node gen.mjs
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const dataDir = path.join(here, "data");
const outDir = path.join(here, "calls");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const canvas = JSON.parse(fs.readFileSync(path.join(here, "..", "canvas", "project", "canvas.json"), "utf8"));
const LIMIT = 47000;

// ---------- theme tokens from the static pages ----------
const sample = fs.readFileSync(path.join(here, "..", "static", "Main.html"), "utf8");
const tokens = (cls) =>
  Object.fromEntries([...sample.match(new RegExp("\\." + cls + "\\{([^}]*)\\}"))[1].matchAll(/--([a-z0-9-]+):(#[0-9a-f]{3,8})/gi)].map((m) => [m[1], m[2]]));
const light = tokens("t-light");
const dark = tokens("t-dark");

// ---------- icons ----------
const icons = [];
const iconIdx = new Map();
const screens = canvas.order.map((f) => f.replace(/\.dc\.html$/, "")).filter((s) => fs.existsSync(path.join(dataDir, s + ".json")));
const datas = Object.fromEntries(screens.map((s) => [s, JSON.parse(fs.readFileSync(path.join(dataDir, s + ".json"), "utf8"))]));
for (const s of screens) {
  (function walk(n) {
    if (n.k === "v") { if (!iconIdx.has(n.v)) { iconIdx.set(n.v, icons.length); icons.push(n.v); } }
    for (const c of n.ch || []) walk(c);
  })(datas[s].root);
}

const RUNTIME = String.raw`
const COL = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === (THEME === "dark" ? "МАССО · тёмная тема" : "МАССО · светлая тема"));
const VARS = {};
for (const id of COL.variableIds) { const v = await figma.variables.getVariableByIdAsync(id); VARS[v.name] = v; }
const ICONS = {};
const IP = figma.root.children.find(p => p.name === "Иконки"); await IP.loadAsync();
for (const n of IP.children) if (n.type === "COMPONENT") ICONS[n.name.slice(5)] = n;
for (const st of ["Regular", "Medium", "SemiBold", "Bold"]) await figma.loadFontAsync({ family: "IBM Plex Sans", style: st });
for (const st of ["Regular", "Medium"]) await figma.loadFontAsync({ family: "IBM Plex Mono", style: st });
const hexRgb = h => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }; };
const paint = (c) => {
  const [tok, a] = c;
  if (VARS[tok]) return figma.variables.setBoundVariableForPaint({ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: a }, "color", VARS[tok]);
  return { type: "SOLID", color: hexRgb(tok), opacity: a };
};
const SHADOW = [{ type: "DROP_SHADOW", color: { r: 0.11, g: 0.1, b: 0.09, a: 0.06 }, offset: { x: 0, y: 6 }, radius: 24, spread: 0, visible: true, blendMode: "NORMAL" }];
let count = 0;
function build(n, parent) {
  count++;
  if (n[0] === 0) {
    const [, x, y, w, h, s, si] = n; const st = TS[si];
    const t = figma.createText();
    t.fontName = { family: st.m ? "IBM Plex Mono" : "IBM Plex Sans", style: st.m ? (st.fw === "Regular" || !st.fw ? "Regular" : "Medium") : (st.fw || "Regular") };
    t.characters = s; t.fontSize = st.fs;
    if (st.c) t.fills = [paint(st.c)];
    if (st.u) t.textCase = "UPPER";
    if (st.ud) t.textDecoration = "UNDERLINE";
    if (st.ls) t.letterSpacing = { unit: "PIXELS", value: st.ls };
    if (st.lh) t.lineHeight = { unit: "PIXELS", value: st.lh };
    parent.appendChild(t);
    if (st.ml) { t.textAutoResize = "HEIGHT"; t.resize(Math.max(w, 1), Math.max(h, 1)); } else t.textAutoResize = "WIDTH_AND_HEIGHT";
    t.x = x; t.y = y; return;
  }
  if (n[0] === 2) {
    const [, x, y, w, h, vi] = n; const inst = ICONS[vi].createInstance();
    parent.appendChild(inst); inst.resize(Math.max(w, 1), Math.max(h, 1)); inst.x = x; inst.y = y; return;
  }
  const [, x, y, w, h, bi, ch, link, name] = n; const b = BS[bi];
  const f = figma.createFrame();
  f.name = link ? "→ " + link : (name || "Блок");
  f.resize(Math.max(w, 1), Math.max(h, 1)); f.x = x; f.y = y;
  f.fills = b.f ? [paint(b.f)] : [];
  if (b.s) {
    f.strokes = [paint(b.s)]; f.strokeAlign = "INSIDE";
    const [t, r, bo, l] = b.sw;
    if (t === r && r === bo && bo === l) f.strokeWeight = t; else { f.strokeTopWeight = t; f.strokeRightWeight = r; f.strokeBottomWeight = bo; f.strokeLeftWeight = l; }
  }
  if (b.r !== undefined) { if (Array.isArray(b.r)) { [f.topLeftRadius, f.topRightRadius, f.bottomRightRadius, f.bottomLeftRadius] = b.r; } else f.cornerRadius = b.r; }
  if (b.sh) f.effects = SHADOW;
  if (b.o !== undefined) f.opacity = b.o;
  f.clipsContent = !!b.c;
  parent.appendChild(f);
  for (const c of ch || []) build(c, f);
}
`;

// ---------- 00_setup ----------
{
  const rows = Object.values(canvas.notes || {}).filter((n) => n.kind === "title1");
  const code = `
const created = [];
let col = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === "Тема МАССО");
if (!col) {
  col = figma.variables.createVariableCollection("Тема МАССО");
  col.renameMode(col.modes[0].modeId, "Светлая");
  col.addMode("Тёмная");
}
const LIGHT = ${JSON.stringify(light)};
const DARK = ${JSON.stringify(dark)};
const hexRgb = h => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a: 1 }; };
const existing = new Set();
for (const id of col.variableIds) existing.add((await figma.variables.getVariableByIdAsync(id)).name);
const [lm, dm] = col.modes.map(m => m.modeId);
for (const [name, hex] of Object.entries(LIGHT)) {
  if (existing.has(name)) continue;
  const v = figma.variables.createVariable(name, col, "COLOR");
  v.scopes = name.includes("ink") || ["text", "muted", "label"].includes(name) ? ["TEXT_FILL", "SHAPE_FILL", "STROKE_COLOR"] : ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR", "TEXT_FILL"];
  v.setValueForMode(lm, hexRgb(hex));
  v.setValueForMode(dm, hexRgb(DARK[name] || hex));
  created.push(v.id);
}
figma.root.children[0].name = "Макеты";
let iconPage = figma.root.children.find(p => p.name === "Иконки");
if (!iconPage) { iconPage = figma.createPage(); iconPage.name = "Иконки"; }
await figma.setCurrentPageAsync(iconPage);
const SVGS = ${JSON.stringify(icons)};
const have = new Set(iconPage.children.map(n => n.name));
SVGS.forEach((svg, i) => {
  if (have.has("icon/" + i)) return;
  const node = figma.createNodeFromSvg(svg);
  const comp = figma.createComponentFromNode(node);
  comp.name = "icon/" + i; comp.x = (i % 20) * 40; comp.y = Math.floor(i / 20) * 40;
  created.push(comp.id);
});
return { collection: col.id, modes: col.modes, vars: Object.keys(LIGHT).length, icons: SVGS.length, created: created.length };
`;
  fs.writeFileSync(path.join(outDir, "00_setup.js"), code);
  const titles = `
await figma.loadFontAsync({ family: "IBM Plex Sans", style: "Bold" });
const ids = [];
for (const r of ${JSON.stringify(rows.map((r) => ({ text: r.text, x: r.x, y: r.y })))}) {
  const t = figma.createText(); t.fontName = { family: "IBM Plex Sans", style: "Bold" }; t.characters = r.text; t.fontSize = 72;
  t.x = r.x; t.y = r.y + 40; t.name = "Ряд: " + r.text; ids.push(t.id);
}
return { ids };
`;
  fs.writeFileSync(path.join(outDir, "01_titles.js"), titles);
}

// ---------- screens ----------
let callNo = 2;
for (const s of screens) {
  const d = datas[s];
  const board = canvas.boards[s + ".dc.html"];
  const TS = [];
  const tsKey = new Map();
  const BS = [];
  const bsKey = new Map();
  const idx = (arr, map, obj) => { const k = JSON.stringify(obj); if (!map.has(k)) { map.set(k, arr.length); arr.push(obj); } return map.get(k); };
  const enc = (n) => {
    if (n.k === "t") {
      const { k, x, y, w, h, s: str, ...st } = n;
      return [0, x, y, w, h, str, idx(TS, tsKey, st)];
    }
    if (n.k === "v") return [2, n.x, n.y, n.w, n.h, iconIdx.get(n.v)];
    const { k, x, y, w, h, ch, l, n: name, ...st } = n;
    const keepName = name && !/^(div|span|section|main|header|nav|p|ul|li|label|a|button|form|aside|footer|table|tr|td|th|thead|tbody|h\d)(\.|$)/.test(name) ? name : 0;
    const out = [1, x, y, w, h, idx(BS, bsKey, st), (ch || []).map(enc)];
    if (l || keepName) out.push(l || 0, keepName || 0);
    return out;
  };
  const root = enc(d.root);
  const title = (board && board.title) || s;
  const head = (payload) => `const THEME = "${d.theme}";\nconst TS = ${JSON.stringify(TS)};\nconst BS = ${JSON.stringify(BS)};\n${RUNTIME}\n${payload}`;
  // whole screen in one call when it fits, otherwise the root frame first and its children in parts
  const whole = head(`
const page = figma.root.children[0];
const old = page.children.find(n => n.name.endsWith("· ${s}"));
if (old) old.remove();
build(${JSON.stringify(root)}, page);
const screen = page.children[page.children.length - 1];
screen.name = ${JSON.stringify(title + " · " + s)};
screen.x = ${board ? board.x : 0}; screen.y = ${board ? board.y : 0}; screen.clipsContent = true;
return { screen: screen.id, nodes: count };
`);
  const files = [];
  if (whole.length <= LIMIT) files.push(whole);
  else {
    const [t, x, y, w, h, bi, ch, ...rest] = root;
    files.push(head(`
const page = figma.root.children[0];
const old = page.children.find(n => n.name.endsWith("· ${s}"));
if (old) old.remove();
build(${JSON.stringify([t, 0, 0, w, h, bi, [], ...rest])}, page);
const screen = page.children[page.children.length - 1];
screen.name = ${JSON.stringify(title + " · " + s)};
screen.x = ${board ? board.x : 0}; screen.y = ${board ? board.y : 0}; screen.clipsContent = true;
return { screen: screen.id, nodes: count };
`));
    let part = [];
    const flush = () => {
      if (!part.length) return;
      files.push(head(`
const screen = figma.root.children[0].children.find(n => n.name.endsWith("· ${s}"));
for (const c of ${JSON.stringify(part)}) build(c, screen);
return { screen: screen.id, nodes: count };
`));
      part = [];
    };
    for (const c of ch) {
      part.push(c);
      if (head(JSON.stringify(part)).length > LIMIT - 600) { part.pop(); flush(); part.push(c); }
    }
    flush();
  }
  files.forEach((code, i) => {
    const name = `${String(callNo).padStart(2, "0")}_${s}${files.length > 1 ? "_" + (i + 1) : ""}.js`;
    fs.writeFileSync(path.join(outDir, name), code);
    if (code.length > LIMIT) console.warn("TOO BIG", name, code.length);
  });
  callNo++;
}

// ---------- links ----------
fs.writeFileSync(
  path.join(outDir, "99_links.js"),
  `
const page = figma.root.children[0];
const screens = {};
for (const n of page.children) { const m = n.name.match(/· (\\w+)$/); if (m) screens[m[1]] = n; }
let set = 0; const missing = [];
for (const link of page.findAll(n => n.type === "FRAME" && n.name.startsWith("→ "))) {
  const dest = screens[link.name.slice(2)];
  if (!dest) { missing.push(link.name); continue; }
  await link.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: dest.id, navigation: "NAVIGATE", transition: null, preserveScrollPosition: false }] }]);
  set++;
}
page.flowStartingPoints = [{ nodeId: screens.Main.id, name: "МАССО — вход" }];
return { set, missing: [...new Set(missing)] };
`,
);
for (const f of fs.readdirSync(outDir)) console.log(f, (fs.statSync(path.join(outDir, f)).size / 1024).toFixed(1) + " KB");
