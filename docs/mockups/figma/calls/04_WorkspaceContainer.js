const THEME = "light";
const TS = [{"fs":14,"c":["nav-ink",1],"lh":20},{"fs":12,"m":1,"c":["muted",1],"lh":17},{"fs":20,"fw":"SemiBold","c":["text",1],"ls":-0.3,"lh":29},{"fs":12,"fw":"Medium","c":["green-ink",1],"lh":17},{"fs":24,"m":1,"c":["text",1],"lh":35},{"fs":12,"c":["muted",1],"lh":17},{"fs":14,"fw":"Medium","c":["text",1],"lh":20},{"fs":14,"fw":"Medium","c":["on-accent",1],"lh":20},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":15,"c":["text",1],"lh":24,"ml":1},{"fs":15,"c":["text",1],"lh":24},{"fs":12,"fw":"Medium","c":["muted",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":12,"c":["muted",1],"lh":17,"ml":1},{"fs":13,"c":["muted",1],"lh":19,"ml":1},{"fs":14,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":14,"c":["text",1],"lh":23},{"fs":13,"m":1,"c":["term-ink",1],"lh":19},{"fs":13,"c":["term-ink",1],"lh":19},{"fs":14,"m":1,"c":["#86efac",1],"lh":18,"ml":1},{"fs":14,"m":1,"c":["term-ink",1],"lh":18,"ml":1},{"fs":14,"m":1,"c":["#93c5fd",1],"lh":18,"ml":1},{"fs":14,"m":1,"c":["#fdba74",1],"lh":18,"ml":1},{"fs":14,"m":1,"c":["text",1],"lh":18,"ml":1},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23,"ml":1},{"fs":14,"fw":"Bold","c":["text",1],"lh":20},{"fs":14,"c":["text",1],"lh":19},{"fs":12,"fw":"Medium","c":["amber-ink",1],"lh":17}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"f":["green-bg",1],"r":999},{"f":["green-ink",1],"r":999},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999},{"f":["surface",1],"r":20,"sh":1},{"f":["green",1],"s":["green",1],"sw":[1,1,1,1],"r":4},{"f":["red",1],"s":["red",1],"sw":[1,1,1,1],"r":4},{"f":["sunken",1],"s":["field",1],"sw":[1,1,1,1],"r":4},{"s":["label",1],"sw":[1,1,1,1],"r":4},{"s":["line-soft",1],"sw":[1,0,0,0]},{"f":["term",1],"r":20,"sh":1,"c":1},{"f":["term-bar",1]},{"f":["#fca5a5",1],"r":999},{"f":["#fdba74",1],"r":999},{"f":["#86efac",1],"r":999},{"f":["#fb923c",1]},{"f":["amber-bg",1],"r":999}];

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
const old = page.children.find(n => n.name.endsWith("· WorkspaceContainer"));
if (old) old.remove();
build([1,0,0,1440,1098,0,[[1,24,15,154,40,1,[[2,17,12,16,16,10],[0,39,11,99,18,"К назначениям",0]],"StudentHome",0],[0,198,13,309,15,"сессия xxxxxxxx · Домен 1 · сложность N из 5",1],[0,198,30,111,27,"Сценарий 1",2],[1,637,23,108,24,2,[[1,10,9,6,6,3,[]],[0,22,4,77,15,"среда готова",3]]],[2,765,26,18,18,11],[0,791,19,71,32,"ММ:СС",4],[0,869,32,55,15,"из ММ:СС",5],[1,943,13,108,44,4,[[2,21,13,18,18,11],[0,47,13,41,18,"Пауза",6]]],[1,1071,13,285,44,5,[[0,21,13,244,18,"Завершить и отправить на проверку",7]],"Report",0],[1,1376,15,40,40,1,[[2,11,8,18,18,0]],"WorkspaceDark","Переключить тему"],[1,24,78,300,584,6,[[0,21,22,67,20,"Легенда",8],[0,21,62,224,92,"Текст легенды сценария… Описание ситуации, исходного состояния и ожидаемого результата.",9],[0,21,168,188,19,"Текст легенды сценария…",10],[0,21,207,130,15,"Критерии оценивания",11],[1,21,233,16,16,7,[[2,2,2,12,12,12]]],[0,45,232,76,18,"Критерий 1",12],[1,21,262,16,16,7,[[2,2,2,12,12,12]]],[0,45,261,76,18,"Критерий 2",12],[1,21,290,16,16,8,[[2,2,2,12,12,13]]],[0,45,289,76,18,"Критерий 3",12],[1,21,318,16,16,9,[[2,2,2,12,12,14]]],[0,45,317,76,18,"Критерий 4",12],[1,21,347,16,16,10,[]],[0,45,346,76,18,"Критерий 5",12],[1,21,377,258,36,4,[[2,37,9,18,18,15],[0,63,9,160,18,"Проверить выполнение",6]]],[0,21,420,249,32,"Проверено в ЧЧ:ММ:СС: выполнено N из N. Баллы не снимаются.",13],[1,21,470,258,93,11,[[0,0,14,117,15,"Ограничения среды",11],[0,0,36,259,55,"Пользователь без прав администратора · сеть отключена · запись только в рабочий каталог · лимиты профиля среды",14]]]]],[1,24,678,300,396,6,[[0,21,22,56,20,"Теория",8],[0,21,56,258,55,"Справка по навыкам этого сценария. Читать можно в любой момент — баллы за неё не снимаются.",14],[2,37,137,16,16,16],[0,61,136,57,18,"Навык 1",6],[2,247,137,16,16,17],[0,37,165,130,18,"Ключевые понятия",15],[0,37,192,150,18,"Текст теории навыка…",16],[0,61,223,102,18,"Пункт теории 1",16],[0,61,245,102,18,"Пункт теории 2",16],[2,37,298,16,16,16],[0,61,297,57,18,"Навык 2",6],[2,247,298,16,16,18],[2,37,346,16,16,16],[0,61,345,57,18,"Навык 3",6],[2,247,346,16,16,18]]],[1,340,78,740,750,12,[[1,0,0,740,43,13,[[1,20,16,10,10,14,[]],[1,36,16,10,10,15,[]],[1,52,16,10,10,16,[]],[0,74,12,185,17,"student@masso-srv: /srv",17],[1,565,17,8,8,16,[]],[0,581,12,140,17,"WebSocket подключён",18]]],[0,16,59,137,18,"student@masso-srv",19],[0,152,59,9,18,":",20],[0,160,59,33,18,"/srv",21],[0,16,59,249,54,"$ команда\nвывод команды…\nвывод команды…\n",20],[0,16,132,137,18,"student@masso-srv",19],[0,152,132,9,18,":",20],[0,160,132,33,18,"/srv",21],[0,16,132,337,54,"$ команда --параметр\nстрока вывода 1\nстрока вывода 2",20],[0,16,186,257,18,"предупреждение: текст сообщения…",22],[0,16,223,137,18,"student@masso-srv",19],[0,152,223,9,18,":",20],[0,160,223,33,18,"/srv",21],[0,16,223,289,36,"$ команда файл\nсодержимое файла…\n",20],[0,16,277,137,18,"student@masso-srv",19],[0,152,277,9,18,":",20],[0,160,277,33,18,"/srv",21],[0,192,277,17,18,"$ ",20],[1,208,277,8,18,17,[[0,0,0,9,18," ",23]]]],0,"Терминал учебной среды"],[1,1096,78,320,358,6,[[0,21,22,68,43,"Журнал событий",24],[0,142,28,142,32,"обновляется в реальном времени",13],[2,21,93,18,18,19],[0,51,92,71,18,"Инцидент",25],[0,264,94,36,15,"ЧЧ:ММ",1],[0,51,112,219,18,"Текст сообщения об инциденте…",26],[1,21,143,278,65,11,[[2,0,15,18,18,20],[0,30,14,152,18,"Самопроверка: N из N",25],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,141,18,"Баллы не снимаются.",26]]],[1,21,207,278,65,11,[[2,0,15,18,18,20],[0,30,14,92,18,"Среда готова",25],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,147,18,"Учебная среда готова.",26]]],[1,21,272,278,65,11,[[2,0,15,18,18,20],[0,30,14,95,18,"Запуск среды",25],[0,243,16,36,15,"ЧЧ:ММ",1],[0,30,33,192,18,"Подготовка учебной среды…",26]]]]],[1,1096,452,320,191,6,[[0,21,22,84,20,"Подсказки",8],[1,191,21,108,24,18,[[0,10,4,89,15,"осталось 3 из 3",27]]],[0,21,57,279,55,"Каждая подсказка снижает итоговый балл на 10 %. Подсказка указывает область проблемы, но не содержит готовой команды.",14],[1,21,126,278,44,4,[[2,55,13,18,18,21],[0,81,13,144,18,"Запросить подсказку",6]],"HintDialog",0]]]],0,"Рабочая область — терминал"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Рис. 38. Рабочая область: сценарий с учебным сервером · WorkspaceContainer";
screen.x = 1520; screen.y = 1500; screen.clipsContent = true;
return { screen: screen.id, nodes: count };
