import { I, banner, bar, btn, card, chip, ct, flt, fr, input, kpi, page, pageHeader, select, shell, table, textarea, tr } from "./lib.mjs";
import { smoothstep } from "./student.mjs";

const L = (f) => `${f}.dc.html`;
const dateIn = (v = "ДД.ММ.ГГГГ", aria) => `<span style="position: relative; display: block;">${input({ value: v, aria, style: "padding-right: 40px; min-width: 150px;" })}<span style="position: absolute; right: 12px; top: 12px; color: var(--label); pointer-events: none;">${I("clock", 18).replace(P_CLOCK, P_CAL)}</span></span>`;
const P_CLOCK = "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2";
const P_CAL = "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M4 10h16M8 3v4M16 3v4";

// ---------- Teacher ----------
const llmBanner = `<div role="status" class="row wrap s13" style="gap: 8px 16px; border-bottom: 1px solid var(--banner-line); background: var(--amber-bg); padding: 10px 32px; color: var(--banner-ink);">${I("alert", 18)}<span style="flex: 1 1 400px;"><b>LLM-контур переключён: локальный режим</b> с ЧЧ:ММ:СС. Активные сессии продолжаются; новые сценарии генерируются локальной моделью.</span></div>`;

export function teacherGroup() {
  const row = (n, s, auto, exp, st) => tr([`Обучающийся ${n}`, `Сценарий ${s}`, { h: "ДД.ММ", cls: "mono" }, auto, exp, { h: st }, { h: `<a href="TeacherTrace.dc.html" aria-label="Открыть цифровой след: Обучающийся ${n}">Открыть</a>` }], 'style="cursor: pointer;"');
  const ps = (n, pct, tone) => `<div style="display: grid; grid-template-columns: minmax(0,1fr) 110px 40px; align-items: center; gap: 12px; font-size: 14px;"><span class="trunc">Навык ${n}</span>${bar(pct, tone)}<span class="tr mono muted">NN%</span></div>`;
  return shell("teacher", 0, pageHeader("Панель группы", { sub: "Результаты сессий, проблемные навыки и расхождения оценок" }) + page(`
${card(`<form class="row wrap" style="align-items: flex-end; gap: 16px;" action="TeacherGroup.dc.html">
${flt("Группа", select(["Группа 1", "Группа 2", "Группа 3"], { style: "min-width: 176px;" }))}
${flt("Направление", select(["Все направления", "Домен 1", "Домен 2"], { style: "min-width: 208px;" }))}
${flt("Дата начала *", dateIn())}
${flt("Дата окончания *", dateIn())}
<div class="row" style="margin-left: auto; gap: 10px;">${btn("Сбросить")}${btn("Применить", { v: "p", type: "submit" })}</div></form>`)}
<div class="kpis">${kpi("Завершённых сессий", "NN", "NN обучающихся")}${kpi("Средний балл", "NN", "медиана NN")}${kpi("Подсказок на сессию", "N,N", "лимит 3")}${kpi("Ждут решения", "NN", "авто-оценка не подтверждена", true)}</div>
<div class="g" style="grid-template-columns: minmax(0,1fr) 360px;">
${card(`<div class="cth">${ct("Сессии за период", btn("CSV", { s: true, icon: "download" }))}</div>${table(["Обучающийся", "Сценарий", "Дата", "Авто", "Эксперт", "Статус оценки", '<span class="sr">Цифровой след</span>'], [
    row(1, 1, "NN", "—", chip("amber", "ожидает")),
    row(2, 1, "NN", "NN", chip("green", "подтверждена")),
    row(3, 2, "NN", "—", chip("amber", "ожидает")),
    row(4, 3, "NN", "NN", chip("blue", "скорректирована")),
    row(5, 1, "NN", "—", chip("amber", "ожидает")),
    row(6, 2, "NN", "NN", chip("green", "подтверждена")),
  ])}`, { np: true })}
${card(`${ct("Проблемные навыки")}<p class="s13 muted">Доля непройденных проверок по навыку</p>${ps(1, 100, "red")}${ps(2, 72, "red")}${ps(3, 56, "red")}${ps(4, 40, "amber")}${ps(5, 30, "amber")}${ps(6, 12, "accent")}${btn("Назначить сценарий группе", { href: L("TeacherAssignments"), style: "margin-top: 8px;" })}`, { style: "display: flex; flex-direction: column; gap: 12px;" })}
</div>`), llmBanner);
}

