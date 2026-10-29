import { I, LOGO, banner, bar, btn, card, chip, ct, flt, fr, input, kpi, page, pageHeader, select, shell, table, textarea, themeToggle, tr } from "./lib.mjs";

const L = (f) => `${f}.dc.html`;

// ---------- Login ----------
export function login() {
  const roles = [["Обучающийся", "StudentHome"], ["Преподаватель", "TeacherGroup"], ["Методист", "SkillGraph"], ["Администратор", "AdminUsers"], ["Сисадмин", "SysHealth"]];
  return `<div style="position: absolute; right: 24px; top: 24px;">${themeToggle()}</div>
<div style="display: flex; flex-wrap: wrap; flex: 1 1 auto; min-height: 900px;">
<section style="flex: 1 1 520px; display: flex; flex-direction: column; justify-content: space-between; gap: 40px; padding: 56px 64px;">
  <div class="row" style="gap: 14px;">${LOGO(44)}<div><div style="font-size: 22px; font-weight: 600; letter-spacing: 0.04em;">МАССО</div><div class="s13 muted">учебная диспетчерская</div></div></div>
  <div class="col" style="max-width: 560px; gap: 20px;">
    <h1 style="font-size: 44px; font-weight: 600; line-height: 1.12; letter-spacing: -0.02em;">Сценарий — как назначение. Среда — как <span style="color: var(--accent);">рабочее место</span>. Отчёт — как протокол.</h1>
    <p style="font-size: 16px; line-height: 1.625; color: var(--muted);">Мультиагентная система ситуативного обучения: индивидуальные кейсы под профиль компетенций, изолированная учебная среда, динамические инциденты и автоматическая проверка результата.</p>
  </div>
  <div></div>
</section>
<section style="flex: 999 1 560px; min-width: 0; display: flex; align-items: center; justify-content: center; padding: 48px 24px;">
  <form aria-labelledby="login-title" action="StudentHome.dc.html" style="width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 20px; border-radius: 28px; border: 1px solid color-mix(in srgb, var(--line) 70%, transparent); background: var(--surface); padding: 40px; box-shadow: var(--shadow);">
    <div class="col" style="gap: 6px;"><h2 id="login-title" style="font-size: 26px; font-weight: 600; letter-spacing: -0.015em;">Вход в систему</h2><p class="sm muted">Используйте учётную запись, выданную образовательной организацией.</p></div>
    ${fr("Email", (id) => input({ id, type: "email", value: "user@example.org" }))}
    ${fr("Пароль", (id) => input({ id, type: "password", value: "password" }))}
    <a class="btn p" href="StudentHome.dc.html" style="min-height: 48px; font-size: 16px;">Войти</a>
    <div class="row s13 muted" style="gap: 10px;">${I("shield", 16)} Пароль проверяется на сервере; сессия хранится в защищённой cookie.</div>
    <div class="col" style="gap: 8px; border-top: 1px solid var(--line); padding-top: 16px;">
      <div class="sm b">Демо-версия: войти как</div>
      <div class="row wrap" style="gap: 8px;">${roles.map(([t, f]) => btn(t, { s: true, href: L(f) })).join("")}</div>
      <p class="s13 muted">В макете кнопка сразу открывает рабочее место выбранной роли.</p>
    </div>
  </form>
</section>
</div>`;
}

// ---------- Student home ----------
export function studentHome() {
  const row = (n, kind, st, action) => tr([
    { h: `<div class="b">Сценарий ${n}</div><div class="xs muted">лимит NN мин · подсказок до 3 · ${kind}</div>` },
    { h: chip("blue", "Домен 1") },
    { h: "ДД.ММ", cls: "mono" },
    { h: st },
    { h: action, cls: "tr" },
  ]);
  const rows = [
    row(1, "учебная среда", chip("blue", "выполняется"), btn("Продолжить", { href: L("WorkspaceContainer") })),
    row(2, "документный тренажёр", chip("grey", "назначен"), btn("Начать", { v: "p", href: L("WorkspaceDocument") })),
    row(3, "задача на код", chip("grey", "назначен"), btn("Начать", { v: "p", href: L("WorkspaceCode") })),
    row(4, "учебная среда", chip("amber", "на паузе"), btn("Продолжить", { href: L("HintDialog") })),
    row(5, "документный тренажёр", chip("green", "завершён · NN"), btn("Пройти снова", { href: L("WorkspaceDocument") })),
  ];
  const deficit = (n, tone, pr, text) => `<div style="border-bottom: 1px solid var(--line-soft); padding-bottom: 12px;"><div class="row between" style="align-items: flex-start; gap: 8px;"><b>Навык ${n}</b>${chip(tone, pr)}</div><p class="s13 muted" style="margin-top: 4px;">${text}</p></div>`;
  const prof = (n, pct, tone) => `<div style="display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr) 48px; align-items: center; gap: 16px; font-size: 14px;"><span class="trunc">Навык ${n}</span>${bar(pct, tone)}<span class="tr mono muted">N/N</span></div>`;
  const rep = (n, tone) => `<a href="Report.dc.html" class="row between" style="gap: 12px; border-bottom: 1px solid var(--line-soft); padding: 12px 0; color: var(--text); text-decoration: none;"><span class="trunc">Сценарий ${n}</span><span class="row" style="gap: 12px;"><span class="mono muted">ДД.ММ</span>${chip(tone, "NN")}${I("fwd", 16, "color: var(--muted);")}</span></a>`;
  return shell("student", 0, pageHeader("Мои назначения", { sub: "Группа 1 · Домен 1" }) + page(`
<div class="kpis">${kpi("Назначено", "NN", "ближайший срок ДД.ММ")}${kpi("Завершено", "NN", "протоколов прохождения")}${kpi("Средний балл", "NN", "по NN протоколам")}${kpi("Активные сессии", "N", "в работе или на паузе")}</div>
<div class="g" style="grid-template-columns: minmax(0,1fr) 380px;">
  ${card(`<div class="cth">${ct("Назначенные сценарии", chip("grey", "N активных"))}</div>${table(["Сценарий", "Тип", "Срок", "Статус", '<span class="sr">Действие</span>'], rows)}`, { np: true })}
  ${card(`${ct("Рекомендации")}
    ${deficit(4, "red", "критический", "Уровень N из N требуемого. Предшествует N навыкам направления.")}
    ${deficit(2, "amber", "высокий", "Уровень N из N требуемого.")}
    ${deficit(5, "blue", "средний", "Не подтверждался NN дн.")}
    ${btn("Сгенерировать сценарий по дефициту", { v: "p", icon: "target", href: L("WorkspaceContainer") })}
    <p class="xs muted" style="margin-top: -8px;">Будет подготовлен вариант сценария «Сценарий N».</p>`, { style: "display: flex; flex-direction: column; gap: 16px;" })}
</div>
<div class="g" style="grid-template-columns: 1fr 1fr;">
  ${card(`${ct("Профиль компетенций", '<a href="StudentSkills.dc.html">Все навыки</a>')}${prof(1, 100, "green")}${prof(2, 33, "red")}${prof(3, 67, "accent")}${prof(4, 0, "red")}${prof(5, 75, "amber")}${prof(6, 100, "green")}`, { style: "display: flex; flex-direction: column; gap: 12px;" })}
  ${card(`${ct("Последние протоколы", '<a href="StudentReports.dc.html">Все протоколы</a>')}${rep(5, "green")}${rep(6, "amber")}${rep(7, "red").replace('padding: 12px 0;', 'padding: 12px 0; border-bottom: 0;')}`, { style: "display: flex; flex-direction: column;" })}
</div>`));
}

