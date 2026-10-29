const THEME = "light";
const TS = [{"fs":22,"fw":"SemiBold","c":["text",1],"ls":0.88,"lh":32},{"fs":13,"c":["muted",1],"lh":19},{"fs":44,"fw":"SemiBold","c":["text",1],"ls":-0.88,"lh":49},{"fs":44,"fw":"SemiBold","c":["accent",1],"ls":-0.88,"lh":49},{"fs":16,"c":["muted",1],"lh":26,"ml":1},{"fs":26,"fw":"SemiBold","c":["text",1],"ls":-0.39,"lh":38},{"fs":14,"c":["muted",1],"lh":20,"ml":1},{"fs":14,"c":["label",1],"lh":20},{"fs":14,"c":["text",1]},{"fs":16,"fw":"Medium","c":["on-accent",1],"lh":23},{"fs":14,"fw":"SemiBold","c":["text",1],"lh":20},{"fs":14,"fw":"Medium","c":["text",1],"lh":20},{"fs":13,"c":["muted",1],"lh":19,"ml":1}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"f":["surface",1],"r":28,"sh":1},{"f":["surface",1],"s":["field",1],"sw":[1,1,1,1],"r":12},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999},{"s":["line",1],"sw":[1,0,0,0]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999}];

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
const old = page.children.find(n => n.name.endsWith("· Main"));
if (old) old.remove();
build([1,0,0,1440,900,0,[[1,1376,24,40,40,1,[[2,11,8,18,18,0]],0,"Переключить тему (в макете — тумблер dark в Tweaks)"],[2,64,59,44,44,1],[0,122,57,82,29,"МАССО",0],[0,122,88,146,17,"учебная диспетчерская",1],[0,64,249,330,57,"Сценарий — как",2],[0,64,298,260,57,"назначение.",2],[0,64,347,253,57,"Среда — как",2],[0,64,396,302,57,"рабочее место",3],[0,365,396,14,57,".",2],[0,64,446,245,57,"Отчёт — как",2],[0,64,495,205,57,"протокол.",2],[0,64,571,391,124,"Мультиагентная система ситуативного обучения: индивидуальные кейсы под профиль компетенций, изолированная учебная среда, динамические инциденты и автоматическая проверка результата.",4],[1,740,145,480,611,2,[[0,41,42,189,34,"Вход в систему",5],[0,41,86,384,38,"Используйте учётную запись, выданную образовательной организацией.",6],[0,41,158,36,18,"Email",7],[1,176,145,263,44,3,[[0,14,13,235,18,"user@example.org",8]],0,"input.in"],[0,41,222,49,18,"Пароль",7],[1,176,209,263,44,3,[[0,14,13,235,18,"••••••••",8]],0,"input.in"],[1,41,273,398,48,4,[[0,175,13,49,20,"Войти",9]],"StudentHome",0],[2,41,352,16,16,2],[0,67,341,320,17,"Пароль проверяется на сервере; сессия хранится в",1],[0,67,360,128,17,"защищённой cookie.",1],[1,41,399,398,171,5,[[0,0,18,164,18,"Демо-версия: войти как",10],[1,0,45,129,36,6,[[0,17,9,96,18,"Обучающийся",11]],"StudentHome",0],[1,137,45,140,36,6,[[0,17,9,107,18,"Преподаватель",11]],"TeacherGroup",0],[1,285,45,99,36,6,[[0,17,9,66,18,"Методист",11]],"SkillGraph",0],[1,0,89,139,36,6,[[0,17,9,106,18,"Администратор",11]],"AdminUsers",0],[1,147,89,101,36,6,[[0,17,9,68,18,"Сисадмин",11]],"SysHealth",0],[0,0,133,370,36,"В макете кнопка сразу открывает рабочее место выбранной роли.",12]]]]]],0,"вход"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Рис. 36. Вход в систему · Main";
screen.x = 0; screen.y = 240; screen.clipsContent = true;
return { screen: screen.id, nodes: count };