export function teacherTrace() {
  const T = { command: ["команда", "grey"], status: ["статус", "grey"], incident: ["инцидент", "amber"], hint: ["подсказка", "blue"], warning: ["предупреждение", "amber"], security: ["безопасность", "red"], check: ["проверка", "grey"], answer: ["ответ", "blue"] };
  const sevc = { info: "var(--muted)", warning: "var(--amber-ink)", error: "var(--red-ink)", critical: "var(--red-ink)" };
  const ev = (type, sev, text) => tr([{ h: "ЧЧ:ММ:СС", cls: "mono nw" }, { h: chip(T[type][1], T[type][0]) }, { h: `<span style="color: ${sevc[sev]};">${sev}</span>` }, { h: text }],
    type === "incident" ? 'style="background: color-mix(in srgb, var(--amber-bg) 60%, transparent);"' : type === "security" ? 'style="background: color-mix(in srgb, var(--red-bg) 60%, transparent);"' : "");
  const cmd = (c) => `<code class="code">${c}</code>`;
  const chk = (n, ok, crit) => `<div class="row between sm" style="gap: 12px;"><span>Проверка ${n}${crit ? " *" : ""}</span>${chip(ok === null ? "grey" : ok ? "green" : "red", ok === null ? "не применялась" : ok ? "пройдена" : "не пройдена")}</div>`;
  return shell("teacher", 0, pageHeader("Цифровой след: Сценарий 1", {
    crumbs: '<a href="TeacherGroup.dc.html">Группа</a> · Обучающийся 1 · сессия xxxxxxxx · ДД.ММ.ГГГГ',
    actions: `${chip("grey", "подсказок N")}${chip("grey", "NN мин")}<a href="Report.dc.html">Протокол</a>`,
  }) + page(`<div class="g" style="grid-template-columns: minmax(0,1fr) 400px;">
<div class="col" style="gap: 20px; min-width: 0;">
${card(`<div class="row wrap" style="align-items: flex-end; gap: 16px;">${flt("Время с", input({ value: "ЧЧ:ММ" }), "width: 130px;")}${flt("Время по", input({ value: "ЧЧ:ММ" }), "width: 130px;")}${flt("Тип события", select(["Все типы", "команда", "статус", "инцидент", "подсказка", "предупреждение", "безопасность", "проверка", "ответ"]))}${flt("Severity", select(["info и выше", "warning и выше", "error и выше"]))}${btn("Экспорт JSON", { icon: "download", style: "margin-left: auto;" })}</div>`)}
${card(table(["Время", "Тип", "Severity", "Событие"], [
    ev("status", "info", "Запуск среды"),
    ev("status", "info", "Среда готова"),
    ev("command", "info", cmd("$ команда")),
    ev("command", "info", cmd("$ команда --параметр")),
    ev("incident", "warning", "Текст сообщения об инциденте…"),
    ev("hint", "info", "Подсказка 1 из 3 выдана (−10 %): Текст подсказки…"),
    ev("security", "error", `Команда отклонена политикой среды ${cmd("$ команда")}`),
    ev("check", "info", "Самопроверка студента: выполнено N из N критериев"),
    ev("command", "info", cmd("$ команда файл")),
    ev("check", "info", "Проверка 1 — пройдена"),
    ev("check", "warning", "Проверка 3 — не пройдена"),
    ev("status", "info", "Проверка завершена"),
  ]), { np: true })}
</div>
<div class="col" style="gap: 20px;">
${card(`${ct("Автоматическая оценка", chip("amber", "ожидает"))}<div class="row" style="align-items: baseline; gap: 12px;"><b style="font-size: 48px; font-weight: 600; line-height: 1;">NN</b><span class="sm muted">база NN</span></div><code class="mono xs muted">NN × (1 − 0,1 × N) − 10 × N = NN</code>${chk(1, true, true)}${chk(2, true)}${chk(3, false)}${chk(4, true)}${chk(5, null)}`, { style: "display: flex; flex-direction: column; gap: 12px;" })}
${card(`<form class="col" style="gap: 16px;" action="TeacherTrace.dc.html">${ct("Решение преподавателя")}
${fr("Экспертная оценка", (id) => input({ id, type: "number", value: "NN" }).replace('type="number" ', 'type="text" '))}
${fr("Причина изменения", (id) => textarea("Текст обоснования…", { id, rows: 4, ph: "Обоснование изменения оценки (обязательно)." }), { top: true, req: true })}
<label class="row sm" style="margin-left: 34%; align-items: flex-start; gap: 8px;"><input type="checkbox" class="cb" style="margin-top: 2px;">Отметить как альтернативное решение</label>
<div class="col" style="align-items: flex-end; gap: 10px;">${btn("Подтвердить авто-оценку")}${btn("Сохранить корректировку", { v: "p", type: "submit" })}</div>
<p class="xs muted">Изменение записывается в журнал аудита вместе с причиной.</p></form>`)}
</div></div>`));
}

export function teacherAssignments() {
  const row = (n, d, kind) => tr([{ h: `Сценарий ${n}`, cls: "m" }, { h: chip("blue", `Домен ${d}`) }, kind, { h: "ДД.ММ.ГГГГ", cls: "mono" }, { h: "ДД.ММ.ГГГГ", cls: "mono" }]);
  return shell("teacher", 1, pageHeader("Назначения", { sub: "Сценарии, назначенные группе" }) + page(`<div class="g" style="grid-template-columns: minmax(0,1fr) 440px;">
${card(`<div class="cth">${ct("Назначенные сценарии", select(["Группа 1", "Группа 2"], { aria: "Группа", cls: "sm9", style: "width: auto;" }))}</div>${table(["Сценарий", "Направление", "Тип", "Срок", "Назначен"], [row(1, 1, "учебная среда"), row(2, 2, "документный тренажёр"), row(3, 3, "задача на код"), row(4, 1, "учебная среда"), row(5, 2, "документный тренажёр")])}`, { np: true })}
${card(`<form class="col" style="gap: 16px;" action="TeacherAssignments.dc.html">${ct("Новое назначение")}
${fr("Группа", (id) => input({ id, value: "Группа 1", ro: true }), { req: true })}
${fr("Сценарий", (id) => select(["Сценарий 6 · vN", "— выберите сценарий —", "Сценарий 7 · vN"], { id }), { req: true })}
${fr("Срок выполнения", () => dateIn())}
${banner("green", "check", "Сценарий назначен группе Группа 1.")}
<div class="row" style="justify-content: flex-end;">${btn("Назначить", { v: "p", type: "submit" })}</div>
<p class="xs muted">Каждый обучающийся получит собственный вариант сценария при запуске. Назначение записывается в журнал аудита.</p></form>`)}
</div>`));
}

