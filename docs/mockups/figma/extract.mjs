// Renders docs/mockups/static/<Screen>.html and writes docs/mockups/figma/data/<Screen>.json:
// a compact tree of boxes, texts and SVG icons with colors as theme tokens (for Figma variables).
// usage: node extract.mjs [Screen ...]   (default: every static screen)
import { chromium } from "../../../frontend/node_modules/@playwright/test/index.mjs";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const staticDir = path.join(here, "..", "static");
const outDir = path.join(here, "data");
fs.mkdirSync(outDir, { recursive: true });
const screens = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(staticDir).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, ""));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
for (const name of screens) {
  await page.goto("file://" + path.join(staticDir, name + ".html"));
  await page.evaluate(() => document.fonts.ready);
  const tree = await page.evaluate(() => {
    const root = document.querySelector(".t-light, .t-dark");
    const theme = root.classList.contains("t-dark") ? "dark" : "light";
    const rs = getComputedStyle(root);
    // token table of the root theme: rgb -> token names
    const css = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } }).map((r) => r.cssText).join("\n");
    const names = [...new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]))];
    const probe = document.createElement("div");
    root.appendChild(probe);
    const byRgb = {};
    for (const n of names) {
      probe.style.color = "";
      probe.style.color = `var(--${n})`;
      const c = getComputedStyle(probe).color;
      if (c && probe.style.color) (byRgb[c] ||= []).push(n);
    }
    probe.remove();
    const R = root.getBoundingClientRect();
    const rnd = (v) => Math.round(v);
    const parseRgb = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const hex = (o) => "#" + [o.r, o.g, o.b].map((v) => v.toString(16).padStart(2, "0")).join("");
    const inlineVar = (el, props) => {
      const st = el.getAttribute("style") || "";
      for (const p of props) {
        const m = st.match(new RegExp("(?:^|;)\\s*" + p + "\\s*:[^;]*var\\(--([a-z0-9-]+)\\)"));
        if (m) return m[1];
      }
      return null;
    };
    const PREF = {
      bg: ["bg", "surface", "sunken", "nav", "accent", "term", "term-bar", "field", "line"],
      text: ["text", "muted", "label", "on-accent", "on-nav", "accent", "term-ink"],
      line: ["line", "line-soft", "field", "accent"],
    };
    const color = (c, el, props, kind) => {
      const o = parseRgb(c);
      if (!o || o.a === 0) return null;
      const opaque = `rgb(${o.r}, ${o.g}, ${o.b})`;
      let tok = inlineVar(el, props);
      const cands = byRgb[opaque] || [];
      if (!tok || !cands.includes(tok)) tok = PREF[kind].find((n) => cands.includes(n)) || cands[0] || null;
      return [tok || hex(o), +o.a.toFixed(2)];
    };
    const styleName = (w) => (w >= 700 ? "Bold" : w >= 600 ? "SemiBold" : w >= 500 ? "Medium" : "Regular");

    function box(el, cs, r, base) {
      const n = { k: "b", x: rnd(r.left - base.x), y: rnd(r.top - base.y), w: rnd(r.width), h: rnd(r.height) };
      const tag = el.tagName.toLowerCase();
      n.n = el.getAttribute("aria-label") || el.getAttribute("title") || tag + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "");
      const f = color(cs.backgroundColor, el, ["background", "background-color"], "bg");
      if (f) n.f = f;
      const sides = ["Top", "Right", "Bottom", "Left"].map((s) => parseFloat(cs["border" + s + "Width"]) || 0);
      if (sides.some((v) => v > 0)) {
        const side = sides.findIndex((v) => v > 0);
        const s = color(cs["border" + ["Top", "Right", "Bottom", "Left"][side] + "Color"], el, ["border", "border-color", "border-bottom", "border-top"], "line");
        if (s) { n.s = s; n.sw = sides; }
      }
      const rad = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"].map((c) => {
        const v = cs["border" + c + "Radius"];
        return v.endsWith("%") ? Math.min(r.width, r.height) * parseFloat(v) / 100 : parseFloat(v) || 0;
      });
      if (rad.some((v) => v > 0)) n.r = rad.every((v) => v === rad[0]) ? rnd(rad[0]) : rad.map(rnd);
      if (cs.boxShadow && cs.boxShadow !== "none") n.sh = 1;
      if (+cs.opacity < 1) n.o = +(+cs.opacity).toFixed(2);
      if (cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.overflowX === "auto") n.c = 1;
      const href = tag === "a" && el.getAttribute("href");
      if (href && /\.html$/.test(href)) n.l = href.replace(/\.html$/, "");
      return n;
    }

    function textNode(t, base, cs) {
      const raw = cs.whiteSpace.startsWith("pre") ? t.textContent.replace(/\n$/, "") : t.textContent.replace(/\s+/g, " ").trim();
      if (!raw) return null;
      const range = document.createRange();
      range.selectNodeContents(t);
      const r = range.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      const tops = new Set([...range.getClientRects()].map((q) => Math.round(q.top)));
      const n = { k: "t", x: rnd(r.left - base.x), y: rnd(r.top - base.y), w: Math.ceil(r.width) + 1, h: rnd(r.height), s: raw };
      n.fs = parseFloat(cs.fontSize);
      const st = styleName(+cs.fontWeight);
      if (st !== "Regular") n.fw = st;
      if (/mono/i.test(cs.fontFamily)) n.m = 1;
      const c = color(cs.color, t.parentElement, ["color"], "text");
      if (c) n.c = c;
      if (cs.textTransform === "uppercase") n.u = 1;
      const ls = parseFloat(cs.letterSpacing);
      if (ls) n.ls = +ls.toFixed(2);
      const lh = parseFloat(cs.lineHeight);
      if (lh) n.lh = rnd(lh);
      if (cs.textDecorationLine.includes("underline")) n.ud = 1;
      const pre = cs.whiteSpace.startsWith("pre");
      const mixed = [...t.parentElement.childNodes].some((c) => c !== t && (c.nodeType === 1 || c.textContent.trim()));
      if (tops.size > 1 && mixed && !pre) {
        // inline text next to other inline elements: one text layer per rendered line
        const lines = [];
        const txt = t.textContent;
        const q = document.createRange();
        for (let i = 0; i < txt.length; i++) {
          q.setStart(t, i); q.setEnd(t, i + 1);
          const cr = q.getClientRects()[0];
          if (!cr || cr.width === 0) { if (lines.length) lines[lines.length - 1].s += txt[i]; continue; }
          const top = Math.round(cr.top);
          let L = lines[lines.length - 1];
          if (!L || Math.abs(L.top - top) > 2) { L = { top, s: "", l: cr.left, r: cr.right, t: cr.top, b: cr.bottom }; lines.push(L); }
          L.s += txt[i]; L.l = Math.min(L.l, cr.left); L.r = Math.max(L.r, cr.right); L.t = Math.min(L.t, cr.top); L.b = Math.max(L.b, cr.bottom);
        }
        return lines.filter((L) => L.s.trim()).map((L) => ({ ...n, s: L.s.replace(/\s+/g, " ").trim(), x: rnd(L.l - base.x), y: rnd(L.t - base.y), w: Math.ceil(L.r - L.l) + 1, h: rnd(L.b - L.t) }));
      }
      if (tops.size > 1 || pre) n.ml = 1;
      return [n];
    }

    function svg(el, base) {
      const r = el.getBoundingClientRect();
      if (!r.width) return null;
      const clone = el.cloneNode(true);
      const src = [el, ...el.querySelectorAll("*")];
      const dst = [clone, ...clone.querySelectorAll("*")];
      src.forEach((s, i) => {
        const cs = getComputedStyle(s);
        const fix = (prop) => {
          const v = cs[prop];
          const o = parseRgb(v || "");
          if (o && o.a > 0) dst[i].setAttribute(prop, hex(o));
          else if (v === "none") dst[i].setAttribute(prop, "none");
        };
        fix("stroke");
        fix("fill");
        dst[i].removeAttribute("style");
        dst[i].removeAttribute("class");
      });
      clone.setAttribute("width", String(rnd(r.width)));
      clone.setAttribute("height", String(rnd(r.height)));
      clone.removeAttribute("aria-hidden");
      return { k: "v", x: rnd(r.left - base.x), y: rnd(r.top - base.y), w: rnd(r.width), h: rnd(r.height), v: clone.outerHTML };
    }

    function walk(el, base, out) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      const tag = el.tagName.toLowerCase();
      if (tag === "svg") { const s = svg(el, base); if (s) out.push(s); return; }
      if (["script", "style", "link", "meta", "title", "head"].includes(tag)) return;
      const r = el.getBoundingClientRect();
      const b = box(el, cs, r, base);
      const visible = b.f || b.s || b.sh || b.l || ["input", "textarea", "select", "button"].includes(tag);
      let target = out;
      let nb = base;
      if (visible && r.width > 0 && r.height > 0) {
        b.ch = [];
        out.push(b);
        target = b.ch;
        nb = { x: r.left, y: r.top };
      }
      if (tag === "input" || tag === "textarea" || tag === "select") {
        const v = tag === "select" ? el.options[el.selectedIndex]?.text : el.type === "password" && el.value ? "•".repeat(Math.min(el.value.length, 10)) : el.value || el.placeholder;
        if (v) {
          const pad = parseFloat(cs.paddingLeft) || 12;
          const ph = !el.value && tag !== "select";
          const c = ph ? ["muted", 1] : color(cs.color, el, ["color"], "text");
          target.push({ k: "t", x: rnd(pad), y: rnd((r.height - parseFloat(cs.fontSize) * 1.3) / 2), w: rnd(r.width - pad * 2), h: rnd(parseFloat(cs.fontSize) * 1.3), s: v, fs: parseFloat(cs.fontSize), c, ...( /mono/i.test(cs.fontFamily) ? { m: 1 } : {}) });
        }
        return;
      }
      for (const ch of el.childNodes) {
        if (ch.nodeType === 3) {
          const t = textNode(ch, nb, cs);
          if (t) target.push(...t);
        } else if (ch.nodeType === 1) walk(ch, nb, target);
      }
    }

    const out = [];
    walk(root, { x: R.left, y: R.top }, out);
    const top = out[0];
    top.h = Math.max(top.h, Math.round(root.scrollHeight));
    top.n = document.title.replace(/^МАССО — /, "");
    return { theme, root: top };
  });
  const file = path.join(outDir, name + ".json");
  fs.writeFileSync(file, JSON.stringify(tree));
  console.log(name, tree.theme, (fs.statSync(file).size / 1024).toFixed(1) + " KB");
}
await browser.close();