// ---------- Workspace ----------
const criteria = (states) => `<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px;">${states.map((s, i) => {
  const box = { none: "border: 1px solid var(--label);", ok: "border: 1px solid var(--green); background: var(--green); color: #fff;", fail: "border: 1px solid var(--red); background: var(--red); color: #fff;", skip: "border: 1px solid var(--field); background: var(--sunken); color: var(--muted);" }[s];
  const ic = { none: "", ok: I("check", 12), fail: I("x", 12), skip: I("clock", 12) }[s];
  return `<li class="row sm" style="align-items: flex-start; gap: 8px;"${s === "skip" ? ' title="Проверка включится после инцидента"' : ""}><span aria-hidden="true" style="margin-top: 2px; display: grid; place-items: center; width: 16px; height: 16px; flex-shrink: 0; border-radius: 4px; ${box}">${ic}</span>Критерий ${i + 1}</li>`;
}).join("")}</ul>`;

const theory = (names) => `<div class="col" style="gap: 8px;">${names.map((n, i) => `<details${i === 0 ? " open" : ""} style="border-radius: 16px; background: color-mix(in srgb, var(--sunken) 70%, transparent); padding: 10px 16px${i === 0 ? " 12px" : ""};"><summary class="row between sm m" style="cursor: pointer; list-style: none; gap: 8px;"><span class="row" style="gap: 8px;">${I("bulb", 16, "color: var(--accent);")}${n}</span>${I(i === 0 ? "up" : "down", 16, "color: var(--muted);")}</summary>${i === 0 ? '<div class="sm" style="margin-top: 8px; line-height: 1.625;"><h4 style="font-size: 14px; font-weight: 600; margin: 4px 0;">Ключевые понятия</h4><p>Текст теории навыка…</p><ul style="margin: 8px 0 0; padding-left: 24px;"><li>Пункт теории 1</li><li>Пункт теории 2</li></ul></div>' : ""}</details>`).join("")}</div>`;

function leftColumn({ states = ["ok", "ok", "fail", "skip", "none"], checked = true, constraints }) {
  return `<div class="col" style="gap: 16px; min-width: 0; align-self: start;">
${card(`${ct("Легенда")}
<p style="font-size: 15px; line-height: 1.625;">Текст легенды сценария… Описание ситуации, исходного состояния и ожидаемого результата.</p>
<p style="font-size: 15px; line-height: 1.625; margin-top: -8px;">Текст легенды сценария…</p>
<div><div class="xs m muted" style="margin-bottom: 8px;">Критерии оценивания</div>${criteria(states)}
<div class="col" style="gap: 6px; margin-top: 12px;">${btn("Проверить выполнение", { s: true, icon: "check" })}<span class="xs muted" role="status">${checked ? "Проверено в ЧЧ:ММ:СС: выполнено N из N. Баллы не снимаются." : "Промежуточная проверка критериев, баллы не снимаются. Итог считается при отправке."}</span></div></div>
<div class="hr" style="padding-top: 12px;"><div class="xs m muted" style="margin-bottom: 6px;">Ограничения среды</div><p class="s13 muted">${constraints || "Пользователь без прав администратора · сеть отключена · запись только в рабочий каталог · лимиты профиля среды"}</p></div>`, { style: "display: flex; flex-direction: column; gap: 16px;" })}
${card(`${ct("Теория")}<p class="s13 muted">Справка по навыкам этого сценария. Читать можно в любой момент — баллы за неё не снимаются.</p>${theory(["Навык 1", "Навык 2", "Навык 3"])}`, { style: "display: flex; flex-direction: column; gap: 12px;" })}
</div>`;
}

const ev = (icon, color, title, text) => `<li class="row" style="align-items: flex-start; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line-soft);">${I(icon, 18, `margin-top: 2px; color: ${color};`)}<div class="grow"><div class="row between" style="align-items: baseline; gap: 8px;"><b class="sm">${title}</b><span class="mono xs muted">ЧЧ:ММ</span></div><div class="sm" style="line-height: 1.375;">${text}</div></div></li>`;