export function teacherExport() {
  return shell("teacher", 2, pageHeader("Экспорт отчётов", { sub: "Выгрузка результатов группы за период" }) + page(card(`<form class="col" style="gap: 16px;" action="TeacherExport.dc.html">${ct("Параметры отчёта")}
${fr("Группа", (id) => select(["Группа 1", "Группа 2", "Группа 3"], { id }), { req: true })}
${fr("Дата начала", () => dateIn(), { req: true })}
${fr("Дата окончания", () => dateIn(), { req: true })}
${fr("Формат", (id) => select(["CSV (Excel, разделитель «;»)", "JSON"], { id }))}
${banner("green", "check", "Отчёт сформирован и загружен.")}
<div class="row" style="justify-content: flex-end;">${btn("Сформировать", { v: "p", icon: "download", type: "submit" })}</div></form>`, { style: "max-width: 768px;" })));
}

// ---------- Methodist ----------
function skillGraphPage({ dialog = false } = {}) {
  const W = 200, H = 56, gx = 230, gy = 140, ox = 48, oy = 44;
  const nodes = [
    { id: 1, l: 0, i: 1, chips: [["red", "N зависимых"]] },
    { id: 2, l: 1, i: 0 },
    { id: 3, l: 1, i: 1, chips: [["red", "N зависимых"]] },
    { id: 4, l: 1, i: 2, sel: true },
    { id: 5, l: 2, i: 0 },
    { id: 6, l: 2, i: 1, chips: [["amber", "черновик"]] },
    { id: 7, l: 2, i: 2 },
    { id: 8, l: 3, i: 1 },
  ];
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const pos = (n) => ({ x: ox + n.i * gx, y: oy + n.l * gy });
  const edges = [[1, 2], [1, 3], [1, 4], [2, 5], [3, 5], [3, 6], [4, 6], [4, 7], [5, 8], [6, 8], [7, 8]];
  const sel = 4;
  const nh = (n) => (n.chips ? 82 : H);
  let labels = "";
  const paths = edges.map(([a, b]) => {
    const A = pos(by[a]), B = pos(by[b]);
    const into = b === sel, touch = a === sel || b === sel;
    const col = into ? "var(--accent)" : "var(--muted)";
    const x1 = A.x + W / 2, y1 = A.y + nh(by[a]), x2 = B.x + W / 2, y2 = B.y - 2;
    if (touch) {
      const lx = Math.round((x1 + x2) / 2), ly = Math.round((y1 + y2) / 2);
      labels += `<div class="mono" style="position: absolute; left: ${lx - 16}px; top: ${ly - 10}px; width: 32px; text-align: center; font-size: 12px; line-height: 20px; color: var(--amber-ink); background: var(--surface);">0,N</div>`;
    }
    return `<path d="${smoothstep(x1, y1, x2, y2)}" fill="none" stroke="${col}" stroke-width="${into ? 2 : 1.25}" marker-end="url(#${into ? "ga" : "gm"})"></path>`;
  }).join("");
  const nodeHtml = nodes.map((n) => {
    const p = pos(n);
    return `<div style="position: absolute; left: ${p.x}px; top: ${p.y}px; width: ${W}px; height: ${nh(n)}px; border-radius: 16px; background: var(--surface); padding: 10px 14px; box-shadow: var(--shadow); ${n.sel ? "border: 2px solid var(--accent); box-shadow: 0 0 0 4px var(--amber-bg);" : "border: 1px solid var(--line);"}">
<div class="mono" style="font-size: 11px; color: var(--muted);">SKILL.${n.id}</div><div class="b" style="font-size: 13px; line-height: 1.25;">Навык ${n.id}</div>${n.chips ? `<div class="row wrap" style="gap: 4px; margin-top: 6px;">${n.chips.map(([t, x]) => chip(t, x, "height: 20px; font-size: 11px;")).join("")}</div>` : ""}</div>`;
  }).join("");
  const marker = (id, col) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${col}"></path></marker>`;
  const canvas = `<div style="position: relative; height: 600px; overflow: hidden; background-image: radial-gradient(var(--field) 1px, transparent 1px); background-size: 16px 16px;"><svg width="100%" height="600" style="position: absolute; inset: 0;" aria-hidden="true"><defs>${marker("ga", "var(--accent)")}${marker("gm", "var(--muted)")}</defs>${paths}</svg>${nodeHtml}${labels}</div>`;
  const dom = (n, cnt, on) => `<a href="SkillGraph.dc.html"${on ? ' aria-current="true"' : ""} class="row between sm" style="min-height: 40px; gap: 8px; border-radius: 12px; padding: 0 12px; text-decoration: none; ${on ? "background: var(--blue-bg); color: var(--blue-ink); font-weight: 600;" : "color: var(--text);"}"><span>Домен ${n}</span><span class="mono xs">${cnt}</span></a>`;
  const req = (n) => `<div style="display: grid; grid-template-columns: minmax(0,1fr) 76px 40px; align-items: center; gap: 8px; font-size: 14px;"><span class="trunc">Навык ${n}</span>${input({ value: "0,N", aria: "Вес связи", cls: "mono" })}${btn("×", { s: true, aria: "Удалить связь", style: "padding: 0;" })}</div>`;
  const body = pageHeader("Граф компетенций", {
    sub: "Навыки, prerequisite-связи и веса · граф остаётся ациклическим",
    actions: `${btn("Импорт CSV / JSON", { icon: "upload" })}${btn("Экспорт", { icon: "download" })}${btn("+ Навык", { v: "p" })}`,
  }) + page(`<div class="g" style="grid-template-columns: 230px minmax(0,1fr) 340px;">
${card(`${ct("Домены", btn("Домен", { s: true, icon: "plus", href: L("DomainDialog") }))}<nav aria-label="Домены" class="col" style="gap: 4px; margin-top: 8px;">${dom(1, "NN", true)}${dom(2, "NN")}${dom(3, "NN")}${dom(4, "NN")}${dom(5, "NN")}</nav>
${btn("Изменить домен", { s: true, v: "gh", style: "width: 100%; margin-top: 4px;", href: L("DomainDialog") })}
<div style="margin-top: 16px;">${banner("green", "check", "Циклов нет · NN навыков, NN связей")}</div>`, { style: "display: flex; flex-direction: column; gap: 4px;" })}
${card(`<div class="row between" style="gap: 12px; border-bottom: 1px solid var(--line); padding: 12px 20px;"><h2 style="font-size: 16px; font-weight: 600;">Домен 1</h2><div class="row" style="gap: 8px;">${btn("−", { s: true, aria: "Уменьшить" })}${btn("+", { s: true, aria: "Увеличить" })}${btn("Выровнять", { s: true })}</div></div>${canvas}`, { np: true, style: "overflow: hidden;" })}
${card(`<form class="col" style="gap: 14px;" action="SkillGraph.dc.html">${ct("Свойства навыка")}
${fr("Код", (id) => input({ id, value: "SKILL.4", ro: true }), { req: true })}
${fr("Название", (id) => input({ id, value: "Навык 4" }), { req: true })}
${fr("Домен", (id) => select(["Домен 1", "Домен 2"], { id }))}
${fr("Уровень max", (id) => input({ id, value: "N" }))}
${fr("Статус", (id) => select(["активен", "черновик", "устаревший", "в архиве"], { id }))}
${fr("Описание", (id) => textarea("Текст описания навыка…", { id, rows: 2 }), { top: true })}
<div class="col hr" style="gap: 8px; padding-top: 12px;"><div class="row between" style="gap: 8px;"><label for="skill-theory" class="xs m muted">Теория (Markdown)</label>${btn("Предпросмотр", { s: true, v: "gh" })}</div>${textarea("#### Ключевые понятия\nТекст теории навыка…\n- пункт 1\n- пункт 2", { id: "skill-theory", rows: 6, cls: "mono", style: "font-size: 12px;" })}</div>
<div class="xs b muted hr" style="padding-top: 12px;">Требует (requires)</div>
${req(1)}
${select(["+ Добавить prerequisite", "SKILL.2 · Навык 2", "SKILL.3 · Навык 3"], { aria: "Добавить prerequisite" })}
${btn("Сохранить", { v: "p", type: "submit" })}
${btn("Шаблоны сценариев", { href: L("Templates") })}</form>`)}
</div>`);
  const dlg = dialog ? `<div class="overlay" role="presentation"><form class="dlg" role="dialog" aria-modal="true" aria-labelledby="dom-title" action="SkillGraph.dc.html">
<h2 id="dom-title">Новый домен</h2>
<p class="sm muted">Домен — предметная область (направление обучения): к нему относятся навыки, целевые уровни и шаблоны сценариев.</p>
${fr("Код", (id) => input({ id, value: "domain_n", cls: "mono" }), { req: true })}
${fr("Название", (id) => input({ id, value: "Домен N" }), { req: true })}
${fr("Описание", (id) => textarea("Текст описания домена…", { id, rows: 3 }), { top: true })}
<p class="xs muted">Код задаётся один раз и используется в импорте и шаблонах; название можно поменять позже.</p>
<div class="row" style="justify-content: flex-end; gap: 10px;">${btn("Отмена", { href: L("SkillGraph") })}${btn("Создать домен", { v: "p", href: L("SkillGraph") })}</div>
</form></div>` : "";
  return shell("methodist", 0, body) + dlg;
}
export const skillGraph = () => skillGraphPage();
export const domainDialog = () => skillGraphPage({ dialog: true });

