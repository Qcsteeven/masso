// Renders the Claude Design artboards (docs/mockups/canvas/project/*.dc.html) to PNG for the ТП.
// Run from the repo root:
//   PATH=$HOME/.nvm/versions/node/v22.23.4/bin:$PATH node docs/mockups/render.mjs [Artboard ...]
// Each artboard is turned into static HTML (support.js and the x-dc logic block removed, <x-dc>/<helmet>
// unwrapped, {{theme}} → t-light / t-dark from the default of the `dark` prop) and captured full-page
// at 1440 px width, deviceScaleFactor 1.5. It also writes docs/mockups/static/<Artboard>.html — the same
// static page with links between screens pointing to .html and a working theme toggle (class on the root),
// for import into Figma or viewing without Claude Design.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "/home/lcatharsis/masso/frontend/node_modules/@playwright/test/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const CANVAS = join(here, "canvas", "project");
export const PNG_DIR = join(here, "png");
export const STATIC_DIR = join(here, "static");

/** Artboard → PNG name (fig36–51 for the ТП figures, extra_* for the other screens). */
export const PNG = {
  Main: "fig36_login",
  StudentHome: "fig37_student-home",
  WorkspaceContainer: "fig38_workspace-container",
  WorkspaceDocument: "fig39_workspace-document",
  WorkspaceCode: "fig40_workspace-code",
  Report: "fig41_report",
  StudentSkills: "fig42_student-skills",
  TeacherGroup: "fig43_teacher-group",
  TeacherTrace: "fig44_teacher-trace",
  SkillGraph: "fig45_methodist-skill-graph",
  TemplateEditor: "fig46_methodist-template",
  Targets: "fig47_methodist-targets",
  AdminUsers: "fig48_admin-users",
  AdminLlm: "fig49_admin-llm",
  SysHealth: "fig50_sysadmin-health",
  WorkspaceDark: "fig51_workspace-dark",
  StudentReports: "extra_student-reports",
  HintDialog: "extra_hint-dialog",
  TeacherAssignments: "extra_teacher-assignments",
  TeacherExport: "extra_teacher-export",
  Templates: "extra_methodist-templates",
  DomainDialog: "extra_domain-dialog",
  AdminAudit: "extra_admin-audit",
  SysAudit: "extra_sysadmin-audit",
};

/** Static HTML of an artboard: what the canvas shows with the default props. */
export function toStatic(src) {
  const props = /data-props='([^']*)'/.exec(src);
  const dark = props ? JSON.parse(props[1]).dark?.default === true : false;
  return src
    .replace(/^\s*<script src="\.\/support\.js"><\/script>\s*$/m, "")
    .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, "")
    .replace(/<\/?x-dc>/g, "")
    .replace(/<\/?helmet>/g, "")
    .replace(/\{\{theme\}\}/g, dark ? "t-dark" : "t-light");
}

const TOGGLE = `<script>
// static mockup: the theme button switches the root class t-light / t-dark
document.querySelectorAll(".tt").forEach(function (b) {
  b.addEventListener("click", function (e) {
    e.preventDefault();
    var root = document.querySelector(".t-light, .t-dark");
    if (!root) return;
    var dark = root.classList.contains("t-dark");
    root.classList.toggle("t-dark", !dark);
    root.classList.toggle("t-light", dark);
  });
});
</script>`;

/** Stand-alone page for docs/mockups/static: .dc.html links → .html, theme toggle works in place. */
export function toStaticSite(src) {
  return toStatic(src)
    .replace(/href="([A-Za-z]+)\.dc\.html"/g, 'href="$1.html"')
    .replace(/action="([A-Za-z]+)\.dc\.html"/g, 'action="$1.html"')
    .replace(/<\/body>/, `${TOGGLE}\n</body>`);
}

export function writeStatic(names) {
  mkdirSync(STATIC_DIR, { recursive: true });
  for (const name of names) {
    writeFileSync(join(STATIC_DIR, `${name}.html`), toStaticSite(readFileSync(join(CANVAS, `${name}.dc.html`), "utf8")));
  }
}

export async function shoot(names, { out = PNG_DIR, log = true } = {}) {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  const sizes = {};
  for (const name of names) {
    const html = toStatic(readFileSync(join(CANVAS, `${name}.dc.html`), "utf8"));
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    sizes[name] = { w, h };
    const file = join(out, `${PNG[name] ?? `extra_${name}`}.png`);
    await page.screenshot({ path: file, fullPage: true });
    if (log) console.log(`${name.padEnd(20)} ${w}×${h}  → ${file}`);
  }
  await browser.close();
  return sizes;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const all = readdirSync(CANVAS).filter((f) => f.endsWith(".dc.html")).map((f) => f.replace(/\.dc\.html$/, ""));
  const names = process.argv.slice(2).length ? process.argv.slice(2) : all;
  await shoot(names);
  writeStatic(names);
  console.log(`static pages → ${STATIC_DIR}`);
}