function rightColumn({ events, ask = false, left = "3" }) {
  const list = events.map((e) => ev(...e)).join("").replace("border-top: 1px solid var(--line-soft);", "");
  return `<div class="col" style="gap: 16px; min-width: 0;">
${card(`${ct("Журнал событий", '<span class="xs muted">обновляется в реальном времени</span>')}<ol aria-live="polite" style="list-style: none; padding: 0; display: flex; flex-direction: column;">${list}</ol>`, { style: "display: flex; flex-direction: column; gap: 12px; min-height: 280px;" })}
${card(`${ct("Подсказки", chip(left === "0" ? "grey" : "amber", `осталось ${left} из 3`))}
<p class="s13 muted">Каждая подсказка снижает итоговый балл на 10 %. Подсказка указывает область проблемы, но не содержит готовой команды.</p>
${ask ? textarea("Текст вопроса…", { rows: 3, aria: "Вопрос к подсказке (необязательно)", ph: "Что именно непонятно? (необязательно)" }) : ""}
<div class="row" style="gap: 8px;">${btn(ask ? "Получить подсказку" : "Запросить подсказку", { icon: "bulb", style: ask ? "flex: 1 1 0; padding: 0 14px;" : "flex: 1 1 0;", href: ask ? L("WorkspaceContainer") : L("HintDialog") })}${ask ? btn("Отмена", { v: "gh", href: L("WorkspaceContainer"), style: "padding: 0 12px;" }) : ""}</div>`, { style: "display: flex; flex-direction: column; gap: 12px;" })}
</div>`;
}

function wsHeader({ title = "Сценарий 1", themeHref }) {
  return `<header class="hdr row wrap" style="gap: 12px 20px; padding: 12px 24px;">
<a href="StudentHome.dc.html" class="row" style="min-height: 40px; gap: 6px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); padding: 0 16px; font-size: 14px; color: var(--nav-ink); text-decoration: none; box-shadow: var(--shadow);">${I("back", 16)}К назначениям</a>
<div class="grow"><div class="trunc mono xs muted">сессия xxxxxxxx · Домен 1 · сложность N из 5</div><h1 class="trunc" style="font-size: 20px; font-weight: 600; letter-spacing: -0.015em;">${title}</h1></div>
${chip("green", '<span class="dot"></span>среда готова')}
<div class="row" style="align-items: baseline; gap: 8px;" aria-label="Оставшееся время">${I("clock", 18, "align-self: center;")}<span role="timer" class="mono" style="font-size: 24px;">ММ:СС</span><span class="xs muted">из ММ:СС</span></div>
${btn("Пауза", { icon: "clock" })}
${btn("Завершить и отправить на проверку", { v: "p", href: L("Report") })}
${themeToggle(themeHref)}
</header>`;
}

const terminal = () => {
  const P = '<span style="color: #86efac;">student@masso-srv</span>:<span style="color: #93c5fd;">/srv</span>$ ';
  const lines = [
    `${P}команда`, "вывод команды…", "вывод команды…", "", `${P}команда --параметр`, "строка вывода 1", "строка вывода 2", '<span style="color: #fdba74;">предупреждение: текст сообщения…</span>', "", `${P}команда файл`, "содержимое файла…", "", `${P}<span style="background: #fb923c; color: #1c1917;">&nbsp;</span>`,
  ];
  return `<section aria-label="Терминал учебной среды" style="display: flex; flex-direction: column; height: 750px; min-width: 0; overflow: hidden; border-radius: 20px; background: var(--term); box-shadow: var(--shadow);">
<div class="row between mono s13" style="gap: 12px; background: var(--term-bar); padding: 12px 20px; color: var(--term-ink);"><span class="row" style="gap: 12px;"><span aria-hidden="true" class="row" style="gap: 6px;"><span style="width: 10px; height: 10px; border-radius: 999px; background: #fca5a5;"></span><span style="width: 10px; height: 10px; border-radius: 999px; background: #fdba74;"></span><span style="width: 10px; height: 10px; border-radius: 999px; background: #86efac;"></span></span>student@masso-srv: /srv</span><span class="row" style="gap: 8px; font-family: 'IBM Plex Sans', sans-serif;"><span style="width: 8px; height: 8px; border-radius: 999px; background: #86efac;"></span>WebSocket подключён</span></div>
<pre class="mono" style="flex: 1 1 auto; padding: 16px; color: #e7e5e4; font-size: 14px; line-height: 1.3; white-space: pre-wrap;">${lines.join("\n")}</pre>
</section>`;
};

const WS_GRID = "display: grid; grid-template-columns: 300px minmax(0,1fr) 320px; gap: 16px; padding: 8px 24px 24px; flex: 1 1 auto; align-items: start;";

const BASE_EVENTS = [
  ["alert", "var(--amber-ink)", "Инцидент", "Текст сообщения об инциденте…"],
  ["check", "var(--green)", "Самопроверка: N из N", "Баллы не снимаются."],
  ["check", "var(--green)", "Среда готова", "Учебная среда готова."],
  ["check", "var(--green)", "Запуск среды", "Подготовка учебной среды…"],
];

export function workspaceContainer({ themeHref = L("WorkspaceDark"), hint = false } = {}) {
  const events = hint ? [["bulb", "var(--accent)", "Подсказка 1 из 3", "Текст подсказки… Обратите внимание на область проблемы, указанную в легенде."], ...BASE_EVENTS] : BASE_EVENTS;
  return `${wsHeader({ themeHref })}
<div style="${WS_GRID}">
${leftColumn({})}
<div class="col" style="gap: 16px; min-width: 0;">${terminal()}</div>
${rightColumn({ events, ask: hint, left: hint ? "2" : "3" })}
</div>`;
}