export function templates() {
  const st = { p: ["green", "опубликован"], d: ["amber", "черновик"], a: ["grey", "в архиве"] };
  const row = (n, d, kind, s, val, pub) => tr([{ h: `<a href="TemplateEditor.dc.html" class="m">Шаблон ${n}</a><div class="mono xs muted">template_${n}</div>` }, `Домен ${d}`, kind, "vN", "N из 5", { h: chip(...st[s]) }, { h: chip(val ? "green" : "grey", val ? "пройдена" : "нет") }, { h: pub ? "ДД.ММ.ГГГГ" : "—", cls: "mono" }]);
  return shell("methodist", 1, pageHeader("Шаблоны сценариев", { sub: "Спецификации сценариев, валидация прогоном и публикация", actions: `${flt("Направление", select(["Все направления", "Домен 1", "Домен 2"]))}${btn("+ Шаблон", { v: "p", style: "align-self: flex-end;" })}` }) + page(card(table(["Шаблон", "Направление", "Движок", "Версия", "Сложность", "Статус", "Валидация", "Опубликован"], [
    row(1, 1, "учебная среда", "d", true, false), row(2, 1, "учебная среда", "p", true, true), row(3, 2, "документный тренажёр", "p", true, true),
    row(4, 3, "задача на код", "p", true, true), row(5, 2, "документный тренажёр", "d", false, false), row(6, 1, "учебная среда", "a", true, true),
  ]), { np: true })));
}

