const results = [];
{
const THEME = "light";
const TS = [{"fs":15,"fw":"SemiBold","c":["text",1],"ls":0.6,"lh":22},{"fs":14,"c":["label",1],"lh":20},{"fs":14,"c":["on-nav",1],"lh":20},{"fs":12,"fw":"SemiBold","c":["amber-ink",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":28,"fw":"SemiBold","c":["text",1],"ls":-0.42,"lh":35},{"fs":14,"c":["muted",1],"lh":20},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":12,"fw":"Medium","c":["label",1],"lh":17},{"fs":14,"c":["text",1]},{"fs":14,"fw":"Medium","c":["on-accent",1],"lh":20},{"fs":12,"fw":"Medium","c":["muted",1],"lh":17},{"fs":14,"m":1,"c":["text",1],"lh":20},{"fs":12,"fw":"Medium","c":["red-ink",1],"lh":17},{"fs":12,"m":1,"c":["text",1],"lh":17},{"fs":12,"fw":"Medium","c":["amber-ink",1],"lh":17}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"r":999},{"f":["nav",1],"r":999},{"f":["amber-bg",1],"r":999},{"f":["surface",1],"r":20,"sh":1},{"f":["surface",1],"s":["field",1],"sw":[1,1,1,1],"r":12},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999},{"s":["line",1],"sw":[0,0,1,0]},{"s":["line-soft",1],"sw":[0,0,1,0]},{"f":["red-bg",1],"r":999},{"f":["sunken",1],"r":4},{"f":["sunken",1],"r":999}];

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


