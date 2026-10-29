const results = [];
{
const THEME = "light";
const TS = [{"fs":14,"c":["nav-ink",1],"lh":20},{"fs":12,"m":1,"c":["muted",1],"lh":17},{"fs":20,"fw":"SemiBold","c":["text",1],"ls":-0.3,"lh":29},{"fs":12,"fw":"Medium","c":["green-ink",1],"lh":17},{"fs":24,"m":1,"c":["text",1],"lh":35},{"fs":12,"c":["muted",1],"lh":17},{"fs":14,"fw":"Medium","c":["text",1],"lh":20},{"fs":14,"fw":"Medium","c":["on-accent",1],"lh":20},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":15,"c":["text",1],"lh":24,"ml":1},{"fs":15,"c":["text",1],"lh":24},{"fs":12,"fw":"Medium","c":["muted",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":12,"c":["muted",1],"lh":17,"ml":1},{"fs":13,"c":["muted",1],"lh":19,"ml":1},{"fs":14,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":14,"c":["text",1],"lh":23},{"fs":14,"fw":"SemiBold","c":["text",1],"lh":20},{"fs":14,"c":["muted",1],"lh":20},{"fs":12,"fw":"Medium","c":["amber-ink",1],"lh":17},{"fs":13,"m":1,"c":["text",1],"lh":21},{"fs":13,"fw":"Bold","c":["text",1],"lh":19},{"fs":13,"c":["text",1],"lh":19},{"fs":14,"c":["label",1],"lh":20},{"fs":14,"c":["red-ink",1],"lh":20},{"fs":14,"c":["text",1]},{"fs":14,"fw":"Medium","c":["red-ink",1],"lh":20},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23,"ml":1},{"fs":14,"fw":"Bold","c":["text",1],"lh":20},{"fs":14,"c":["text",1],"lh":19}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"f":["green-bg",1],"r":999},{"f":["green-ink",1],"r":999},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999},{"f":["surface",1],"r":20,"sh":1},{"f":["green",1],"s":["green",1],"sw":[1,1,1,1],"r":4},{"s":["label",1],"sw":[1,1,1,1],"r":4},{"f":["sunken",1],"s":["field",1],"sw":[1,1,1,1],"r":4},{"s":["line-soft",1],"sw":[1,0,0,0]},{"s":["line",1],"sw":[0,0,1,0]},{"f":["surface",1],"s":["line",1],"sw":[1,1,0,1],"r":[8,8,0,0]},{},{"f":["amber-bg",1],"r":999},{"f":["sunken",1],"r":4},{"f":["bg",1],"s":["line",1],"sw":[1,1,1,1]},{"s":["line",1],"sw":[1,1,1,1]},{"s":["line",1],"sw":[1,1,1,1],"r":12},{"f":["surface",1],"s":["field",1],"sw":[1,1,1,1],"r":12},{"f":["surface",1],"s":["field",1],"sw":[1,1,1,1],"r":12,"c":1},{"f":["surface",1],"r":999}];

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
const old = page.children.find(n => n.name.endsWith("· WorkspaceDocument"));
if (old) old.remove();
build([1,0,0,1440,1423,0,[[1,24,15,154,40,1,[[2,17,12,16,16,10],[0,39,11,99,18,"К назначениям",0]],"StudentHome",0],[0,198,13,309,15,"сессия xxxxxxxx · Домен 1 · сложность N из 5",1],[0,198,30,111,27,"Сценарий 2",2],[1,637,23,108,24,2,[[1,10,9,6,6,3,[]],[0,22,4,77,15,"среда готова",3]]],[2,765,26,18,18,11],[0,791,19,71,32,"ММ:СС",4],[0,869,32,55,15,"из ММ:СС",5],[1,943,13,108,44,4,[[2,21,13,18,18,11],[0,47,13,41,18,"Пауза",6]]],[1,1071,13,285,44,5,[[0,21,13,244,18,"Завершить и отправить на проверку",7]],"Report",0],[1,1376,15,40,40,1,[[2,11,8,18,18,0]],0,"Переключить тему (в макете — тумблер dark в Tweaks)"],[1,24,78,300,584,6,[[0,21,22,67,20,"Легенда",8],[0,21,62,224,92,"Текст легенды сценария… Описание ситуации, исходного состояния и ожидаемого результата.",9],[0,21,168,188,19,"Текст легенды сценария…",10],[0,21,207,130,15,"Критерии оценивания",11],[1,21,233,16,16,7,[[2,2,2,12,12,12]]],[0,45,232,76,18,"Критерий 1",12],[1,21,262,16,16,8,[]],[0,45,261,76,18,"Критерий 2",12],[1,21,290,16,16,8,[]],[0,45,289,76,18,"Критерий 3",12],[1,21,318,16,16,9,[[2,2,2,12,12,14]]],[0,45,317,76,18,"Критерий 4",12],[1,21,347,16,16,8,[]],[0,45,346,76,18,"Критерий 5",12],[1,21,377,258,36,4,[[2,37,9,18,18,15],[0,63,9,160,18,"Проверить выполнение",6]]],[0,21,420,249,32,"Проверено в ЧЧ:ММ:СС: выполнено N из N. Баллы не снимаются.",13],[1,21,470,258,93,10,[[0,0,14,117,15,"Ограничения среды",11],[0,0,36,227,55,"Документы только для чтения · ответ сохраняется автоматически · лимит времени сценария",14]]]]],[1,24,678,300,396,6,[[0,21,22,56,20,"Теория",8],[0,21,56,258,55,"Справка по навыкам этого сценария. Читать можно в любой момент — баллы за неё не снимаются.",14],[2,37,137,16,16,16],[0,61,136,57,18,"Навык 1",6],[2,247,137,16,16,17],[0,37,165,130,18,"Ключевые понятия",15],[0,37,192,150,18,"Текст теории навыка…",16],[0,61,223,102,18,"Пункт теории 1",16],[0,61,245,102,18,"Пункт теории 2",16],[2,37,298,16,16,16],[0,61,297,57,18,"Навык 2",6],[2,247,298,16,16,18],[2,37,346,16,16,16],[0,61,345,57,18,"Навык 3",6],[2,247,346,16,16,18]]],[1,340,78,740,430,6,[[1,1,1,738,52,11,[[1,12,12,104,40,12,[[0,13,11,79,18,"Документ 1",17]]],[1,120,12,181,40,13,[[0,13,11,78,18,"Документ 2",18],[1,98,8,70,24,14,[[0,10,4,51,15,"изменён",19]]]]],[1,305,12,103,40,13,[[0,13,11,78,18,"Документ 3",18]]]],0,"Документы"],[0,21,74,92,20,"Документ 1",8],[0,21,106,410,18,"Текст документа… Реквизиты, стороны и предмет документа.",16],[0,21,144,61,18,"Раздел 1",17],[0,21,173,108,18,"Текст раздела…",16],[1,128,172,76,21,15,[[0,6,2,65,17,"ссылка N",20]],0,"code.code"],[0,204,173,108,18,"Текст раздела…",16],[1,22,206,193,32,16,[[0,9,7,56,17,"Позиция",21]]],[1,215,206,214,32,16,[[0,9,7,75,17,"Количество",21]]],[1,429,206,134,32,16,[[0,9,7,33,17,"Цена",21]]],[1,563,206,155,32,16,[[0,9,7,41,17,"Сумма",21]]],[1,22,238,193,32,17,[[0,9,7,66,17,"Позиция 1",22]]],[1,215,238,214,32,17,[[0,9,7,19,17,"NN",22]]],[1,429,238,134,32,17,[[0,9,7,41,17,"NN,NN",22]]],[1,563,238,155,32,17,[[0,9,7,50,17,"NNN,NN",22]]],[1,22,270,193,32,17,[[0,9,7,66,17,"Позиция 2",22]]],[1,215,270,214,32,17,[[0,9,7,19,17,"NN",22]]],[1,429,270,134,32,17,[[0,9,7,41,17,"NN,NN",22]]],[1,563,270,155,32,17,[[0,9,7,50,17,"NNN,NN",22]]],[1,22,302,193,32,17,[[0,9,7,66,17,"Позиция 3",22]]],[1,215,302,214,32,17,[[0,9,7,19,17,"NN",22]]],[1,429,302,134,32,17,[[0,9,7,41,17,"NN,NN",22]]],[1,563,302,155,32,17,[[0,9,7,50,17,"NNN,NN",22]]],[0,21,351,61,18,"Раздел 2",17],[0,21,381,344,18,"Текст раздела… Условия, сроки и порядок расчётов.",16]]],[1,340,525,740,874,6,[[0,21,22,46,20,"Ответ",8],[0,587,25,133,15,"Сохранено в ЧЧ:ММ:СС",5],[1,21,60,698,358,18,[[0,21,1,121,18,"Несоответствие 1",17],[0,17,49,124,18,"Раздел документа",23],[0,140,49,7,18,"*",24],[1,243,36,438,44,19,[[0,14,13,410,18,"Раздел 1",25]],0,"select.in"],[0,17,105,136,18,"Тип несоответствия",23],[0,152,105,7,18,"*",24],[1,243,92,438,44,19,[[0,14,13,410,18,"Тип несоответствия 1",25]],0,"select.in"],[0,17,159,92,18,"Комментарий",23],[1,243,148,438,67,20,[[0,12,24,414,18,"Текст комментария…",25]],0,"textarea.in"],[0,17,238,160,18,"Предлагаемая редакция",23],[1,243,227,438,67,20,[[0,12,24,414,18,"Текст предлагаемой редакции…",25]],0,"textarea.in"],[1,565,305,116,36,21,[[2,17,9,18,18,22],[0,43,9,57,18,"Удалить",26]]]],0,"fieldset.col"],[1,21,435,698,358,18,[[0,21,1,121,18,"Несоответствие 2",17],[0,17,49,124,18,"Раздел документа",23],[0,140,49,7,18,"*",24],[1,243,36,438,44,19,[[0,14,13,410,18,"— раздел —",25]],0,"select.in"],[0,17,105,136,18,"Тип несоответствия",23],[0,152,105,7,18,"*",24],[1,243,92,438,44,19,[[0,14,13,410,18,"— тип —",25]],0,"select.in"],[0,17,159,92,18,"Комментарий",23],[1,243,148,438,67,20,[],0,"textarea.in"],[0,17,238,160,18,"Предлагаемая редакция",23],[1,243,227,438,67,20,[],0,"textarea.in"],[1,565,305,116,36,21,[[2,17,9,18,18,22],[0,43,9,57,18,"Удалить",26]]]],0,"fieldset.col"],[1,21,809,244,44,4,[[2,21,13,18,18,23],[0,47,13,177,18,"Добавить несоответствие",6]]]]],[1,1096,78,320,358,6,[[0,21,22,68,43,"Журнал событий",27],[0,142,28,142,32,"обновляется в реальном времени",13],[2,21,93,18,18,19],[0,51,92,124,18,"Предупреждение",28],[0,264,94,36,15,"ЧЧ:ММ",1],[0,51,112,165,18,"Текст предупреждения…",29],[1,21,143,278,65,10,[[2,0,15,18,18,20],[0,30,14,152,18,"Самопроверка: N из N",28],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,141,18,"Баллы не снимаются.",29]]],[1,21,207,278,65,10,[[2,0,15,18,18,20],[0,30,14,92,18,"Среда готова",28],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,147,18,"Учебная среда готова.",29]]],[1,21,272,278,65,10,[[2,0,15,18,18,20],[0,30,14,95,18,"Запуск среды",28],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,192,18,"Подготовка учебной среды…",29]]]]],[1,1096,452,320,191,6,[[0,21,22,84,20,"Подсказки",8],[1,191,21,108,24,14,[[0,10,4,89,15,"осталось 3 из 3",19]]],[0,21,57,279,55,"Каждая подсказка снижает итоговый балл на 10 %. Подсказка указывает область проблемы, но не содержит готовой команды.",14],[1,21,126,278,44,4,[[2,55,13,18,18,21],[0,81,13,144,18,"Запросить подсказку",6]],"HintDialog",0]]]],0,"Рабочая область — документы"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Рис. 39. Рабочая область: документный сценарий · WorkspaceDocument";
screen.x = 3040; screen.y = 1500; screen.clipsContent = true;
results.push({ screen: screen.id, nodes: count });

}
{
const THEME = "light";
const TS = [{"fs":14,"c":["nav-ink",1],"lh":20},{"fs":12,"m":1,"c":["muted",1],"lh":17},{"fs":20,"fw":"SemiBold","c":["text",1],"ls":-0.3,"lh":29},{"fs":12,"fw":"Medium","c":["green-ink",1],"lh":17},{"fs":24,"m":1,"c":["text",1],"lh":35},{"fs":12,"c":["muted",1],"lh":17},{"fs":14,"fw":"Medium","c":["text",1],"lh":20},{"fs":14,"fw":"Medium","c":["on-accent",1],"lh":20},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":15,"c":["text",1],"lh":24,"ml":1},{"fs":15,"c":["text",1],"lh":24},{"fs":12,"fw":"Medium","c":["muted",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":12,"c":["muted",1],"lh":17,"ml":1},{"fs":13,"c":["muted",1],"lh":19,"ml":1},{"fs":14,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":14,"c":["text",1],"lh":23},{"fs":13,"m":1,"c":["text",1],"lh":21},{"fs":13,"fw":"Bold","c":["text",1],"lh":21},{"fs":13,"m":1,"c":["on-nav",1],"lh":19},{"fs":12,"c":["on-nav",1],"lh":17},{"fs":13,"m":1,"c":["nav-ink",1],"lh":19},{"fs":12,"c":["label",1],"lh":17},{"fs":14,"m":1,"c":["muted",1],"lh":22},{"fs":14,"m":1,"c":["cm-kw",1],"lh":22,"ml":1},{"fs":14,"m":1,"c":["text",1],"lh":22,"ml":1},{"fs":14,"m":1,"c":["cm-def",1],"lh":22,"ml":1},{"fs":14,"m":1,"c":["cm-com",1],"lh":22,"ml":1},{"fs":13,"m":1,"c":["text",1],"lh":19},{"fs":13,"m":1,"c":["muted",1],"lh":19},{"fs":13,"m":1,"c":["red-ink",1],"lh":19},{"fs":12,"fw":"Medium","c":["red-ink",1],"lh":17},{"fs":12,"c":["term-ink",1],"lh":17},{"fs":12,"m":1,"c":["term-ink",1],"lh":17,"ml":1},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23,"ml":1},{"fs":14,"fw":"Bold","c":["text",1],"lh":20},{"fs":14,"c":["text",1],"lh":19},{"fs":12,"fw":"Medium","c":["amber-ink",1],"lh":17}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"f":["green-bg",1],"r":999},{"f":["green-ink",1],"r":999},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999},{"f":["surface",1],"r":20,"sh":1},{"f":["green",1],"s":["green",1],"sw":[1,1,1,1],"r":4},{"f":["red",1],"s":["red",1],"sw":[1,1,1,1],"r":4},{"s":["label",1],"sw":[1,1,1,1],"r":4},{"s":["line-soft",1],"sw":[1,0,0,0]},{"f":["sunken",1],"r":4},{"f":["bg",1],"s":["line",1],"sw":[1,1,1,1]},{"s":["line",1],"sw":[1,1,1,1]},{"f":["surface",1],"r":20,"sh":1,"c":1},{"s":["line-soft",1],"sw":[0,0,1,0]},{"f":["nav",1],"r":999},{"r":999},{"f":["cm-bg",1]},{"f":["cm-gutter",1]},{"f":["cm-active-gutter",1]},{"f":["cm-active",1]},{"f":["red-bg",1],"r":999},{"f":["term",1],"r":12},{"f":["amber-bg",1],"r":999}];

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
const old = page.children.find(n => n.name.endsWith("· WorkspaceCode"));
if (old) old.remove();
build([1,0,0,1440,1216,0,[[1,24,15,154,40,1,[[2,17,12,16,16,10],[0,39,11,99,18,"К назначениям",0]],"StudentHome",0],[0,198,13,309,15,"сессия xxxxxxxx · Домен 1 · сложность N из 5",1],[0,198,30,111,27,"Сценарий 3",2],[1,637,23,108,24,2,[[1,10,9,6,6,3,[]],[0,22,4,77,15,"среда готова",3]]],[2,765,26,18,18,11],[0,791,19,71,32,"ММ:СС",4],[0,869,32,55,15,"из ММ:СС",5],[1,943,13,108,44,4,[[2,21,13,18,18,11],[0,47,13,41,18,"Пауза",6]]],[1,1071,13,285,44,5,[[0,21,13,244,18,"Завершить и отправить на проверку",7]],"Report",0],[1,1376,15,40,40,1,[[2,11,8,18,18,0]],0,"Переключить тему (в макете — тумблер dark в Tweaks)"],[1,24,78,300,584,6,[[0,21,22,67,20,"Легенда",8],[0,21,62,224,92,"Текст легенды сценария… Описание ситуации, исходного состояния и ожидаемого результата.",9],[0,21,168,188,19,"Текст легенды сценария…",10],[0,21,207,130,15,"Критерии оценивания",11],[1,21,233,16,16,7,[[2,2,2,12,12,12]]],[0,45,232,76,18,"Критерий 1",12],[1,21,262,16,16,8,[[2,2,2,12,12,13]]],[0,45,261,76,18,"Критерий 2",12],[1,21,290,16,16,9,[]],[0,45,289,76,18,"Критерий 3",12],[1,21,318,16,16,9,[]],[0,45,317,76,18,"Критерий 4",12],[1,21,347,16,16,9,[]],[0,45,346,76,18,"Критерий 5",12],[1,21,377,258,36,4,[[2,37,9,18,18,15],[0,63,9,160,18,"Проверить выполнение",6]]],[0,21,420,249,32,"Проверено в ЧЧ:ММ:СС: выполнено N из N. Баллы не снимаются.",13],[1,21,470,258,93,10,[[0,0,14,117,15,"Ограничения среды",11],[0,0,36,254,55,"Код выполняется в одноразовом контейнере без сети · лимиты времени и памяти на запуск",14]]]]],[1,24,678,300,396,6,[[0,21,22,56,20,"Теория",8],[0,21,56,258,55,"Справка по навыкам этого сценария. Читать можно в любой момент — баллы за неё не снимаются.",14],[2,37,137,16,16,16],[0,61,136,57,18,"Навык 1",6],[2,247,137,16,16,17],[0,37,165,130,18,"Ключевые понятия",15],[0,37,192,150,18,"Текст теории навыка…",16],[0,61,223,102,18,"Пункт теории 1",16],[0,61,245,102,18,"Пункт теории 2",16],[2,37,298,16,16,16],[0,61,297,57,18,"Навык 2",6],[2,247,298,16,16,18],[2,37,346,16,16,16],[0,61,345,57,18,"Навык 3",6],[2,247,346,16,16,18]]],[1,340,78,740,282,6,[[0,21,22,65,20,"Условие",8],[0,21,62,324,19,"Текст условия задачи… Реализуйте функцию",10],[1,344,62,100,21,11,[[0,6,2,89,17,"solve(data)",17]],0,"code.code"],[0,444,62,247,19,", которая возвращает результат по",10],[0,21,87,155,19,"правилам из условия.",10],[1,22,117,440,34,12,[[0,9,9,42,17,"Вызов",18]]],[1,462,117,257,34,12,[[0,9,9,64,17,"Результат",18]]],[1,22,152,440,34,13,[[0,9,9,121,17,"solve(пример 1)",17]]],[1,462,152,257,34,13,[[0,9,9,17,17,"NN",17]]],[1,22,186,440,34,13,[[0,9,9,121,17,"solve(пример 2)",17]]],[1,462,186,257,34,13,[[0,9,9,17,17,"NN",17]]],[0,21,230,314,19,"Ограничения: N ≤ NN. Текст ограничений…",10]]],[1,340,376,740,502,14,[[1,1,1,738,100,15,[[1,16,10,183,31,16,[[0,14,6,97,17,"solution.py",19],[0,110,7,60,15,"· Решение",20]]],[1,203,10,232,31,17,[[0,14,6,137,17,"test_solution.py",21],[0,150,7,69,15,"· Мои тесты",22]]],[0,16,63,133,15,"Сохранено в ЧЧ:ММ:СС",5],[1,160,53,171,36,5,[[2,17,9,18,18,24],[0,43,9,112,18,"Запустить тесты",7]]]]],[1,1,101,738,400,18,[[1,0,0,44,400,19,[[0,24,14,9,18,"1",23],[0,24,36,9,18,"2",23],[0,24,59,9,18,"3",23],[0,24,81,9,18,"4",23],[0,24,104,9,18,"5",23],[0,24,126,9,18,"6",23],[1,0,146,44,22,20,[[0,24,2,9,18,"7",23]]],[0,24,171,9,18,"8",23],[0,24,193,9,18,"9",23],[0,16,216,17,18,"10",23],[0,16,238,17,18,"11",23],[0,16,260,17,18,"12",23],[0,16,283,17,18,"13",23],[0,16,305,17,18,"14",23]]],[0,52,14,25,18,"def",24],[0,76,14,9,18," ",25],[0,84,14,41,18,"solve",26],[0,124,14,57,18,"(data):",25],[0,52,36,33,18,"    ",25],[0,84,36,233,18,"\"\"\"Текст описания функции…\"\"\"",27],[0,52,59,33,18,"    ",25],[0,84,59,73,18,"# решение",27],[0,52,81,121,18,"    result = []",25],[0,52,104,33,18,"    ",25],[0,84,104,25,18,"for",24],[0,108,104,49,18," item ",25],[0,156,104,17,18,"in",24],[0,172,104,49,18," data:",25],[0,52,126,65,18,"        ",25],[0,116,126,121,18,"# шаг алгоритма",27],[1,44,146,694,22,21,[[0,8,2,89,18,"        ...",25]]],[0,52,171,33,18,"    ",25],[0,84,171,49,18,"return",24],[0,132,171,57,18," result",25],[0,52,193,9,18," ",25],[0,52,216,9,18," ",25],[0,52,238,25,18,"def",24],[0,76,238,9,18," ",25],[0,84,238,49,18,"helper",26],[0,132,238,65,18,"(value):",25],[0,52,260,33,18,"    ",25],[0,84,260,201,18,"# вспомогательная функция",27],[0,52,283,33,18,"    ",25],[0,84,283,49,18,"return",24],[0,132,283,49,18," value",25],[0,52,305,9,18," ",25]],0,"Файл solution.py"]]],[1,340,894,740,299,6,[[0,21,22,143,20,"Результат запуска",8],[0,463,25,257,15,"баллы не начисляются · итог — при отправке",5],[0,21,57,121,15,"Примеры из условия",11],[2,33,90,14,14,25],[0,59,88,121,17,"solve(пример 1)",28],[0,191,88,97,17,"ожидается NN",29],[2,33,131,14,14,26],[0,59,128,121,17,"solve(пример 2)",28],[0,191,128,97,17,"ожидается NN",29],[0,299,128,89,17,"получено NN",30],[0,21,172,62,15,"Мои тесты",11],[1,90,167,57,24,22,[[0,10,4,38,15,"N из N",31]]],[0,33,205,337,17,"test_case_n: AssertionError: текст ошибки…",30],[1,21,244,698,33,23,[[0,25,9,106,15,"Вывод программы",32],[0,12,34,113,15,"вывод программы…",33]],0,"details"]]],[1,1096,78,320,293,6,[[0,21,22,68,43,"Журнал событий",34],[0,142,28,142,32,"обновляется в реальном времени",13],[2,21,93,18,18,20],[0,51,92,152,18,"Самопроверка: N из N",35],[0,264,94,36,15,"ЧЧ:ММ",1],[0,51,112,141,18,"Баллы не снимаются.",36],[1,21,143,278,65,10,[[2,0,15,18,18,20],[0,30,14,92,18,"Среда готова",35],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,147,18,"Учебная среда готова.",36]]],[1,21,207,278,65,10,[[2,0,15,18,18,20],[0,30,14,95,18,"Запуск среды",35],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,192,18,"Подготовка учебной среды…",36]]]]],[1,1096,387,320,191,6,[[0,21,22,84,20,"Подсказки",8],[1,191,21,108,24,24,[[0,10,4,89,15,"осталось 3 из 3",37]]],[0,21,57,279,55,"Каждая подсказка снижает итоговый балл на 10 %. Подсказка указывает область проблемы, но не содержит готовой команды.",14],[1,21,126,278,44,4,[[2,55,13,18,18,21],[0,81,13,144,18,"Запросить подсказку",6]],"HintDialog",0]]]],0,"Рабочая область — код"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Рис. 40. Рабочая область: задача на код · WorkspaceCode";
screen.x = 4560; screen.y = 1500; screen.clipsContent = true;
results.push({ screen: screen.id, nodes: count });

}
{
const THEME = "light";
const TS = [{"fs":14,"c":["nav-ink",1],"lh":20},{"fs":12,"m":1,"c":["muted",1],"lh":17},{"fs":20,"fw":"SemiBold","c":["text",1],"ls":-0.3,"lh":29},{"fs":12,"fw":"Medium","c":["green-ink",1],"lh":17},{"fs":24,"m":1,"c":["text",1],"lh":35},{"fs":12,"c":["muted",1],"lh":17},{"fs":14,"fw":"Medium","c":["text",1],"lh":20},{"fs":14,"fw":"Medium","c":["on-accent",1],"lh":20},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":15,"c":["text",1],"lh":24,"ml":1},{"fs":15,"c":["text",1],"lh":24},{"fs":12,"fw":"Medium","c":["muted",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":12,"c":["muted",1],"lh":17,"ml":1},{"fs":13,"c":["muted",1],"lh":19,"ml":1},{"fs":14,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":14,"c":["text",1],"lh":23},{"fs":13,"m":1,"c":["term-ink",1],"lh":19},{"fs":13,"c":["term-ink",1],"lh":19},{"fs":14,"m":1,"c":["#86efac",1],"lh":18,"ml":1},{"fs":14,"m":1,"c":["term-ink",1],"lh":18,"ml":1},{"fs":14,"m":1,"c":["#93c5fd",1],"lh":18,"ml":1},{"fs":14,"m":1,"c":["#fdba74",1],"lh":18,"ml":1},{"fs":14,"m":1,"c":["text",1],"lh":18,"ml":1},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23,"ml":1},{"fs":14,"fw":"Bold","c":["text",1],"lh":20},{"fs":14,"c":["text",1],"lh":19,"ml":1},{"fs":14,"c":["text",1],"lh":19},{"fs":12,"fw":"Medium","c":["amber-ink",1],"lh":17},{"fs":14,"c":["text",1]}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"f":["green-bg",1],"r":999},{"f":["green-ink",1],"r":999},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999},{"f":["surface",1],"r":20,"sh":1},{"f":["green",1],"s":["green",1],"sw":[1,1,1,1],"r":4},{"f":["red",1],"s":["red",1],"sw":[1,1,1,1],"r":4},{"f":["sunken",1],"s":["field",1],"sw":[1,1,1,1],"r":4},{"s":["label",1],"sw":[1,1,1,1],"r":4},{"s":["line-soft",1],"sw":[1,0,0,0]},{"f":["term",1],"r":20,"sh":1,"c":1},{"f":["term-bar",1]},{"f":["#fca5a5",1],"r":999},{"f":["#fdba74",1],"r":999},{"f":["#86efac",1],"r":999},{"f":["#fb923c",1]},{"f":["amber-bg",1],"r":999},{"f":["surface",1],"s":["field",1],"sw":[1,1,1,1],"r":12,"c":1},{"r":999}];

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
const old = page.children.find(n => n.name.endsWith("· HintDialog"));
if (old) old.remove();
build([1,0,0,1440,1098,0,[[1,24,15,154,40,1,[[2,17,12,16,16,10],[0,39,11,99,18,"К назначениям",0]],"StudentHome",0],[0,198,13,309,15,"сессия xxxxxxxx · Домен 1 · сложность N из 5",1],[0,198,30,111,27,"Сценарий 1",2],[1,637,23,108,24,2,[[1,10,9,6,6,3,[]],[0,22,4,77,15,"среда готова",3]]],[2,765,26,18,18,11],[0,791,19,71,32,"ММ:СС",4],[0,869,32,55,15,"из ММ:СС",5],[1,943,13,108,44,4,[[2,21,13,18,18,11],[0,47,13,41,18,"Пауза",6]]],[1,1071,13,285,44,5,[[0,21,13,244,18,"Завершить и отправить на проверку",7]],"Report",0],[1,1376,15,40,40,1,[[2,11,8,18,18,0]],"WorkspaceDark","Переключить тему"],[1,24,78,300,584,6,[[0,21,22,67,20,"Легенда",8],[0,21,62,224,92,"Текст легенды сценария… Описание ситуации, исходного состояния и ожидаемого результата.",9],[0,21,168,188,19,"Текст легенды сценария…",10],[0,21,207,130,15,"Критерии оценивания",11],[1,21,233,16,16,7,[[2,2,2,12,12,12]]],[0,45,232,76,18,"Критерий 1",12],[1,21,262,16,16,7,[[2,2,2,12,12,12]]],[0,45,261,76,18,"Критерий 2",12],[1,21,290,16,16,8,[[2,2,2,12,12,13]]],[0,45,289,76,18,"Критерий 3",12],[1,21,318,16,16,9,[[2,2,2,12,12,14]]],[0,45,317,76,18,"Критерий 4",12],[1,21,347,16,16,10,[]],[0,45,346,76,18,"Критерий 5",12],[1,21,377,258,36,4,[[2,37,9,18,18,15],[0,63,9,160,18,"Проверить выполнение",6]]],[0,21,420,249,32,"Проверено в ЧЧ:ММ:СС: выполнено N из N. Баллы не снимаются.",13],[1,21,470,258,93,11,[[0,0,14,117,15,"Ограничения среды",11],[0,0,36,259,55,"Пользователь без прав администратора · сеть отключена · запись только в рабочий каталог · лимиты профиля среды",14]]]]],[1,24,678,300,396,6,[[0,21,22,56,20,"Теория",8],[0,21,56,258,55,"Справка по навыкам этого сценария. Читать можно в любой момент — баллы за неё не снимаются.",14],[2,37,137,16,16,16],[0,61,136,57,18,"Навык 1",6],[2,247,137,16,16,17],[0,37,165,130,18,"Ключевые понятия",15],[0,37,192,150,18,"Текст теории навыка…",16],[0,61,223,102,18,"Пункт теории 1",16],[0,61,245,102,18,"Пункт теории 2",16],[2,37,298,16,16,16],[0,61,297,57,18,"Навык 2",6],[2,247,298,16,16,18],[2,37,346,16,16,16],[0,61,345,57,18,"Навык 3",6],[2,247,346,16,16,18]]],[1,340,78,740,750,12,[[1,0,0,740,43,13,[[1,20,16,10,10,14,[]],[1,36,16,10,10,15,[]],[1,52,16,10,10,16,[]],[0,74,12,185,17,"student@masso-srv: /srv",17],[1,565,17,8,8,16,[]],[0,581,12,140,17,"WebSocket подключён",18]]],[0,16,59,137,18,"student@masso-srv",19],[0,152,59,9,18,":",20],[0,160,59,33,18,"/srv",21],[0,16,59,249,54,"$ команда\nвывод команды…\nвывод команды…\n",20],[0,16,132,137,18,"student@masso-srv",19],[0,152,132,9,18,":",20],[0,160,132,33,18,"/srv",21],[0,16,132,337,54,"$ команда --параметр\nстрока вывода 1\nстрока вывода 2",20],[0,16,186,257,18,"предупреждение: текст сообщения…",22],[0,16,223,137,18,"student@masso-srv",19],[0,152,223,9,18,":",20],[0,160,223,33,18,"/srv",21],[0,16,223,289,36,"$ команда файл\nсодержимое файла…\n",20],[0,16,277,137,18,"student@masso-srv",19],[0,152,277,9,18,":",20],[0,160,277,33,18,"/srv",21],[0,192,277,17,18,"$ ",20],[1,208,277,8,18,17,[[0,0,0,9,18," ",23]]]],0,"Терминал учебной среды"],[1,1096,78,320,461,6,[[0,21,22,68,43,"Журнал событий",24],[0,142,28,142,32,"обновляется в реальном времени",13],[2,21,93,18,18,27],[0,51,92,115,18,"Подсказка 1 из 3",25],[0,264,94,36,15,"ЧЧ:ММ",1],[0,51,112,214,57,"Текст подсказки… Обратите внимание на область проблемы, указанную в легенде.",26],[1,21,181,278,65,11,[[2,0,15,18,18,19],[0,30,14,71,18,"Инцидент",25],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,219,18,"Текст сообщения об инциденте…",27]]],[1,21,246,278,65,11,[[2,0,15,18,18,20],[0,30,14,152,18,"Самопроверка: N из N",25],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,141,18,"Баллы не снимаются.",27]]],[1,21,311,278,65,11,[[2,0,15,18,18,20],[0,30,14,92,18,"Среда готова",25],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,147,18,"Учебная среда готова.",27]]],[1,21,375,278,65,11,[[2,0,15,18,18,20],[0,30,14,95,18,"Запуск среды",25],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,192,18,"Подготовка учебной среды…",27]]]]],[1,1096,555,320,289,6,[[0,21,22,84,20,"Подсказки",8],[1,191,21,108,24,18,[[0,10,4,89,15,"осталось 2 из 3",28]]],[0,21,57,279,55,"Каждая подсказка снижает итоговый балл на 10 %. Подсказка указывает область проблемы, но не содержит готовой команды.",14],[1,21,126,278,87,19,[[0,12,34,254,18,"Текст вопроса…",29]],0,"Вопрос к подсказке (необязательно)"],[1,21,224,193,44,4,[[2,15,13,18,18,21],[0,41,13,138,18,"Получить подсказку",6]],"WorkspaceContainer",0],[1,222,224,77,44,20,[[0,13,13,52,18,"Отмена",6]],"WorkspaceContainer",0]]]],0,"Рабочая область — подсказка"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Рабочая область: запрос подсказки · HintDialog";
screen.x = 6080; screen.y = 1500; screen.clipsContent = true;
results.push({ screen: screen.id, nodes: count });

}
{
const THEME = "light";
const TS = [{"fs":15,"fw":"SemiBold","c":["text",1],"ls":0.6,"lh":22},{"fs":14,"c":["label",1],"lh":20},{"fs":14,"c":["on-nav",1],"lh":20},{"fs":12,"fw":"SemiBold","c":["amber-ink",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":13,"c":["muted",1],"lh":19},{"fs":28,"fw":"SemiBold","c":["text",1],"ls":-0.42,"lh":35},{"fs":14,"fw":"Medium","c":["text",1],"lh":20},{"fs":12,"fw":"Medium","c":["green-ink",1],"lh":17},{"fs":13,"m":1,"c":["muted",1],"lh":19},{"fs":14,"c":["muted",1],"lh":20},{"fs":20,"fw":"SemiBold","c":["text",1],"lh":29},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":12,"fw":"Medium","c":["muted",1],"lh":17},{"fs":12,"fw":"Medium","c":["label",1],"lh":17},{"fs":12,"fw":"Medium","c":["red-ink",1],"lh":17},{"fs":14,"fw":"Bold","c":["red-ink",1],"lh":20},{"fs":14,"c":["red-ink",1],"lh":20},{"fs":14,"fw":"SemiBold","c":["text",1],"lh":20},{"fs":12,"fw":"Medium","c":["blue-ink",1],"lh":17},{"fs":12,"fw":"Medium","c":["amber-ink",1],"lh":17},{"fs":13,"c":["muted",1],"lh":19,"ml":1},{"fs":14,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":14,"c":["text",1],"lh":23},{"fs":14,"c":["text",1],"lh":23,"ml":1},{"fs":14,"fw":"Medium","c":["on-accent",1],"lh":20}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"r":999},{"f":["nav",1],"r":999},{"f":["amber-bg",1],"r":999},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999},{"f":["surface",1],"r":20,"sh":1},{"f":["green-bg",1],"r":999},{"s":["line",1],"sw":[0,0,0,1]},{"s":["line",1],"sw":[0,0,1,0]},{"s":["line-soft",1],"sw":[0,0,1,0]},{"f":["sunken",1],"r":999},{"f":["red-bg",1],"r":999},{"f":["red-bg",1],"r":16},{"s":["line-soft",1],"sw":[1,0,0,0]},{"f":["blue-bg",1],"r":999},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999}];

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
const old = page.children.find(n => n.name.endsWith("· Report"));
if (old) old.remove();
build([1,0,0,1440,1102,0,[[1,24,12,1126,46,1,[[2,11,8,30,30,3],[0,49,13,57,19,"МАССО",0],[1,121,5,163,36,2,[[2,16,10,17,17,28],[0,41,9,107,18,"Мои назначения",1]],"StudentHome",0],[1,288,5,132,36,3,[[2,16,10,17,17,29],[0,41,9,76,18,"Протоколы",2]],"StudentReports",0],[1,424,5,136,36,2,[[2,16,10,17,17,6],[0,41,9,80,18,"Мои навыки",1]],"StudentSkills",0]],0,"Основное меню"],[1,1162,15,40,40,1,[[2,11,8,18,18,0]],0,"Переключить тему (в макете — тумблер dark в Tweaks)"],[1,1214,14,202,42,1,[[1,5,5,32,32,4,[[0,8,8,17,15,"О1",3]]],[0,49,12,105,18,"Обучающийся 1",4],[1,165,5,32,32,2,[[2,8,8,17,17,7]],"Main","Выйти"]]],[0,32,94,340,17,"Протокол прохождения · сессия xxxxxxxx · ДД.ММ.ГГГГ",5],[0,32,116,156,37,"Сценарий 1",6],[1,1148,108,103,44,5,[[2,21,13,18,18,30],[0,47,13,36,18,"JSON",7]]],[1,1261,108,147,44,5,[[2,21,13,18,18,31],[0,47,13,80,18,"Печать PDF",7]]],[1,32,176,1376,174,6,[[2,21,21,132,132,32],[1,173,48,127,24,7,[[0,10,4,108,15,"сценарий пройден",8]]],[0,173,80,361,17,"база × (1 − 0,1 × подсказки) − 10 × нарушения",9],[0,173,107,257,17,"NN × (1 − 0,1 × N) − 10 × N = NN",9],[1,565,59,107,55,8,[[0,21,1,67,18,"Проверки",10],[0,21,27,61,27,"N из N",11]]],[1,672,59,112,55,8,[[0,21,1,43,18,"Время",10],[0,21,27,72,27,"NN мин",11]]],[1,784,59,138,55,8,[[0,21,1,72,18,"Подсказки",10],[0,21,27,98,27,"N (−NN %)",11]]],[1,922,59,116,55,8,[[0,21,1,76,18,"Инциденты",10],[0,21,27,15,27,"N",11]]],[1,1038,59,115,55,8,[[0,21,1,75,18,"Нарушения",10],[0,21,27,15,27,"N",11]]]]],[1,32,370,956,494,6,[[0,21,22,170,20,"Результаты проверок",12],[1,1,56,501,38,9,[[0,12,11,58,15,"Проверка",13]]],[1,502,56,112,38,9,[[0,12,11,22,15,"Вес",13]]],[1,613,56,342,38,9,[[0,12,11,59,15,"Результат",13]]],[1,1,94,501,45,10,[[0,12,13,80,18,"Проверка 1",4],[1,95,11,95,24,11,[[0,10,4,76,15,"критическая",14]]]]],[1,502,94,112,45,10,[[0,12,13,21,18,"NN",4]]],[1,613,94,342,45,10,[[1,12,11,76,24,7,[[0,10,4,57,15,"пройдена",8]]]]],[1,1,139,501,45,10,[[0,12,13,77,18,"Проверка 2",4]]],[1,502,139,112,45,10,[[0,12,13,21,18,"NN",4]]],[1,613,139,342,45,10,[[1,12,11,76,24,7,[[0,10,4,57,15,"пройдена",8]]]]],[1,1,184,501,45,10,[[0,12,13,77,18,"Проверка 3",4]]],[1,502,184,112,45,10,[[0,12,13,21,18,"NN",4]]],[1,613,184,342,45,10,[[1,12,11,93,24,12,[[0,10,4,74,15,"не пройдена",15]]]]],[1,1,229,501,45,10,[[0,12,13,77,18,"Проверка 4",4]]],[1,502,229,112,45,10,[[0,12,13,21,18,"NN",4]]],[1,613,229,342,45,10,[[1,12,11,76,24,7,[[0,10,4,57,15,"пройдена",8]]]]],[1,1,274,501,45,10,[[0,12,13,77,18,"Проверка 5",4]]],[1,502,274,112,45,10,[[0,12,13,21,18,"NN",4]]],[1,613,274,342,45,10,[[1,12,11,114,24,11,[[0,10,4,95,15,"не применялась",14]]]]],[1,21,340,914,44,13,[[2,16,13,18,18,33],[0,44,12,60,18,"Ошибка.",16],[0,103,12,654,18,"Не выполнен критерий «Проверка 3». Вернитесь к легенде и сверьте результат с этим критерием.",17]]],[1,1,403,954,90,14,[[0,20,22,159,18,"Полученные подсказки",18],[0,40,50,121,18,"Текст подсказки…",4]]]]],[1,1008,370,400,173,6,[[0,21,22,163,20,"Изменения профиля",12],[0,21,59,55,18,"Навык 1",4],[1,275,56,104,24,7,[[0,10,4,86,15,"уровень N → N",8]]],[0,21,95,55,18,"Навык 2",4],[1,228,92,151,24,15,[[0,10,4,132,15,"подтверждение N из 3",19]]],[0,21,131,55,18,"Навык 3",4],[1,264,128,115,24,4,[[0,10,4,96,15,"серия сброшена",20]]]]],[1,1008,563,400,169,6,[[0,21,22,147,20,"Повторить теорию",12],[0,21,56,342,36,"Навыки, по которым проверки не пройдены. Разберите теорию перед следующей попыткой.",21],[2,37,118,16,16,16],[0,61,117,57,18,"Навык 3",7],[2,347,118,16,16,17],[0,37,146,130,18,"Ключевые понятия",22],[0,37,173,150,18,"Текст теории навыка…",23],[0,61,204,102,18,"Пункт теории 1",23],[0,61,226,102,18,"Пункт теории 2",23]]],[1,1008,752,400,179,6,[[0,21,22,116,20,"Рекомендация",12],[0,21,58,299,41,"Дефицит навыка «Навык 3». Рекомендуемый сценарий: «Сценарий N».",24],[1,21,114,358,44,16,[[0,99,13,161,18,"Перейти к назначениям",25]],"StudentHome",0]]],[1,1008,951,400,111,6,[[0,21,22,182,20,"Оценка преподавателя",12],[0,21,52,337,36,"Автоматическая оценка ожидает подтверждения. При корректировке здесь появится причина изменения.",21]]]],0,"Протокол прохождения"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Рис. 41. Протокол прохождения · Report";
screen.x = 7600; screen.y = 1500; screen.clipsContent = true;
results.push({ screen: screen.id, nodes: count });

}
return results;