export function templateEditor() {
  const tab = (t, on) => `<button type="button" role="tab" aria-selected="${on}" class="sm" style="margin-bottom: -1px; min-height: 48px; border: 0; border-bottom: 2px solid ${on ? "var(--accent)" : "transparent"}; background: transparent; padding: 0 16px; cursor: pointer; ${on ? "font-weight: 600; color: var(--accent);" : "color: var(--muted);"}">${t}</button>`;
  const fault = (n, when) => tr([{ h: `<code class="code" style="font-size: 12px;">fault_${n}</code>` }, when, "Текст описания сбоя…"]);
  const check = (n, crit) => tr([{ h: `check_${n}`, cls: "mono xs" }, { h: input({ value: `Критерий ${n}`, aria: `Критерий check_${n}`, cls: "sm9" }) }, { h: "тип_проверки", cls: "mono xs" }, { h: input({ value: "NN", aria: `Вес check_${n}`, cls: "sm9" }), style: "width: 96px;" }, { h: `<button type="button" aria-pressed="${crit}" style="border: 0; background: none; padding: 0; cursor: pointer;">${chip(crit ? "red" : "grey", crit ? "да" : "нет")}</button>` }]);
  const step = (t, ok = true, det = "Текст результата шага…") => `<li class="row sm" style="align-items: flex-start; gap: 12px; border-bottom: 1px solid var(--line-soft); padding: 10px 0;">${I(ok ? "check" : "x", 18, `margin-top: 2px; color: ${ok ? "var(--green)" : "var(--red-ink)"};`)}<div class="grow"><div>${t}</div><div class="xs muted">${det}</div></div><span class="mono xs muted">N,N с</span></li>`;
  const json = `{
  "engine": "container",
  "profile": "профиль 1",
  "faults": [
    "fault_1",
    "fault_2",
    "fault_3",
    "fault_4"
  ],
  "checks": N,
  "incidents": N,
  "hints_max": 3,
  "threshold": NN
}`;
  return shell("methodist", 1, pageHeader("Шаблон 1", {
    crumbs: '<a href="Templates.dc.html">Шаблоны</a> · <span class="mono">template_1</span> · версия N',
    actions: `${chip("amber", "черновик")}${btn("Валидировать прогоном")}${btn("Опубликовать", { v: "p" })}`,
  }) + page(`<div class="g" style="grid-template-columns: minmax(0,1fr) 420px;">
<div class="col" style="gap: 20px; min-width: 0;">
${card(`${fr("Движок", (i) => input({ id: i, value: "Контейнерный · учебная среда", ro: true }))}${fr("Сложность", (i) => select(["N из 5"], { id: i }))}${fr("Лимит времени, мин", (i) => input({ id: i, value: "NN" }))}${fr("Профиль песочницы", (i) => input({ id: i, value: "профиль 1" }))}${fr("Порог зачёта", (i) => input({ id: i, value: "NN" }))}${fr("Инцидент", (i) => input({ id: i, value: "через N–N мин после старта", ro: true }))}`, { style: "display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px;" })}
${card(`<div role="tablist" class="tabs" style="padding: 0 16px;">${["Легенда", "Навыки", "Сбои и проверки", "Подсказки", "JSON"].map((t) => tab(t, t === "Сбои и проверки")).join("")}</div>
<div role="tabpanel" class="col" style="gap: 16px; padding: 16px 0;">
<div style="padding: 0 20px;">${ct("Каталог сбоев", '<span class="xs muted">скрыто от обучающегося</span>')}</div>
${table(["Сбой", "Когда", "Описание"], [fault(1, "при запуске"), fault(2, "инцидент"), fault(3, "инцидент"), fault(4, "резерв")])}
<div style="padding: 8px 20px 0;">${ct("Проверки")}</div>
${table(["Код", "Критерий", "Тип", "Вес", "Критичная"], [check(1, true), check(2, false), check(3, false), check(4, true), check(5, false)])}
<p class="xs muted" style="padding: 0 20px;">Параметры проверок и скрипты сбоев редактируются на вкладке JSON.</p></div>`, { np: true })}
</div>
${card(`${ct("Отчёт валидации", chip("green", "пройдена · NN с"))}<ol style="list-style: none; padding: 0; display: flex; flex-direction: column;">
${step("Спецификация соответствует JSON-схеме и бизнес-правилам")}${step("Близость легенды к опубликованным ниже порога 0,90")}${step("Подбор параметров варианта")}${step("Генерация легенды")}${step("Учебная среда запущена, все проверки проходят на чистой среде")}${step("Сбой ломает проверки")}${step("Эталонное исправление: все проверки пройдены")}${step("Инцидент incident_1: проверки провалены")}${step("Инцидент incident_1: исправление восстанавливает").replace("border-bottom: 1px solid var(--line-soft);", "")}</ol>
<pre class="mono xs" style="overflow: auto; border-radius: 16px; background: var(--term); padding: 16px; line-height: 1.625; color: var(--term-ink);">${json}</pre>`, { style: "display: flex; flex-direction: column; gap: 12px;" })}
</div>`));
}

