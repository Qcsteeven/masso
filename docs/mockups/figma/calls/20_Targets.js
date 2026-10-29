const THEME = "light";
const TS = [{"fs":15,"fw":"SemiBold","c":["text",1],"ls":0.6,"lh":22},{"fs":14,"c":["label",1],"lh":20},{"fs":14,"c":["on-nav",1],"lh":20},{"fs":12,"fw":"SemiBold","c":["amber-ink",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":28,"fw":"SemiBold","c":["text",1],"ls":-0.42,"lh":35},{"fs":14,"c":["muted",1],"lh":20},{"fs":12,"fw":"Medium","c":["label",1],"lh":17},{"fs":14,"c":["text",1]},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":14,"fw":"Medium","c":["on-accent",1],"lh":20},{"fs":14,"c":["green-ink",1],"lh":20},{"fs":12,"fw":"Medium","c":["muted",1],"lh":17},{"fs":12,"m":1,"c":["text",1],"lh":17},{"fs":14,"c":["muted",1]}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"r":999},{"f":["nav",1],"r":999},{"f":["amber-bg",1],"r":999},{"f":["surface",1],"s":["field",1],"sw":[1,1,1,1],"r":12},{"f":["surface",1],"r":20,"sh":1},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999},{"f":["green-bg",1],"r":16},{"s":["line",1],"sw":[0,0,1,0]},{"s":["line-soft",1],"sw":[0,0,1,0]}];

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
const old = page.children.find(n => n.name.endsWith("· Targets"));
if (old) old.remove();
build([1,0,0,1440,905,0,[[1,24,12,1126,46,1,[[2,11,8,30,30,3],[0,49,13,57,19,"МАССО",0],[1,121,5,181,36,2,[[2,16,10,17,17,6],[0,41,9,125,18,"Граф компетенций",1]],"SkillGraph",0],[1,306,5,192,36,2,[[2,16,10,17,17,59],[0,41,9,136,18,"Шаблоны сценариев",1]],"Templates",0],[1,502,5,167,36,3,[[2,16,10,17,17,72],[0,41,9,111,18,"Целевые уровни",2]],"Targets",0]],0,"Основное меню"],[1,1162,15,40,40,1,[[2,11,8,18,18,0]],0,"Переключить тему (в макете — тумблер dark в Tweaks)"],[1,1214,14,202,42,1,[[1,5,5,32,32,4,[[0,9,8,16,15,"П1",3]]],[0,49,12,105,18,"Пользователь 1",4],[1,165,5,32,32,2,[[2,8,8,17,17,7]],"Main","Выйти"]]],[0,32,101,225,37,"Целевые уровни",5],[0,32,142,383,18,"Требуемый уровень навыков по направлению подготовки",6],[0,1302,95,80,15,"Направление",7],[1,1302,117,106,44,5,[[0,14,13,78,18,"Домен 1",8]],0,"select.in"],[1,32,185,1376,680,6,[[0,21,32,171,20,"Навыки направления",9],[1,1242,21,113,44,7,[[0,21,13,72,18,"Сохранить",10]]],[1,21,77,1334,44,8,[[2,16,13,18,18,65],[0,44,12,375,18,"Целевые уровни сохранены и записаны в журнал аудита.",11]]],[1,1,121,351,38,9,[[0,12,11,23,15,"Код",12]]],[1,352,121,375,38,9,[[0,12,11,40,15,"Навык",12]]],[1,727,121,472,38,9,[[0,12,11,75,15,"Уровень max",12]]],[1,1199,121,176,38,9,[[0,12,11,116,15,"Требуемый уровень",12]]],[1,1,158,351,65,10,[[0,12,25,50,15,"SKILL.1",13]]],[1,352,158,375,65,10,[[0,12,23,55,18,"Навык 1",4]]],[1,727,158,472,65,10,[[0,12,23,11,18,"N",4]]],[1,1199,158,176,65,10,[[1,12,11,152,44,5,[[0,14,13,124,18,"N",8]],0,"Требуемый уровень: Навык 1"]]],[1,1,223,351,65,10,[[0,12,25,50,15,"SKILL.2",13]]],[1,352,223,375,65,10,[[0,12,23,55,18,"Навык 2",4]]],[1,727,223,472,65,10,[[0,12,23,11,18,"N",4]]],[1,1199,223,176,65,10,[[1,12,11,152,44,5,[[0,14,13,124,18,"N",8]],0,"Требуемый уровень: Навык 2"]]],[1,1,288,351,65,10,[[0,12,25,50,15,"SKILL.3",13]]],[1,352,288,375,65,10,[[0,12,23,55,18,"Навык 3",4]]],[1,727,288,472,65,10,[[0,12,23,11,18,"N",4]]],[1,1199,288,176,65,10,[[1,12,11,152,44,5,[[0,14,13,124,18,"N",8]],0,"Требуемый уровень: Навык 3"]]],[1,1,353,351,65,10,[[0,12,25,50,15,"SKILL.4",13]]],[1,352,353,375,65,10,[[0,12,23,55,18,"Навык 4",4]]],[1,727,353,472,65,10,[[0,12,23,11,18,"N",4]]],[1,1199,353,176,65,10,[[1,12,11,152,44,5,[[0,14,13,124,18,"N",8]],0,"Требуемый уровень: Навык 4"]]],[1,1,418,351,65,10,[[0,12,25,50,15,"SKILL.5",13]]],[1,352,418,375,65,10,[[0,12,23,55,18,"Навык 5",4]]],[1,727,418,472,65,10,[[0,12,23,11,18,"N",4]]],[1,1199,418,176,65,10,[[1,12,11,152,44,5,[[0,14,13,124,18,"не задан",14]],0,"Требуемый уровень: Навык 5"]]],[1,1,483,351,65,10,[[0,12,25,50,15,"SKILL.6",13]]],[1,352,483,375,65,10,[[0,12,23,55,18,"Навык 6",4]]],[1,727,483,472,65,10,[[0,12,23,11,18,"N",4]]],[1,1199,483,176,65,10,[[1,12,11,152,44,5,[[0,14,13,124,18,"N",8]],0,"Требуемый уровень: Навык 6"]]],[1,1,548,351,65,10,[[0,12,25,50,15,"SKILL.7",13]]],[1,352,548,375,65,10,[[0,12,23,55,18,"Навык 7",4]]],[1,727,548,472,65,10,[[0,12,23,11,18,"N",4]]],[1,1199,548,176,65,10,[[1,12,11,152,44,5,[[0,14,13,124,18,"не задан",14]],0,"Требуемый уровень: Навык 7"]]],[1,1,613,351,65,10,[[0,12,25,50,15,"SKILL.8",13]]],[1,352,613,375,65,10,[[0,12,23,55,18,"Навык 8",4]]],[1,727,613,472,65,10,[[0,12,23,11,18,"N",4]]],[1,1199,613,176,65,10,[[1,12,11,152,44,5,[[0,14,13,124,18,"N",8]],0,"Требуемый уровень: Навык 8"]]]]]],0,"Целевые уровни"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Рис. 47. Целевые уровни направления · Targets";
screen.x = 6080; screen.y = 4871; screen.clipsContent = true;
return { screen: screen.id, nodes: count };
