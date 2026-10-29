const THEME = "light";
const TS = [{"fs":15,"fw":"SemiBold","c":["text",1],"ls":0.6,"lh":22},{"fs":14,"c":["label",1],"lh":20},{"fs":14,"c":["on-nav",1],"lh":20},{"fs":12,"fw":"SemiBold","c":["amber-ink",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":28,"fw":"SemiBold","c":["text",1],"ls":-0.42,"lh":35},{"fs":14,"c":["muted",1],"lh":20},{"fs":12,"fw":"Medium","c":["muted",1],"lh":17},{"fs":14,"c":["accent",1],"lh":20},{"fs":14,"m":1,"c":["text",1],"lh":20},{"fs":12,"fw":"Medium","c":["green-ink",1],"lh":17},{"fs":12,"fw":"Medium","c":["red-ink",1],"lh":17},{"fs":12,"fw":"Medium","c":["amber-ink",1],"lh":17}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"r":999},{"f":["nav",1],"r":999},{"f":["amber-bg",1],"r":999},{"f":["surface",1],"r":20,"sh":1},{"s":["line",1],"sw":[0,0,1,0]},{"s":["line-soft",1],"sw":[0,0,1,0]},{},{"f":["green-bg",1],"r":999},{"f":["red-bg",1],"r":999}];

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
const old = page.children.find(n => n.name.endsWith("· StudentReports"));
if (old) old.remove();
build([1,0,0,1440,900,0,[[1,24,12,1126,46,1,[[2,11,8,30,30,3],[0,49,13,57,19,"МАССО",0],[1,121,5,163,36,2,[[2,16,10,17,17,28],[0,41,9,107,18,"Мои назначения",1]],"StudentHome",0],[1,288,5,132,36,3,[[2,16,10,17,17,29],[0,41,9,76,18,"Протоколы",2]],"StudentReports",0],[1,424,5,136,36,2,[[2,16,10,17,17,6],[0,41,9,80,18,"Мои навыки",1]],"StudentSkills",0]],0,"Основное меню"],[1,1162,15,40,40,1,[[2,11,8,18,18,0]],0,"Переключить тему (в макете — тумблер dark в Tweaks)"],[1,1214,14,202,42,1,[[1,5,5,32,32,4,[[0,8,8,17,15,"О1",3]]],[0,49,12,105,18,"Обучающийся 1",4],[1,165,5,32,32,2,[[2,8,8,17,17,7]],"Main","Выйти"]]],[0,32,93,152,37,"Протоколы",5],[0,32,134,242,18,"Результаты завершённых сценариев",6],[1,32,177,1376,310,5,[[1,1,1,275,38,6,[[0,12,11,58,15,"Сценарий",7]]],[1,276,1,286,38,6,[[0,12,11,80,15,"Направление",7]]],[1,563,1,334,38,6,[[0,12,11,30,15,"Дата",7]]],[1,897,1,306,38,6,[[0,12,11,59,15,"Результат",7]]],[1,1203,1,173,38,6,[[0,12,11,30,15,"Балл",7]]],[1,1,39,275,45,7,[[1,12,13,75,18,8,[[0,0,0,76,18,"Сценарий 1",8]],"Report",0]]],[1,276,39,286,45,7,[[0,12,13,56,18,"Домен 1",4]]],[1,563,39,334,45,7,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",9]]],[1,897,39,306,45,7,[[1,12,11,69,24,9,[[0,10,4,50,15,"пройден",10]]]]],[1,1203,39,173,45,7,[[1,12,11,38,24,9,[[0,10,4,19,15,"NN",10]]]]],[1,1,84,275,45,7,[[1,12,13,75,18,8,[[0,0,0,76,18,"Сценарий 2",8]],"Report",0]]],[1,276,84,286,45,7,[[0,12,13,56,18,"Домен 2",4]]],[1,563,84,334,45,7,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",9]]],[1,897,84,306,45,7,[[1,12,11,69,24,9,[[0,10,4,50,15,"пройден",10]]]]],[1,1203,84,173,45,7,[[1,12,11,38,24,9,[[0,10,4,19,15,"NN",10]]]]],[1,1,129,275,45,7,[[1,12,13,75,18,8,[[0,0,0,76,18,"Сценарий 3",8]],"Report",0]]],[1,276,129,286,45,7,[[0,12,13,56,18,"Домен 1",4]]],[1,563,129,334,45,7,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",9]]],[1,897,129,306,45,7,[[1,12,11,86,24,10,[[0,10,4,67,15,"не пройден",11]]]]],[1,1203,129,173,45,7,[[1,12,11,38,24,4,[[0,10,4,19,15,"NN",12]]]]],[1,1,174,275,45,7,[[1,12,13,75,18,8,[[0,0,0,76,18,"Сценарий 4",8]],"Report",0]]],[1,276,174,286,45,7,[[0,12,13,56,18,"Домен 2",4]]],[1,563,174,334,45,7,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",9]]],[1,897,174,306,45,7,[[1,12,11,86,24,10,[[0,10,4,67,15,"не пройден",11]]]]],[1,1203,174,173,45,7,[[1,12,11,38,24,10,[[0,10,4,19,15,"NN",11]]]]],[1,1,219,275,45,7,[[1,12,13,75,18,8,[[0,0,0,76,18,"Сценарий 5",8]],"Report",0]]],[1,276,219,286,45,7,[[0,12,13,56,18,"Домен 1",4]]],[1,563,219,334,45,7,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",9]]],[1,897,219,306,45,7,[[1,12,11,69,24,9,[[0,10,4,50,15,"пройден",10]]]]],[1,1203,219,173,45,7,[[1,12,11,38,24,9,[[0,10,4,19,15,"NN",10]]]]],[1,1,264,275,45,7,[[1,12,13,75,18,8,[[0,0,0,76,18,"Сценарий 6",8]],"Report",0]]],[1,276,264,286,45,7,[[0,12,13,56,18,"Домен 2",4]]],[1,563,264,334,45,7,[[0,12,13,97,18,"ДД.ММ, ЧЧ:ММ",9]]],[1,897,264,306,45,7,[[1,12,11,69,24,9,[[0,10,4,50,15,"пройден",10]]]]],[1,1203,264,173,45,7,[[1,12,11,38,24,9,[[0,10,4,19,15,"NN",10]]]]]]]],0,"Протоколы"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Протоколы обучающегося · StudentReports";
screen.x = 9120; screen.y = 1500; screen.clipsContent = true;
return { screen: screen.id, nodes: count };