export function targets() {
  const row = (n, val) => tr([{ h: `SKILL.${n}`, cls: "mono xs" }, `Навык ${n}`, "N", { h: input({ value: val, ph: "не задан", aria: `Требуемый уровень: Навык ${n}` }), style: "width: 176px;" }]);
  return shell("methodist", 2, pageHeader("Целевые уровни", { sub: "Требуемый уровень навыков по направлению подготовки", actions: flt("Направление", select(["Домен 1", "Домен 2", "Домен 3"])) }) + page(card(`<div class="cth">${ct("Навыки направления", btn("Сохранить", { v: "p" }))}</div><div style="padding: 0 20px;">${banner("green", "check", "Целевые уровни сохранены и записаны в журнал аудита.")}</div>${table(["Код", "Навык", "Уровень max", "Требуемый уровень"], [row(1, "N"), row(2, "N"), row(3, "N"), row(4, "N"), row(5, ""), row(6, "N"), row(7, ""), row(8, "N")])}`, { np: true })));
}

// ---------- Admin ----------
export function adminUsers() {
  const roleChips = (rs) => `<div class="row wrap" style="gap: 4px;">${rs.map((r) => chip("blue", r)).join("")}</div>`;
  const row = (n, g, rs, ok, sel) => tr([{ h: `<button type="button" style="border: 0; background: none; padding: 0; text-align: left; cursor: pointer;"><div class="b">Пользователь ${n}</div><div class="mono xs muted">user${n}@example.org</div></button>` }, { h: g, cls: "nw" }, { h: roleChips(rs) }, { h: chip(ok ? "green" : "red", ok ? "активен" : "заблокирован") }, { h: "ДД.ММ, ЧЧ:ММ", cls: "mono" }], `style="cursor: pointer;${sel ? " background: color-mix(in srgb, var(--blue-bg) 50%, transparent);" : ""}"`);
  const role = (t, on) => `<label class="row sm" style="gap: 8px;"><input type="checkbox" class="cb"${on ? " checked" : ""}>${t}</label>`;
  const au = (t) => `<div style="display: grid; grid-template-columns: 96px minmax(0,1fr); gap: 12px; border-top: 1px solid var(--line-soft); padding: 8px 0; font-size: 14px;"><span class="mono xs muted">ДД.ММ, ЧЧ:ММ</span><span>${t}</span></div>`;
  return shell("admin", 0, pageHeader("Пользователи и роли", { sub: "Учётные записи, группы, роли и блокировки", actions: btn("+ Пользователь", { v: "p" }) }) + page(`<div class="g" style="grid-template-columns: minmax(0,1fr) 380px;">
<div class="col" style="gap: 20px; min-width: 0;">
${card(`<div style="min-width: 240px; flex: 1 1 0;">${flt("Поиск", input({ ph: "ФИО или email" }))}</div>${flt("Роль", select(["Все роли", "обучающийся", "преподаватель", "методист", "администратор", "системный администратор"]))}${flt("Группа", input({ ph: "Все группы", style: "width: 144px;" }))}${flt("Статус", select(["Любой", "активен", "заблокирован"]))}`, { style: "display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px;" })}
${card(`${table(["Пользователь", "Группа", "Роли", "Статус", "Последний вход"], [
    row(1, "Группа 1", ["обучающийся"], true), row(2, "Группа 1", ["обучающийся"], true, true), row(3, "Группа 2", ["обучающийся"], false),
    row(4, "—", ["преподаватель"], true), row(5, "—", ["методист", "администратор"], true), row(6, "—", ["системный администратор"], true),
  ])}<div class="row between" style="gap: 12px; padding: 16px;"><span class="sm muted">Показано 1–N из NN</span><div class="row" style="gap: 8px;">${btn("Назад", { s: true, dis: true })}${btn("Далее", { s: true })}</div></div>`, { np: true })}
</div>
<div class="col" style="gap: 20px;">
${card(`<form class="col" style="gap: 14px;" action="AdminUsers.dc.html">${ct("Пользователь 2")}
${fr("Email", (id) => input({ id, value: "user2@example.org", ro: true }))}
${fr("Группа", (id) => input({ id, value: "Группа 1" }))}
${fr("Статус", (id) => select(["Активен", "Заблокирован"], { id }))}
<fieldset style="display: grid; grid-template-columns: 34% 66%; border: 0; padding: 0;"><legend style="float: left; width: 34%; padding-top: 4px; font-size: 14px; color: var(--label);">Роли</legend><div class="col" style="gap: 8px;">${role("Обучающийся", true)}${role("Преподаватель")}${role("Методист")}${role("Администратор")}${role("Системный администратор")}</div></fieldset>
${fr("Причина", (id) => input({ id, ph: "для журнала аудита" }))}
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">${btn("Сохранить", { v: "p", type: "submit" })}${btn("Сбросить сессии", { v: "d" })}</div></form>`)}
${card(`${ct("Изменения учётной записи")}${au('Изменены роли: обучающийся<span class="muted"> — Текст причины…</span>')}${au('Изменены данные учётной записи: статус «активен»<span class="muted"> — Текст причины…</span>')}${au("Создана учётная запись")}`, { style: "display: flex; flex-direction: column; gap: 8px;" })}
</div></div>`));
}

export function adminLlm() {
  const prov = (title, sub, addr, lat, st, inUse) => tr([{ h: `<div class="b">${title}</div><div class="xs muted">${sub}${inUse ? " · используется сейчас" : ""}</div>` }, { h: addr, cls: "mono xs" }, { h: lat, cls: "mono" }, { h: st }], inUse ? 'style="background: color-mix(in srgb, var(--blue-bg) 40%, transparent);"' : "");
  const prof = (n) => tr([{ h: `профиль ${n}`, cls: "mono" }, "N", "NNN МБ", "NNN", "N ГБ", { h: chip("grey", "отключена") }, "N"]);
  const mode = (t, s, on) => `<button type="button" role="radio" aria-checked="${on}" style="border: 0; border-left: 1px solid var(--field); padding: 10px 12px; text-align: left; cursor: pointer; ${on ? "background: var(--blue-bg); color: var(--blue-ink);" : "background: transparent;"}"><div class="sm b">${t}</div><div class="xs" style="opacity: 0.8;">${s}</div></button>`;
  const kv = (k, v) => `<div class="row between sm" style="gap: 12px;"><span>${k}</span><span class="mono">${v}</span></div>`;
  return shell("admin", 1, pageHeader("LLM и песочницы", { sub: "Режим LLM Gateway, провайдеры, профили учебных сред", actions: chip("green", "режим: внешний с ЧЧ:ММ") }) + page(`<div class="g" style="grid-template-columns: minmax(0,1fr) 400px;">
<div class="col" style="gap: 20px; min-width: 0;">
${card(`<div class="cth">${ct("Провайдеры (OpenAI-совместимый API)", btn("Проверить доступность", { s: true }))}</div>${table(["Провайдер", "Адрес", "Задержка", "Состояние"], [
    prov("Внешний", "модель model-1 · ключ в переменной ИМЯ_ПЕРЕМЕННОЙ", "https://llm.example.org/v1", "N,N с", chip("green", "доступен"), true),
    prov("Локальный (Ollama)", "модель model-2", "http://адрес:порт/v1", "N,N с", chip("green", "доступен")),
    prov("Шаблонный", "утверждённые варианты шаблонов", "—", "—", chip("green", "доступен")),
  ])}`, { np: true })}
${card(`<div class="cth">${ct("Профили песочниц", '<span class="xs muted">no-new-privileges · cap-drop ALL · read-only rootfs</span>')}</div>${table(["Профиль", "CPU", "RAM", "Процессы", "Диск /srv", "Сеть", "Активно"], [prof(1), prof(2), prof(3), tr([{ h: "document", cls: "mono" }, { h: "без контейнера · документный тренажёр", cls: "muted", span: 5 }, "N"])])}`, { np: true })}
</div>
<div class="col" style="gap: 20px;">
${card(`<form class="col" style="gap: 16px;" action="AdminLlm.dc.html">${ct("Режим генерации")}<div role="radiogroup" aria-label="Режим генерации" style="display: grid; grid-template-columns: repeat(3, 1fr); overflow: hidden; border-radius: 12px; border: 1px solid var(--field);">${mode("Внешний", "основной", true).replace("border-left: 1px solid var(--field); ", "")}${mode("Локальный", "резервный")}${mode("Шаблонный", "деградация")}</div>
${fr("Причина", (id) => textarea("", { id, rows: 3, ph: "Причина переключения (обязательно)." }), { top: true, req: true })}
${btn("Переключить режим", { v: "p", type: "submit", dis: true })}
${banner("blue", "info", "Активные сессии не прерываются. Переключение записывается в журнал аудита, преподаватели видят предупреждение.")}
<p class="xs muted">Последняя причина: Текст причины…</p></form>`)}
${card(`${ct("Фоновые задачи")}${kv("Сценариев сгенерировано за час", "N")}${kv("Инциденты по расписанию", "N ожидают")}${kv("Проверки в работе", "N")}${kv("Сессии на паузе (контроль бездействия)", "N")}${kv("Пульс worker", "N с назад")}`, { style: "display: flex; flex-direction: column; gap: 10px;" })}
</div></div>`));
}

function securityLog() {
  const sev = { low: "grey", medium: "amber", high: "red", critical: "red" };
  const code = (t) => `<code class="code" style="font-size: 12px;">${t}</code>`;
  const row = (s, kind, user, sess, text) => tr([{ h: "ДД.ММ, ЧЧ:ММ", cls: "mono nw" }, { h: chip(sev[s], s) }, kind, user, { h: sess, cls: "mono xs" }, { h: text }]);
  return card(`<div class="row wrap between" style="align-items: flex-end; gap: 16px; padding: 20px;">${ct("События безопасности и аудит")}<div class="row wrap" style="align-items: flex-end; gap: 12px;">${flt("Дата начала *", dateIn())}${flt("Дата окончания *", dateIn())}${flt("Журнал", select(["Безопасность", "Аудит действий"]))}${btn("Экспорт CSV", { v: "p", icon: "download" })}</div></div>
${table(["Время", "Severity", "Тип", "Пользователь", "Сессия", "Описание"], [
    row("high", "попытка повышения прав", "Обучающийся 1", "xxxxxxxx", `Команда ${code("$ команда")} отклонена политикой среды`),
    row("medium", "prompt injection", "Обучающийся 2", "xxxxxxxx", 'Запрос к подсказке отфильтрован: <span class="muted">«Текст запроса…»</span>'),
    row("medium", "доступ к запрещённому файлу", "Обучающийся 3", "xxxxxxxx", `Команда ${code("$ команда файл")} отклонена политикой среды`),
    row("low", "неудачный вход", "—", "—", `Учётная запись ${code("user@example.org")}`),
    row("critical", "выход за пределы среды", "Обучающийся 1", "xxxxxxxx", `Команда ${code("$ команда")} отклонена политикой среды`),
    row("high", "сетевое сканирование", "Обучающийся 4", "xxxxxxxx", `Команда ${code("$ команда --параметр")} отклонена политикой среды`),
  ])}`, { np: true });
}

export function adminAudit() {
  return shell("admin", 2, pageHeader("Аудит и безопасность", { sub: "Журнал действий пользователей и события безопасности учебных сред" }) + page(securityLog()));
}

export function sysHealth() {
  const sc = (t, tone, text) => card(`<div class="row between" style="gap: 8px;"><b style="font-size: 15px;">${t}</b><span aria-label="${tone === "green" ? "в норме" : "предупреждение"}" style="width: 10px; height: 10px; border-radius: 999px; background: var(--${tone});"></span></div><span class="s13 muted">${text}</span>`, { style: "display: flex; flex-direction: column; gap: 6px;" });
  const sb = (kind, user, st, orphan) => tr([{ h: "xxxxxxxxxxxx", cls: "mono xs" }, kind, user, { h: "Ч:ММ", cls: "mono" }, { h: st }, { h: orphan ? btn("Очистить", { s: true }) : "", cls: "tr" }]);
  return shell("sysadmin", 0, pageHeader("Состояние системы", { sub: "Обновлено ДД.ММ, ЧЧ:ММ · данные /api/admin/health и /metrics", actions: `${btn("Метрики Prometheus")}${btn("Обновить")}` }) + page(`
<div class="kpis">${sc("Backend/API", "green", "всего сессий NN")}${sc("PostgreSQL", "green", "БД NN МБ")}${sc("Фоновый worker", "green", "пульс N с назад")}${sc("Docker Engine", "green", "N учебных контейнеров · NN.N.N")}${sc("LLM Gateway", "green", "внешний режим")}</div>
<div class="g" style="grid-template-columns: 360px minmax(0,1fr);">
${card(`${ct("Ресурсы стенда")}<div class="row between sm"><span>CPU / RAM хоста</span><span class="mono">N vCPU · NN ГБ</span></div><div class="col" style="gap: 6px;"><div class="row between sm"><span>Диск</span><span class="mono">NN ГБ / NN ГБ</span></div>${bar(46, "accent")}</div><div class="col" style="gap: 6px;"><div class="row between sm"><span>Учебные сессии</span><span class="mono">N / NN</span></div>${bar(30, "green")}</div>`, { style: "display: flex; flex-direction: column; gap: 14px;" })}
${card(`<div class="cth">${ct("Учебные среды", '<span class="xs muted">автоочистка после завершения сессии</span>')}</div>${table(["Контейнер", "Назначение", "Пользователь", "Работает", "Состояние", '<span class="sr">Действие</span>'], [
    sb("сессия", "Обучающийся 1", chip("green", "активна")), sb("сессия", "Обучающийся 2", chip("amber", "пауза")), sb("валидация", "—", chip("green", "активна")), sb("сессия", "Обучающийся 3", chip("red", "без сессии"), true),
  ])}`, { np: true })}
</div>
${securityLog()}`));
}

export function sysAudit() {
  return shell("sysadmin", 1, pageHeader("Аудит и безопасность", { sub: "Журнал действий пользователей и события безопасности учебных сред" }) + page(securityLog()));
}