const page = figma.root.children[0];
const old = page.children.find(n => n.name.endsWith("· SysAudit"));
if (old) old.remove();
build([1,0,0,1440,900,0,[[1,24,12,1126,46,1,[[2,11,8,30,30,3],[0,49,13,57,19,"МАССО",0],[1,121,5,187,36,2,[[2,16,10,17,17,79],[0,41,9,131,18,"Состояние системы",1]],"SysHealth",0],[1,312,5,200,36,3,[[2,16,10,17,17,77],[0,41,9,144,18,"Аудит и безопасность",2]],"SysAudit",0]],0,"Основное меню"],[1,1162,15,40,40,1,[[2,11,8,18,18,0]],0,"Переключить тему (в макете — тумблер dark в Tweaks)"],[1,1214,14,202,42,1,[[1,5,5,32,32,4,[[0,9,8,16,15,"П3",3]]],[0,49,12,105,18,"Пользователь 3",4],[1,165,5,32,32,2,[[2,8,8,17,17,7]],"Main","Выйти"]]],[0,32,93,291,37,"Аудит и безопасность",5],[0,32,134,477,18,"Журнал действий пользователей и события безопасности учебных сред",6],[1,32,177,1376,418,5,[[0,21,66,242,20,"События безопасности и аудит",7],[0,581,22,84,15,"Дата начала *",8],[1,581,44,215,44,6,[[0,14,13,187,18,"ДД.ММ.ГГГГ",9]],0,"input.in"],[2,766,56,18,18,62],[0,808,22,105,15,"Дата окончания *",8],[1,808,44,215,44,6,[[0,14,13,187,18,"ДД.ММ.ГГГГ",9]],0,"input.in"],[2,993,56,18,18,62],[0,1035,22,47,15,"Журнал",8],[1,1035,44,156,44,6,[[0,14,13,128,18,"Безопасность",9]],0,"select.in"],[1,1203,44,152,44,7,[[2,21,13,18,18,67],[0,47,13,85,18,"Экспорт CSV",10]]],[1,1,108,154,38,8,[[0,12,11,39,15,"Время",11]]],[1,155,108,115,38,8,[[0,12,11,46,15,"Severity",11]]],[1,270,108,290,38,8,[[0,12,11,21,15,"Тип",11]]],[1,560,108,164,38,8,[[0,12,11,82,15,"Пользователь",11]]],[1,725,108,103,38,8,[[0,12,11,42,15,"Сессия",11]]],[1,827,108,548,38,8,[[0,12,11,58,15,"Описание",11]]],[1,1,146,154,45,9,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",12]]],[1,155,146,115,45,9,[[1,12,11,43,24,10,[[0,10,4,24,15,"high",13]]]]],[1,270,146,290,45,9,[[0,12,13,170,18,"попытка повышения прав",4]]],[1,560,146,164,45,9,[[0,12,13,105,18,"Обучающийся 1",4]]],[1,725,146,103,45,9,[[0,12,15,57,15,"xxxxxxxx",14]]],[1,827,146,548,45,9,[[0,12,13,61,18,"Команда",4],[1,72,13,75,19,11,[[0,6,2,64,15,"$ команда",14]],0,"code.code"],[0,147,13,192,18,"отклонена политикой среды",4]]],[1,1,191,154,45,9,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",12]]],[1,155,191,115,45,9,[[1,12,11,66,24,4,[[0,10,4,47,15,"medium",15]]]]],[1,270,191,290,45,9,[[0,12,13,106,18,"prompt injection",4]]],[1,560,191,164,45,9,[[0,12,13,105,18,"Обучающийся 2",4]]],[1,725,191,103,45,9,[[0,12,15,57,15,"xxxxxxxx",14]]],[1,827,191,548,45,9,[[0,12,13,234,18,"Запрос к подсказке отфильтрован:",4],[0,245,13,118,18,"«Текст запроса…»",6]]],[1,1,236,154,45,9,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",12]]],[1,155,236,115,45,9,[[1,12,11,66,24,4,[[0,10,4,47,15,"medium",15]]]]],[1,270,236,290,45,9,[[0,12,13,203,18,"доступ к запрещённому файлу",4]]],[1,560,236,164,45,9,[[0,12,13,105,18,"Обучающийся 3",4]]],[1,725,236,103,45,9,[[0,12,15,57,15,"xxxxxxxx",14]]],[1,827,236,548,45,9,[[0,12,13,61,18,"Команда",4],[1,72,13,110,19,11,[[0,6,2,99,15,"$ команда файл",14]],0,"code.code"],[0,182,13,192,18,"отклонена политикой среды",4]]],[1,1,281,154,45,9,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",12]]],[1,155,281,115,45,9,[[1,12,11,40,24,12,[[0,10,4,21,15,"low",8]]]]],[1,270,281,290,45,9,[[0,12,13,107,18,"неудачный вход",4]]],[1,560,281,164,45,9,[[0,12,13,12,18,"—",4]]],[1,725,281,103,45,9,[[0,12,15,8,15,"—",14]]],[1,827,281,548,45,9,[[0,12,13,104,18,"Учётная запись",4],[1,115,13,124,19,11,[[0,6,2,113,15,"user@example.org",14]],0,"code.code"]]],[1,1,326,154,45,9,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",12]]],[1,155,326,115,45,9,[[1,12,11,57,24,10,[[0,10,4,38,15,"critical",13]]]]],[1,270,326,290,45,9,[[0,12,13,164,18,"выход за пределы среды",4]]],[1,560,326,164,45,9,[[0,12,13,105,18,"Обучающийся 1",4]]],[1,725,326,103,45,9,[[0,12,15,57,15,"xxxxxxxx",14]]],[1,827,326,548,45,9,[[0,12,13,61,18,"Команда",4],[1,72,13,75,19,11,[[0,6,2,64,15,"$ команда",14]],0,"code.code"],[0,147,13,192,18,"отклонена политикой среды",4]]],[1,1,371,154,45,9,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",12]]],[1,155,371,115,45,9,[[1,12,11,43,24,10,[[0,10,4,24,15,"high",13]]]]],[1,270,371,290,45,9,[[0,12,13,151,18,"сетевое сканирование",4]]],[1,560,371,164,45,9,[[0,12,13,105,18,"Обучающийся 4",4]]],[1,725,371,103,45,9,[[0,12,15,57,15,"xxxxxxxx",14]]],[1,827,371,548,45,9,[[0,12,13,61,18,"Команда",4],[1,72,13,152,19,11,[[0,6,2,141,15,"$ команда --параметр",14]],0,"code.code"],[0,224,13,192,18,"отклонена политикой среды",4]]]]]],0,"Аудит и безопасность"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Аудит и безопасность (системный администратор) · SysAudit";
screen.x = 1520; screen.y = 7841; screen.clipsContent = true;
results.push({ screen: screen.id, nodes: count });

}
{

const page = figma.root.children[0];
const screens = {};
for (const n of page.children) { const m = n.name.match(/· (\w+)$/); if (m) screens[m[1]] = n; }
let set = 0; const missing = [];
for (const link of page.findAll(n => n.type === "FRAME" && n.name.startsWith("→ "))) {
  const dest = screens[link.name.slice(2)];
  if (!dest) { missing.push(link.name); continue; }
  await link.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: dest.id, navigation: "NAVIGATE", transition: null, preserveScrollPosition: false }] }]);
  set++;
}
page.flowStartingPoints = [{ nodeId: screens.Main.id, name: "МАССО — вход" }];
results.push({ set, missing: [...new Set(missing)] });

}
return results;
