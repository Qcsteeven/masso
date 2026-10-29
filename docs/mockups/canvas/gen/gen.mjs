// Generates the artboards + canvas.json, measures heights in Chromium, rewrites with exact heights, shoots PNGs.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { doc } from "./lib.mjs";
import * as S from "./student.mjs";
import * as T from "./staff.mjs";
import { CANVAS, shoot, writeStatic } from "/home/lcatharsis/masso/docs/mockups/render.mjs";

const B = {
  Main: ["Рис. 36. Вход в систему", "МАССО — вход", S.login],
  StudentHome: ["Рис. 37. Панель обучающегося", "Мои назначения", S.studentHome],
  WorkspaceContainer: ["Рис. 38. Рабочая область: сценарий с учебным сервером", "Рабочая область — терминал", () => S.workspaceContainer()],
  WorkspaceDocument: ["Рис. 39. Рабочая область: документный сценарий", "Рабочая область — документы", S.workspaceDocument],
  WorkspaceCode: ["Рис. 40. Рабочая область: задача на код", "Рабочая область — код", S.workspaceCode],
  HintDialog: ["Рабочая область: запрос подсказки", "Рабочая область — подсказка", () => S.workspaceContainer({ hint: true })],
  Report: ["Рис. 41. Протокол прохождения", "Протокол прохождения", S.report],
  StudentReports: ["Протоколы обучающегося", "Протоколы", S.studentReports],
  StudentSkills: ["Рис. 42. Карта компетенций обучающегося", "Мои навыки", S.studentSkills],
  WorkspaceDark: ["Рис. 51. Рабочая область в тёмной теме", "Рабочая область — тёмная тема", () => S.workspaceContainer({ themeHref: "WorkspaceContainer.dc.html" }), true],
  TeacherGroup: ["Рис. 43. Панель группы", "Панель группы", T.teacherGroup],
  TeacherTrace: ["Рис. 44. Цифровой след и корректировка оценки", "Цифровой след", T.teacherTrace],
  TeacherAssignments: ["Назначения группе", "Назначения", T.teacherAssignments],
  TeacherExport: ["Экспорт отчётов", "Экспорт отчётов", T.teacherExport],
  SkillGraph: ["Рис. 45. Граф компетенций", "Граф компетенций", T.skillGraph],
  DomainDialog: ["Граф компетенций: новый домен", "Новый домен", T.domainDialog],
  Templates: ["Шаблоны сценариев", "Шаблоны сценариев", T.templates],
  TemplateEditor: ["Рис. 46. Шаблон сценария и отчёт валидации", "Шаблон сценария", T.templateEditor],
  Targets: ["Рис. 47. Целевые уровни направления", "Целевые уровни", T.targets],
  AdminUsers: ["Рис. 48. Пользователи и роли", "Пользователи и роли", T.adminUsers],
  AdminLlm: ["Рис. 49. LLM и песочницы", "LLM и песочницы", T.adminLlm],
  AdminAudit: ["Аудит и безопасность", "Аудит и безопасность", T.adminAudit],
  SysHealth: ["Рис. 50. Состояние системы", "Состояние системы", T.sysHealth],
  SysAudit: ["Аудит и безопасность (системный администратор)", "Аудит и безопасность", T.sysAudit],
};
const ROWS = [
  ["Вход", ["Main"]],
  ["Обучающийся", ["StudentHome", "WorkspaceContainer", "WorkspaceDocument", "WorkspaceCode", "HintDialog", "Report", "StudentReports", "StudentSkills", "WorkspaceDark"]],
  ["Преподаватель", ["TeacherGroup", "TeacherTrace", "TeacherAssignments", "TeacherExport"]],
  ["Методист", ["SkillGraph", "DomainDialog", "Templates", "TemplateEditor", "Targets"]],
  ["Администратор", ["AdminUsers", "AdminLlm", "AdminAudit"]],
  ["Системный администратор", ["SysHealth", "SysAudit"]],
];

mkdirSync(CANVAS, { recursive: true });
const hFile = new URL("./heights.json", import.meta.url);
let heights = existsSync(hFile) ? JSON.parse(readFileSync(hFile, "utf8")) : {};
const write = () => {
  for (const [name, [, title, fn, dark]] of Object.entries(B)) {
    writeFileSync(join(CANVAS, `${name}.dc.html`), doc({ title: `МАССО — ${title}`.replace("МАССО — МАССО — ", "МАССО — "), body: fn(), height: heights[name] ?? 900, dark: !!dark }));
  }
};
write();
const names = Object.keys(B);
let sizes = await shoot(names, { log: false });
const changed = names.filter((n) => sizes[n].h !== heights[n]);
if (changed.length) {
  heights = Object.fromEntries(names.map((n) => [n, sizes[n].h]));
  writeFileSync(hFile, JSON.stringify(heights, null, 1));
  write();
  sizes = await shoot(names, { log: false });
}

// canvas.json
const boards = {}, order = [], notes = {};
let y = 240;
ROWS.forEach(([title, list], ri) => {
  notes[`row-${ri + 1}`] = { kind: "title1", text: title, x: 0, y: y - 240, w: 1440, h: 120 };
  let x = 0, maxH = 0;
  for (const name of list) {
    const h = heights[name];
    boards[`${name}.dc.html`] = { x, y, w: 1440, h, title: B[name][0], expand: "fill", is_interactive: true };
    order.push(`${name}.dc.html`);
    x += 1440 + 80;
    maxH = Math.max(maxH, h);
  }
  y += maxH + 120 + 240;
});
const canvas = {
  v: 3,
  createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, "Z") },
  title: "МАССО — макеты интерфейса",
  launch: { view: "canvas" },
  pages: [],
  boards,
  order,
  notes,
  designSystems: [],
};
writeFileSync(join(CANVAS, "canvas.json"), JSON.stringify(canvas, null, 2) + "\n");
for (const n of names) console.log(`${n.padEnd(20)} ${sizes[n].w}×${sizes[n].h}`);
writeStatic(names);
