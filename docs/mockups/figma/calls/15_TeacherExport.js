const THEME = "light";
const TS = [{"fs":15,"fw":"SemiBold","c":["text",1],"ls":0.6,"lh":22},{"fs":14,"c":["label",1],"lh":20},{"fs":14,"c":["on-nav",1],"lh":20},{"fs":12,"fw":"SemiBold","c":["amber-ink",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":28,"fw":"SemiBold","c":["text",1],"ls":-0.42,"lh":35},{"fs":14,"c":["muted",1],"lh":20},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":14,"c":["red-ink",1],"lh":20},{"fs":14,"c":["text",1]},{"fs":14,"c":["green-ink",1],"lh":20},{"fs":14,"fw":"Medium","c":["on-accent",1],"lh":20}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"r":999},{"f":["nav",1],"r":999},{"f":["amber-bg",1],"r":999},{"f":["surface",1],"r":20,"sh":1},{"f":["surface",1],"s":["field",1],"sw":[1,1,1,1],"r":12},{"f":["green-bg",1],"r":16},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999}];

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
const old = page.children.find(n => n.name.endsWith("· TeacherExport"));
if (old) old.remove();
build([1,0,0,1440,900,0,[[1,24,12,1117,46,1,[[2,11,8,30,30,3],[0,49,13,57,19,"МАССО",0],[1,121,5,104,36,2,[[2,16,10,17,17,63],[0,41,9,48,18,"Группы",1]],"TeacherGroup",0],[1,229,5,135,36,2,[[2,16,10,17,17,59],[0,41,9,79,18,"Назначения",1]],"TeacherAssignments",0],[1,368,5,169,36,3,[[2,16,10,17,17,66],[0,41,9,113,18,"Экспорт отчётов",2]],"TeacherExport",0]],0,"Основное меню"],[1,1153,15,40,40,1,[[2,11,8,18,18,0]],0,"Переключить тему (в макете — тумблер dark в Tweaks)"],[1,1205,14,211,42,1,[[1,5,5,32,32,4,[[0,9,8,16,15,"П1",3]]],[0,49,12,114,18,"Преподаватель 1",4],[1,174,5,32,32,2,[[2,8,8,17,17,7]],"Main","Выйти"]]],[0,32,93,222,37,"Экспорт отчётов",5],[0,32,134,265,18,"Выгрузка результатов группы за период",6],[1,32,177,768,425,5,[[0,21,22,147,20,"Параметры отчёта",7],[0,21,73,48,18,"Группа",1],[0,68,73,7,18,"*",8],[1,268,60,479,44,6,[[0,14,13,451,18,"Группа 1",9]],0,"select.in"],[0,21,133,83,18,"Дата начала",1],[0,103,133,7,18,"*",8],[1,268,120,479,44,6,[[0,14,13,451,18,"ДД.ММ.ГГГГ",9]],0,"input.in"],[2,717,132,18,18,62],[0,21,193,108,18,"Дата окончания",1],[0,128,193,7,18,"*",8],[1,268,180,479,44,6,[[0,14,13,451,18,"ДД.ММ.ГГГГ",9]],0,"input.in"],[2,717,192,18,18,62],[0,21,253,53,18,"Формат",1],[1,268,240,479,44,6,[[0,14,13,451,18,"CSV (Excel, разделитель «;»)",9]],0,"select.in"],[1,21,300,726,44,7,[[2,16,13,18,18,65],[0,44,12,215,18,"Отчёт сформирован и загружен.",10]]],[1,578,360,169,44,8,[[2,21,13,18,18,67],[0,47,13,102,18,"Сформировать",11]]]]]],0,"Экспорт отчётов"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Экспорт отчётов · TeacherExport";
screen.x = 4560; screen.y = 3487; screen.clipsContent = true;
return { screen: screen.id, nodes: count };