export function workspaceDocument() {
  const docTabs = `<div role="tablist" aria-label="Документы" class="tabs" style="padding: 12px 12px 0;">
<button type="button" role="tab" aria-selected="true" class="row sm b" style="margin-bottom: -1px; min-height: 40px; gap: 8px; border-radius: 8px 8px 0 0; border: 1px solid var(--line); border-bottom: 0; background: var(--surface); padding: 0 12px;">Документ 1</button>
<button type="button" role="tab" aria-selected="false" class="row sm muted" style="margin-bottom: -1px; min-height: 40px; gap: 8px; border: 1px solid transparent; background: transparent; padding: 0 12px;">Документ 2 ${chip("amber", "изменён")}</button>
<button type="button" role="tab" aria-selected="false" class="row sm muted" style="margin-bottom: -1px; min-height: 40px; gap: 8px; border: 1px solid transparent; background: transparent; padding: 0 12px;">Документ 3</button>
</div>`;
  const tcell = "border: 1px solid var(--line); padding: 6px 8px;";
  const th = `${tcell} background: var(--bg); text-align: left;`;
  const md = `<div role="tabpanel" class="sm" style="padding: 20px;">
<h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Документ 1</h3>
<p style="margin: 8px 0; line-height: 1.625;">Текст документа… Реквизиты, стороны и предмет документа.</p>
<h4 style="font-size: 14px; font-weight: 600; margin: 16px 0 8px;">Раздел 1</h4>
<p style="margin: 8px 0; line-height: 1.625;">Текст раздела… <code class="code">ссылка N</code> Текст раздела…</p>
<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 12px 0;"><thead><tr><th style="${th}">Позиция</th><th style="${th}">Количество</th><th style="${th}">Цена</th><th style="${th}">Сумма</th></tr></thead><tbody>
<tr><td style="${tcell}">Позиция 1</td><td style="${tcell}">NN</td><td style="${tcell}">NN,NN</td><td style="${tcell}">NNN,NN</td></tr>
<tr><td style="${tcell}">Позиция 2</td><td style="${tcell}">NN</td><td style="${tcell}">NN,NN</td><td style="${tcell}">NNN,NN</td></tr>
<tr><td style="${tcell}">Позиция 3</td><td style="${tcell}">NN</td><td style="${tcell}">NN,NN</td><td style="${tcell}">NNN,NN</td></tr>
</tbody></table>
<h4 style="font-size: 14px; font-weight: 600; margin: 16px 0 8px;">Раздел 2</h4>
<p style="margin: 8px 0; line-height: 1.625;">Текст раздела… Условия, сроки и порядок расчётов.</p>
</div>`;
  const finding = (n, filled) => `<fieldset class="col" style="gap: 12px; border-radius: 12px; border: 1px solid var(--line); padding: 16px;"><legend class="sm b" style="padding: 0 4px;">Несоответствие ${n}</legend>
${fr("Раздел документа", (id) => select(filled ? ["Раздел 1", "Раздел 2"] : ["— раздел —", "Раздел 1"], { id }), { req: true })}
${fr("Тип несоответствия", (id) => select(filled ? ["Тип несоответствия 1", "Тип несоответствия 2"] : ["— тип —"], { id }), { req: true })}
${fr("Комментарий", (id) => textarea(filled ? "Текст комментария…" : "", { id, rows: 2 }), { top: true })}
${fr("Предлагаемая редакция", (id) => textarea(filled ? "Текст предлагаемой редакции…" : "", { id, rows: 2 }), { top: true })}
<div class="row" style="justify-content: flex-end;">${btn("Удалить", { s: true, v: "d", icon: "x" })}</div></fieldset>`;
  return `${wsHeader({ title: "Сценарий 2", themeHref: undefined })}
<div style="${WS_GRID}">
${leftColumn({ states: ["ok", "none", "none", "skip", "none"], constraints: "Документы только для чтения · ответ сохраняется автоматически · лимит времени сценария" })}
<div class="col" style="gap: 16px; min-width: 0;">
${card(docTabs + md, { np: true, style: "display: flex; flex-direction: column;" })}
${card(`${ct("Ответ", '<span class="xs muted" aria-live="polite">Сохранено в ЧЧ:ММ:СС</span>')}<div class="col" style="gap: 16px;">${finding(1, true)}${finding(2, false)}<div>${btn("Добавить несоответствие", { icon: "target" })}</div></div>`, { style: "display: flex; flex-direction: column; gap: 16px;" })}
</div>
${rightColumn({ events: [["alert", "var(--amber-ink)", "Предупреждение", "Текст предупреждения…"], ...BASE_EVENTS.slice(1)] })}
</div>`;
}

