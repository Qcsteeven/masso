const THEME = "light";
const TS = [{"fs":15,"fw":"SemiBold","c":["text",1],"ls":0.6,"lh":22},{"fs":14,"c":["label",1],"lh":20},{"fs":14,"c":["on-nav",1],"lh":20},{"fs":12,"fw":"SemiBold","c":["amber-ink",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":28,"fw":"SemiBold","c":["text",1],"ls":-0.42,"lh":35},{"fs":14,"c":["muted",1],"lh":20},{"fs":12,"fw":"Medium","c":["label",1],"lh":17},{"fs":14,"c":["text",1]},{"fs":14,"fw":"Medium","c":["on-accent",1],"lh":20},{"fs":12,"fw":"Medium","c":["muted",1],"lh":17},{"fs":14,"fw":"Medium","c":["accent",1],"lh":20},{"fs":12,"m":1,"c":["muted",1],"lh":17},{"fs":12,"fw":"Medium","c":["amber-ink",1],"lh":17},{"fs":12,"fw":"Medium","c":["green-ink",1],"lh":17},{"fs":14,"m":1,"c":["text",1],"lh":20}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"r":999},{"f":["nav",1],"r":999},{"f":["amber-bg",1],"r":999},{"f":["surface",1],"s":["field",1],"sw":[1,1,1,1],"r":12},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999},{"f":["surface",1],"r":20,"sh":1},{"s":["line",1],"sw":[0,0,1,0]},{"s":["line-soft",1],"sw":[0,0,1,0]},{},{"f":["green-bg",1],"r":999},{"f":["sunken",1],"r":999}];

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
const old = page.children.find(n => n.name.endsWith("· Templates"));
if (old) old.remove();
build([1,0,0,1440,900,0,[[1,24,12,1126,46,1,[[2,11,8,30,30,3],[0,49,13,57,19,"МАССО",0],[1,121,5,181,36,2,[[2,16,10,17,17,6],[0,41,9,125,18,"Граф компетенций",1]],"SkillGraph",0],[1,306,5,192,36,3,[[2,16,10,17,17,64],[0,41,9,136,18,"Шаблоны сценариев",2]],"Templates",0],[1,502,5,167,36,2,[[2,16,10,17,17,68],[0,41,9,111,18,"Целевые уровни",1]],"Targets",0]],0,"Основное меню"],[1,1162,15,40,40,1,[[2,11,8,18,18,0]],0,"Переключить тему (в макете — тумблер dark в Tweaks)"],[1,1214,14,202,42,1,[[1,5,5,32,32,4,[[0,9,8,16,15,"П1",3]]],[0,49,12,105,18,"Пользователь 1",4],[1,165,5,32,32,2,[[2,8,8,17,17,7]],"Main","Выйти"]]],[0,32,101,279,37,"Шаблоны сценариев",5],[0,32,142,407,18,"Спецификации сценариев, валидация прогоном и публикация",6],[0,1126,95,80,15,"Направление",7],[1,1126,117,165,44,5,[[0,14,13,137,18,"Все направления",8]],0,"select.in"],[1,1301,117,107,44,6,[[0,21,13,66,18,"+ Шаблон",9]]],[1,32,185,1376,393,7,[[1,1,1,151,38,8,[[0,12,11,48,15,"Шаблон",10]]],[1,152,1,165,38,8,[[0,12,11,80,15,"Направление",10]]],[1,317,1,292,38,8,[[0,12,11,48,15,"Движок",10]]],[1,609,1,106,38,8,[[0,12,11,43,15,"Версия",10]]],[1,714,1,141,38,8,[[0,12,11,65,15,"Сложность",10]]],[1,856,1,192,38,8,[[0,12,11,40,15,"Статус",10]]],[1,1048,1,160,38,8,[[0,12,11,65,15,"Валидация",10]]],[1,1208,1,167,38,8,[[0,12,11,79,15,"Опубликован",10]]],[1,1,39,151,59,9,[[1,12,12,65,18,10,[[0,0,0,66,18,"Шаблон 1",11]],"TemplateEditor",0],[0,12,32,71,15,"template_1",12]]],[1,152,39,165,59,9,[[0,12,20,56,18,"Домен 1",4]]],[1,317,39,292,59,9,[[0,12,20,95,18,"учебная среда",4]]],[1,609,39,106,59,9,[[0,12,20,18,18,"vN",4]]],[1,714,39,141,59,9,[[0,12,20,40,18,"N из 5",4]]],[1,856,39,192,59,9,[[1,12,17,76,24,4,[[0,10,4,57,15,"черновик",13]]]]],[1,1048,39,160,59,9,[[1,12,17,76,24,11,[[0,10,4,57,15,"пройдена",14]]]]],[1,1208,39,167,59,9,[[0,12,20,9,18,"—",15]]],[1,1,98,151,59,9,[[1,12,12,65,18,10,[[0,0,0,66,18,"Шаблон 2",11]],"TemplateEditor",0],[0,12,32,71,15,"template_2",12]]],[1,152,98,165,59,9,[[0,12,20,56,18,"Домен 1",4]]],[1,317,98,292,59,9,[[0,12,20,95,18,"учебная среда",4]]],[1,609,98,106,59,9,[[0,12,20,18,18,"vN",4]]],[1,714,98,141,59,9,[[0,12,20,40,18,"N из 5",4]]],[1,856,98,192,59,9,[[1,12,17,96,24,11,[[0,10,4,77,15,"опубликован",14]]]]],[1,1048,98,160,59,9,[[1,12,17,76,24,11,[[0,10,4,57,15,"пройдена",14]]]]],[1,1208,98,167,59,9,[[0,12,20,81,18,"ДД.ММ.ГГГГ",15]]],[1,1,156,151,59,9,[[1,12,12,65,18,10,[[0,0,0,66,18,"Шаблон 3",11]],"TemplateEditor",0],[0,12,32,71,15,"template_3",12]]],[1,152,156,165,59,9,[[0,12,20,56,18,"Домен 2",4]]],[1,317,156,292,59,9,[[0,12,20,159,18,"документный тренажёр",4]]],[1,609,156,106,59,9,[[0,12,20,18,18,"vN",4]]],[1,714,156,141,59,9,[[0,12,20,40,18,"N из 5",4]]],[1,856,156,192,59,9,[[1,12,17,96,24,11,[[0,10,4,77,15,"опубликован",14]]]]],[1,1048,156,160,59,9,[[1,12,17,76,24,11,[[0,10,4,57,15,"пройдена",14]]]]],[1,1208,156,167,59,9,[[0,12,20,81,18,"ДД.ММ.ГГГГ",15]]],[1,1,215,151,59,9,[[1,12,12,65,18,10,[[0,0,0,66,18,"Шаблон 4",11]],"TemplateEditor",0],[0,12,32,71,15,"template_4",12]]],[1,152,215,165,59,9,[[0,12,20,56,18,"Домен 3",4]]],[1,317,215,292,59,9,[[0,12,20,90,18,"задача на код",4]]],[1,609,215,106,59,9,[[0,12,20,18,18,"vN",4]]],[1,714,215,141,59,9,[[0,12,20,40,18,"N из 5",4]]],[1,856,215,192,59,9,[[1,12,17,96,24,11,[[0,10,4,77,15,"опубликован",14]]]]],[1,1048,215,160,59,9,[[1,12,17,76,24,11,[[0,10,4,57,15,"пройдена",14]]]]],[1,1208,215,167,59,9,[[0,12,20,81,18,"ДД.ММ.ГГГГ",15]]],[1,1,274,151,59,9,[[1,12,12,65,18,10,[[0,0,0,66,18,"Шаблон 5",11]],"TemplateEditor",0],[0,12,32,71,15,"template_5",12]]],[1,152,274,165,59,9,[[0,12,20,56,18,"Домен 2",4]]],[1,317,274,292,59,9,[[0,12,20,159,18,"документный тренажёр",4]]],[1,609,274,106,59,9,[[0,12,20,18,18,"vN",4]]],[1,714,274,141,59,9,[[0,12,20,40,18,"N из 5",4]]],[1,856,274,192,59,9,[[1,12,17,76,24,4,[[0,10,4,57,15,"черновик",13]]]]],[1,1048,274,160,59,9,[[1,12,17,40,24,12,[[0,10,4,21,15,"нет",7]]]]],[1,1208,274,167,59,9,[[0,12,20,9,18,"—",15]]],[1,1,332,151,59,9,[[1,12,12,65,18,10,[[0,0,0,66,18,"Шаблон 6",11]],"TemplateEditor",0],[0,12,32,71,15,"template_6",12]]],[1,152,332,165,59,9,[[0,12,20,56,18,"Домен 1",4]]],[1,317,332,292,59,9,[[0,12,20,95,18,"учебная среда",4]]],[1,609,332,106,59,9,[[0,12,20,18,18,"vN",4]]],[1,714,332,141,59,9,[[0,12,20,40,18,"N из 5",4]]],[1,856,332,192,59,9,[[1,12,17,71,24,12,[[0,10,4,52,15,"в архиве",7]]]]],[1,1048,332,160,59,9,[[1,12,17,76,24,11,[[0,10,4,57,15,"пройдена",14]]]]],[1,1208,332,167,59,9,[[0,12,20,81,18,"ДД.ММ.ГГГГ",15]]]]]],0,"Шаблоны сценариев"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Шаблоны сценариев · Templates";
screen.x = 3040; screen.y = 4871; screen.clipsContent = true;
return { screen: screen.id, nodes: count };