export function workspaceCode() {
  const tab = (name, title, on) => `<button type="button" role="tab" aria-selected="${on}" class="mono s13" style="border-radius: 999px; border: 0; padding: 6px 14px; cursor: pointer; ${on ? "background: var(--nav); color: var(--on-nav);" : "background: transparent; color: var(--nav-ink);"}">${name} <span style="font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; opacity: 0.7;">· ${title}</span></button>`;
  const K = (t) => `<span style="color: var(--cm-kw);">${t}</span>`;
  const D = (t) => `<span style="color: var(--cm-def);">${t}</span>`;
  const C = (t) => `<span style="color: var(--cm-com); font-style: italic;">${t}</span>`;
  const N = (t) => `<span style="color: var(--cm-num);">${t}</span>`;
  const code = [
    `${K("def")} ${D("solve")}(data):`,
    `    ${C('"""Текст описания функции…"""')}`,
    `    ${C("# решение")}`,
    `    result = []`,
    `    ${K("for")} item ${K("in")} data:`,
    `        ${C("# шаг алгоритма")}`,
    `        ...`,
    `    ${K("return")} result`,
    ``,
    ``,
    `${K("def")} ${D("helper")}(value):`,
    `    ${C("# вспомогательная функция")}`,
    `    ${K("return")} value`,
    ``,
  ];
  const active = 6;
  const gutter = code.map((_, i) => `<div style="padding: 0 12px 0 16px; text-align: right;${i === active ? " background: var(--cm-active-gutter);" : ""}">${i + 1}</div>`).join("");
  const lines = code.map((l, i) => `<div style="padding: 0 8px;${i === active ? " background: var(--cm-active);" : ""}">${l || "&nbsp;"}</div>`).join("");
  const exOk = (call) => `<div class="row wrap mono s13" style="align-items: baseline; gap: 4px 12px; border-radius: 12px; padding: 8px 12px; background: color-mix(in srgb, var(--green-bg) 60%, transparent);">${I("check", 14, "align-self: center; color: var(--green);")}<span>${call}</span><span class="muted">ожидается NN</span></div>`;
  const exBad = (call) => `<div class="row wrap mono s13" style="align-items: baseline; gap: 4px 12px; border-radius: 12px; padding: 8px 12px; background: color-mix(in srgb, var(--red-bg) 60%, transparent);">${I("x", 14, "align-self: center; color: var(--red);")}<span>${call}</span><span class="muted">ожидается NN</span><span style="color: var(--red-ink);">получено NN</span></div>`;
  const tcell = "border: 1px solid var(--line); padding: 6px 8px;";
  const th = `${tcell} background: var(--bg); text-align: left;`;
  return `${wsHeader({ title: "Сценарий 3", themeHref: undefined })}
<div style="${WS_GRID}">
${leftColumn({ states: ["ok", "fail", "none", "none", "none"], constraints: "Код выполняется в одноразовом контейнере без сети · лимиты времени и памяти на запуск" })}
<div class="col" style="gap: 16px; min-width: 0;">
${card(`${ct("Условие")}<div style="font-size: 15px; line-height: 1.625;"><p style="margin: 8px 0;">Текст условия задачи… Реализуйте функцию <code class="code">solve(data)</code>, которая возвращает результат по правилам из условия.</p>
<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0;"><thead><tr><th style="${th}">Вызов</th><th style="${th}">Результат</th></tr></thead><tbody><tr><td style="${tcell}" class="mono">solve(пример 1)</td><td style="${tcell}" class="mono">NN</td></tr><tr><td style="${tcell}" class="mono">solve(пример 2)</td><td style="${tcell}" class="mono">NN</td></tr></tbody></table>
<p style="margin: 8px 0;">Ограничения: N ≤ NN. Текст ограничений…</p></div>`, { style: "display: flex; flex-direction: column; gap: 8px;" })}
${card(`<div class="row wrap between" style="gap: 12px; border-bottom: 1px solid var(--line-soft); padding: 10px 16px;"><div role="tablist" aria-label="Файлы" class="row" style="gap: 4px;">${tab("solution.py", "Решение", true)}${tab("test_solution.py", "Мои тесты", false)}</div><div class="row" style="gap: 12px;"><span class="xs muted" role="status">Сохранено в ЧЧ:ММ:СС</span>${btn("Запустить тесты", { s: true, v: "p", icon: "activity" })}</div></div>
<div class="mono" role="textbox" aria-label="Файл solution.py" style="display: flex; background: var(--cm-bg); color: var(--cm-text); font-size: 14px; line-height: 1.6; padding: 12px 0; min-height: 400px;"><div aria-hidden="true" style="background: var(--cm-gutter); color: var(--cm-gutter-ink); margin: -12px 0; padding: 12px 0;">${gutter}</div><div style="flex: 1 1 auto; white-space: pre;">${lines}</div></div>`, { np: true, style: "display: flex; flex-direction: column; overflow: hidden;" })}
${card(`${ct("Результат запуска", '<span class="xs muted">баллы не начисляются · итог — при отправке</span>')}
<div class="col" style="gap: 6px;"><div class="xs m muted">Примеры из условия</div>${exOk("solve(пример 1)")}${exBad("solve(пример 2)")}</div>
<div class="col" style="gap: 6px;"><div class="row xs m muted" style="gap: 8px;">Мои тесты ${chip("red", "N из N")}</div><div class="mono s13" style="border-radius: 12px; padding: 8px 12px; background: color-mix(in srgb, var(--red-bg) 60%, transparent); color: var(--red-ink);">test_case_n: AssertionError: текст ошибки…</div></div>
<details style="border-radius: 12px; background: var(--term); color: var(--term-ink); padding: 8px 12px;"><summary class="xs" style="cursor: pointer;">Вывод программы</summary><pre class="mono xs" style="margin-top: 8px; white-space: pre-wrap;">вывод программы…</pre></details>`, { style: "display: flex; flex-direction: column; gap: 12px;" })}
</div>
${rightColumn({ events: [["check", "var(--green)", "Самопроверка: N из N", "Баллы не снимаются."], ["check", "var(--green)", "Среда готова", "Учебная среда готова."], ["check", "var(--green)", "Запуск среды", "Подготовка учебной среды…"]] })}
</div>`;
}

// ---------- Report ----------
export function report() {
  const r = 52, c = 2 * Math.PI * r, v = 82;
  const ring = `<svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="Итоговый балл NN из 100"><circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--sunken)" stroke-width="12"></circle><circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--green)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${((c * v) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 66 66)"></circle><text x="66" y="68" text-anchor="middle" font-size="34" font-weight="600" fill="var(--text)" font-family="IBM Plex Sans">NN</text><text x="66" y="90" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="IBM Plex Sans">из 100</text></svg>`;
  const metric = (l, val) => `<div class="col" style="gap: 6px; border-left: 1px solid var(--line); padding: 0 20px;"><span class="sm muted">${l}</span><b style="font-size: 20px; font-weight: 600;">${val}</b></div>`;
  const chk = (n, w, res, crit) => tr([`Проверка ${n}${crit ? ` ${chip("grey", "критическая", "margin-left: 4px;")}` : ""}`, w, { h: res }]);
  const pc = (n, tone, t) => `<div class="row between sm" style="gap: 12px;"><span>Навык ${n}</span>${chip(tone, t)}</div>`;
  return shell("student", 1, pageHeader("Сценарий 1", { crumbs: "Протокол прохождения · сессия xxxxxxxx · ДД.ММ.ГГГГ", actions: `${btn("JSON", { icon: "download" })}${btn("Печать PDF", { icon: "print" })}` }) + page(`
${card(`<div class="row" style="gap: 20px;">${ring}<div class="col" style="gap: 8px;">${chip("green", "сценарий пройден", "align-self: flex-start;")}<code class="mono s13 muted">база × (1 − 0,1 × подсказки) − 10 × нарушения</code><code class="mono s13 muted">NN × (1 − 0,1 × N) − 10 × N = NN</code></div></div>
<div class="row wrap" style="row-gap: 16px;">${metric("Проверки", "N из N")}${metric("Время", "NN мин")}${metric("Подсказки", "N (−NN %)")}${metric("Инциденты", "N")}${metric("Нарушения", "N")}</div>`, { style: "display: flex; flex-wrap: wrap; align-items: center; gap: 20px 32px;" })}
<div class="g" style="grid-template-columns: minmax(0,1fr) 400px;">
${card(`<div class="cth">${ct("Результаты проверок")}</div>${table(["Проверка", "Вес", "Результат"], [chk(1, "NN", chip("green", "пройдена"), true), chk(2, "NN", chip("green", "пройдена")), chk(3, "NN", chip("red", "не пройдена")), chk(4, "NN", chip("green", "пройдена")), chk(5, "NN", chip("grey", "не применялась"))])}
<div class="col" style="gap: 8px; padding: 20px;">${banner("red", "alert", "<b>Ошибка.</b> Не выполнен критерий «Проверка 3». Вернитесь к легенде и сверьте результат с этим критерием.")}</div>
<div class="hr" style="padding: 20px;"><div class="sm b" style="margin-bottom: 8px;">Полученные подсказки</div><ol class="sm" style="padding-left: 20px; display: flex; flex-direction: column; gap: 6px;"><li>Текст подсказки…</li></ol></div>`, { np: true })}
<div class="col" style="gap: 20px;">
${card(`${ct("Изменения профиля")}${pc(1, "green", "уровень N → N")}${pc(2, "blue", "подтверждение N из 3")}${pc(3, "amber", "серия сброшена")}`, { style: "display: flex; flex-direction: column; gap: 12px;" })}
${card(`${ct("Повторить теорию")}<p class="s13 muted">Навыки, по которым проверки не пройдены. Разберите теорию перед следующей попыткой.</p>${theory(["Навык 3"]).replace(" open", "")}`, { style: "display: flex; flex-direction: column; gap: 12px;" })}
${card(`${ct("Рекомендация")}<p class="sm" style="line-height: 1.625;">Дефицит навыка «Навык 3». Рекомендуемый сценарий: «Сценарий N».</p>${btn("Перейти к назначениям", { v: "p", href: L("StudentHome"), style: "width: 100%;" })}`, { style: "display: flex; flex-direction: column; gap: 12px;" })}
${card(`${ct("Оценка преподавателя")}<p class="s13 muted">Автоматическая оценка ожидает подтверждения. При корректировке здесь появится причина изменения.</p>`, { style: "display: flex; flex-direction: column; gap: 8px;" })}
</div></div>`));
}

export function studentReports() {
  const row = (n, ok, tone) => tr([{ h: `<a href="Report.dc.html">Сценарий ${n}</a>` }, `Домен ${n % 2 ? 1 : 2}`, { h: "ДД.ММ, ЧЧ:ММ", cls: "mono" }, { h: chip(ok ? "green" : "red", ok ? "пройден" : "не пройден") }, { h: chip(tone, "NN") }]);
  return shell("student", 1, pageHeader("Протоколы", { sub: "Результаты завершённых сценариев" }) + page(card(table(["Сценарий", "Направление", "Дата", "Результат", "Балл"], [row(1, true, "green"), row(2, true, "green"), row(3, false, "amber"), row(4, false, "red"), row(5, true, "green"), row(6, true, "green")]), { np: true })));
}

// ---------- Skills (competency map) ----------
const STATE = {
  mastered: { card: "border: 1px solid color-mix(in srgb, var(--green) 60%, transparent); background: color-mix(in srgb, var(--green-bg) 50%, var(--surface));", fill: "var(--green)", icon: "check", ic: "var(--green)" },
  progress: { card: "border: 1px solid color-mix(in srgb, var(--amber) 60%, transparent); background: color-mix(in srgb, var(--amber-bg) 50%, var(--surface));", fill: "var(--amber)", icon: "activity", ic: "var(--amber)" },
  available: { card: "border: 1px dashed color-mix(in srgb, var(--blue-ink) 40%, transparent); background: var(--surface);", fill: "var(--blue-ink)", icon: "target", ic: "var(--muted)" },
  locked: { card: "border: 1px solid var(--line); background: color-mix(in srgb, var(--sunken) 60%, var(--surface)); opacity: 0.7;", fill: "var(--field)", icon: "lock", ic: "var(--muted)" },
};
export const smoothstep = (x1, y1, x2, y2, r = 6) => {
  const my = Math.round((y1 + y2) / 2);
  if (x1 === x2) return `M${x1} ${y1} L${x2} ${y2}`;
  const d = x2 > x1 ? 1 : -1;
  const rr = Math.min(r, Math.abs(x2 - x1) / 2);
  return `M${x1} ${y1} L${x1} ${my - rr} Q${x1} ${my} ${x1 + d * rr} ${my} L${x2 - d * rr} ${my} Q${x2} ${my} ${x2} ${my + rr} L${x2} ${y2}`;
};

export function studentSkills() {
  const W = 210, H = 86, gx = 230, gy = 128, ox = 57, oy = 40;
  const nodes = [
    { id: 1, l: 0, i: 1.5, st: "mastered", lv: 3, req: 3 },
    { id: 2, l: 1, i: 0, st: "mastered", lv: 3, req: 3 },
    { id: 3, l: 1, i: 1, st: "progress", lv: 1, req: 3, def: true },
    { id: 4, l: 1, i: 2, st: "available", lv: 0, req: 3, def: true, sel: true },
    { id: 5, l: 1, i: 3, st: "progress", lv: 2, req: 4 },
    { id: 6, l: 2, i: 0.5, st: "available", lv: 0, req: 3 },
    { id: 7, l: 2, i: 1.5, st: "locked", lv: 0, req: 3 },
    { id: 8, l: 2, i: 2.5, st: "locked", lv: 0, req: 2 },
    { id: 9, l: 3, i: 1, st: "locked", lv: 0, req: null },
    { id: 10, l: 3, i: 2, st: "locked", lv: 0, req: 3 },
  ];
  const pos = (n) => ({ x: ox + n.i * gx, y: oy + n.l * gy });
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = [[1, 2], [1, 3], [1, 4], [1, 5], [2, 6], [3, 6], [4, 7], [5, 7], [4, 8], [6, 9], [7, 10], [8, 10]];
  const sel = 4;
  const paths = edges.map(([a, b]) => {
    const A = pos(by[a]), B = pos(by[b]);
    const hot = a === sel || b === sel;
    const done = by[a].st === "mastered";
    const anim = by[b].st === "available" || by[b].st === "progress";
    const col = hot ? "var(--accent)" : done ? "var(--green)" : "var(--field)";
    const mk = hot ? "url(#mh)" : done ? "url(#md)" : "url(#mf)";
    return `<path d="${smoothstep(A.x + W / 2, A.y + H, B.x + W / 2, B.y - 2)}" fill="none" stroke="${col}" stroke-width="${hot ? 2.2 : 1.4}"${anim ? ' stroke-dasharray="5 5"' : ""} marker-end="${mk}"></path>`;
  }).join("");
  const levels = (lv, max, req, st) => `<div class="row" style="gap: 4px;" aria-hidden="true">${Array.from({ length: max }, (_, i) => `<span style="height: 6px; flex: 1 1 0; border-radius: 999px; background: ${i < lv ? STATE[st].fill : "var(--line)"};${req != null && i === req - 1 ? " outline: 1px solid color-mix(in srgb, var(--label) 50%, transparent); outline-offset: 1px;" : ""}"></span>`).join("")}</div>`;
  const nodeHtml = nodes.map((n) => {
    const p = pos(n), s = STATE[n.st];
    return `<div style="position: absolute; left: ${p.x}px; top: ${p.y}px; width: ${W}px; height: ${H}px; border-radius: 16px; padding: 10px 14px; box-shadow: var(--shadow); ${s.card}${n.sel ? " box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent);" : ""}${n.def ? " outline: 2px solid color-mix(in srgb, var(--red) 50%, transparent); outline-offset: 2px;" : ""}">
<div class="row between" style="gap: 8px;"><span class="mono" style="font-size: 10px; color: var(--muted);">SKILL.${n.id}</span>${I(s.icon, 14, `color: ${s.ic};`)}</div>
<div class="m" style="font-size: 13px; line-height: 1.25; margin: 2px 0 8px;">Навык ${n.id}</div>${levels(n.lv, 5, n.req, n.st)}
<div class="row between" style="margin-top: 6px; font-size: 11px; color: var(--muted);"><span>уровень N${n.req != null ? " из N" : ""}</span>${n.def ? '<span class="m" style="color: var(--red-ink);">дефицит</span>' : ""}</div></div>`;
  }).join("");
  const marker = (id, col) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${col}"></path></marker>`;
  const ctrl = `<div style="position: absolute; left: 15px; bottom: 15px; display: flex; flex-direction: column; box-shadow: 0 0 2px 1px rgb(0 0 0 / 0.08);">${[["plus", "Увеличить"], ["minus", "Уменьшить"], ["fit", "Показать всё"]].map(([ic, t]) => `<button type="button" aria-label="${t}" title="${t}" style="display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-bottom: 1px solid var(--line); background: var(--surface); color: var(--text); padding: 0; cursor: pointer;">${I(ic, 14)}</button>`).join("")}</div>`;
  const map = `<div aria-label="Граф компетенций направления" style="position: relative; height: 560px; border-top: 1px solid var(--line-soft); overflow: hidden; background-image: radial-gradient(var(--line) 1px, transparent 1px); background-size: 18px 18px;">
<svg width="100%" height="560" style="position: absolute; inset: 0;" aria-hidden="true"><defs>${marker("mh", "var(--accent)")}${marker("md", "var(--green)")}${marker("mf", "var(--field)")}</defs>${paths}</svg>${nodeHtml}${ctrl}</div>`;
  const ring = (() => { const r = 44, c = 2 * Math.PI * r; return `<svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="Направление освоено на NN %"><circle cx="56" cy="56" r="${r}" fill="none" stroke="var(--sunken)" stroke-width="10"></circle><circle cx="56" cy="56" r="${r}" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * 0.42).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 56 56)"></circle><text x="56" y="60" text-anchor="middle" font-size="24" font-weight="600" fill="var(--text)" font-family="IBM Plex Sans">NN%</text></svg>`; })();
  const tile = (ic, l) => `<div class="col" style="min-width: 120px; gap: 2px; border-radius: 16px; background: var(--sunken); padding: 12px 16px;"><span class="row xs muted" style="gap: 6px;">${I(ic, 13)}${l}</span><b style="font-size: 24px; font-weight: 600;">N</b></div>`;
  const link = (n, tone, t) => `<a href="StudentSkills.dc.html" class="row between sm" style="gap: 8px; border-radius: 12px; padding: 6px 8px; color: var(--text); text-decoration: none;"><span>Навык ${n}</span>${chip(tone, t)}</a>`;
  const kv = (k, v) => `<div class="row between sm"><span class="muted">${k}</span><span>${v}</span></div>`;
  const side = `<div><div class="mono xs muted">SKILL.4</div><h2 style="font-size: 18px; font-weight: 600; line-height: 1.375;">Навык 4</h2></div>
<div class="row wrap" style="gap: 6px;">${chip("blue", "можно начать")}${chip("red", "дефицит: критический")}</div>
<p class="sm" style="line-height: 1.625;">Текст описания навыка…</p>
<div class="col hr" style="gap: 6px; padding-top: 12px;"><div class="xs m muted">Теория</div>${theory(["Навык 4"])}</div>
<div class="col" style="gap: 8px;"><div class="row between sm"><span class="muted">Уровень</span><b class="m">N из N · нужен N</b></div>${levels(0, 5, 3, "available")}${kv("Серия успехов", "N из 3 до повышения")}${kv("Прохождений", "N успешно · N нет")}${kv("Подтверждён", "—")}</div>
<div class="col hr" style="gap: 6px; padding-top: 12px;"><div class="xs m muted">Нужно сначала</div>${link(1, "green", "освоен")}</div>
<div class="col hr" style="gap: 6px; padding-top: 12px;"><div class="xs m muted">Открывает</div>${link(7, "grey", "закрыт")}${link(8, "grey", "закрыт")}</div>`;
  const srow = (n, lv, tone, req, conf, ser, def) => tr([{ h: `<div class="m">Навык ${n}</div><div class="mono xs muted">SKILL.${n}</div>` }, { h: `<div class="row" style="gap: 12px;"><div class="grow">${bar(lv, tone)}</div><span class="mono muted">N/N</span></div>` }, req, conf, ser, { h: def }]);
  return shell("student", 2, pageHeader("Мои навыки", { sub: "Карта компетенций направления: что освоено, что изучается и куда двигаться дальше", actions: flt("Направление", select(["Домен 1", "Домен 2"])) }) + page(`
${card(`${ring}<div class="col grow" style="min-width: 220px; gap: 4px;"><div style="font-size: 18px; font-weight: 600; letter-spacing: -0.015em;">Направление освоено на NN %</div><div class="sm muted">Доля требуемых уровней, которые вы уже подтвердили. Уровень растёт после трёх успешных прохождений подряд.</div><div class="row wrap sm" style="gap: 8px; margin-top: 8px;"><span>Следующий шаг: <b class="m">Навык 4</b></span>${chip("red", "критический")}<a href="StudentHome.dc.html" style="border-radius: 999px; background: var(--sunken); padding: 4px 12px; text-decoration: none;">К назначениям →</a></div></div>
<div style="display: grid; grid-template-columns: repeat(4, auto); gap: 8px;">${tile("check", "освоен")}${tile("activity", "в процессе")}${tile("target", "можно начать")}${tile("lock", "закрыт")}</div>`, { style: "display: flex; flex-wrap: wrap; align-items: center; gap: 16px 32px;" })}
<div class="g" style="grid-template-columns: minmax(0,1fr) 340px; align-items: stretch;">
${card(`<div class="row wrap between" style="gap: 12px; padding: 20px 20px 12px;">${ct("Карта навыков")}<div class="row wrap" style="gap: 6px;">${chip("green", "освоен")}${chip("amber", "в процессе")}${chip("blue", "можно начать")}${chip("grey", "закрыт")}${chip("red", "дефицит")}</div></div>${map}`, { np: true, style: "overflow: hidden;" })}
${card(side, { style: "display: flex; flex-direction: column; gap: 16px; align-self: start;" })}
</div>
${card(`<div class="cth">${ct("Подробно: Домен 1")}</div>${table(["Навык", { t: "Уровень", style: "width: 28%;" }, "Требуется", "Подтверждён", "Серия", "Дефицит"], [
    srow(1, 60, "green", "N", "ДД.ММ.ГГГГ", "N из 3", '<span class="muted">нет</span>'),
    srow(2, 60, "green", "N", "ДД.ММ.ГГГГ", "N из 3", '<span class="muted">нет</span>'),
    srow(3, 20, "amber", "N", `ДД.ММ.ГГГГ ${chip("amber", "устарел")}`, "N из 3", chip("red", "критический")),
    srow(4, 0, "accent", "N", "—", "N из 3", chip("red", "критический")),
    srow(5, 40, "amber", "N", "ДД.ММ.ГГГГ", "N из 3", chip("blue", "средний")),
    srow(6, 0, "accent", "N", "—", "N из 3", chip("amber", "высокий")),
  ])}`, { np: true })}
<p class="xs muted">Уровень повышается после трёх успешных прохождений подряд. Дефицит — разрыв с требуемым уровнем от двух или навык не подтверждался более 30 дней.</p>`));
}
