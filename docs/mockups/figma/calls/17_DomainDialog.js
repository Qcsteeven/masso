const THEME = "light";
const TS = [{"fs":15,"fw":"SemiBold","c":["text",1],"ls":0.6,"lh":22},{"fs":14,"c":["on-nav",1],"lh":20},{"fs":14,"c":["label",1],"lh":20},{"fs":12,"fw":"SemiBold","c":["amber-ink",1],"lh":17},{"fs":14,"c":["text",1],"lh":20},{"fs":28,"fw":"SemiBold","c":["text",1],"ls":-0.42,"lh":35},{"fs":14,"c":["muted",1],"lh":20},{"fs":14,"fw":"Medium","c":["text",1],"lh":20},{"fs":14,"fw":"Medium","c":["on-accent",1],"lh":20},{"fs":16,"fw":"SemiBold","c":["text",1],"lh":23},{"fs":14,"fw":"SemiBold","c":["blue-ink",1],"lh":20},{"fs":12,"fw":"SemiBold","m":1,"c":["blue-ink",1],"lh":17},{"fs":12,"m":1,"c":["text",1],"lh":17},{"fs":14,"c":["green-ink",1],"lh":20,"ml":1},{"fs":11,"m":1,"c":["muted",1],"lh":16},{"fs":13,"fw":"SemiBold","c":["text",1],"lh":16},{"fs":11,"fw":"Medium","c":["red-ink",1],"lh":16},{"fs":11,"fw":"Medium","c":["amber-ink",1],"lh":16},{"fs":12,"m":1,"c":["amber-ink",1],"lh":20},{"fs":14,"c":["red-ink",1],"lh":20},{"fs":14,"c":["text",1]},{"fs":12,"fw":"Medium","c":["muted",1],"lh":17},{"fs":12,"c":["text",1],"m":1},{"fs":12,"fw":"SemiBold","c":["muted",1],"lh":17},{"fs":14,"c":["text",1],"m":1},{"fs":18,"fw":"SemiBold","c":["text",1],"lh":26},{"fs":14,"c":["muted",1],"lh":20,"ml":1},{"fs":12,"c":["muted",1],"lh":17,"ml":1}];
const BS = [{"f":["bg",1]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999,"sh":1},{"f":["nav",1],"r":999},{"r":999},{"f":["amber-bg",1],"r":999},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":999},{"f":["accent",1],"s":["accent",1],"sw":[1,1,1,1],"r":999},{"f":["surface",1],"r":20,"sh":1},{"f":["blue-bg",1],"r":12},{"r":12},{"f":["green-bg",1],"r":16},{"f":["surface",1],"r":20,"sh":1,"c":1},{"s":["line",1],"sw":[0,0,1,0]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":16,"sh":1},{"f":["red-bg",1],"r":999},{"f":["surface",1],"s":["accent",1],"sw":[2,2,2,2],"r":16,"sh":1},{"f":["surface",1]},{"f":["surface",1],"s":["field",1],"sw":[1,1,1,1],"r":12},{"f":["surface",1],"s":["field",1],"sw":[1,1,1,1],"r":12,"c":1},{"s":["line-soft",1],"sw":[1,0,0,0]},{"f":["#000000",0.4]},{"f":["surface",1],"s":["line",1],"sw":[1,1,1,1],"r":20,"sh":1}];

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
const old = page.children.find(n => n.name.endsWith("· DomainDialog"));
if (old) old.remove();
build([1,0,0,1440,1131,0,[[1,24,12,1126,46,1,[[2,11,8,30,30,3],[0,49,13,57,19,"МАССО",0],[1,121,5,181,36,2,[[2,16,10,17,17,34],[0,41,9,125,18,"Граф компетенций",1]],"SkillGraph",0],[1,306,5,192,36,3,[[2,16,10,17,17,59],[0,41,9,136,18,"Шаблоны сценариев",2]],"Templates",0],[1,502,5,167,36,3,[[2,16,10,17,17,68],[0,41,9,111,18,"Целевые уровни",2]],"Targets",0]],0,"Основное меню"],[1,1162,15,40,40,1,[[2,11,8,18,18,0]],0,"Переключить тему (в макете — тумблер dark в Tweaks)"],[1,1214,14,202,42,1,[[1,5,5,32,32,4,[[0,9,8,16,15,"П1",3]]],[0,49,12,105,18,"Пользователь 1",4],[1,165,5,32,32,3,[[2,8,8,17,17,7]],"Main","Выйти"]]],[0,32,93,253,37,"Граф компетенций",5],[0,32,134,427,18,"Навыки, prerequisite-связи и веса · граф остаётся ациклическим",6],[1,972,109,195,44,5,[[2,21,13,18,18,69],[0,47,13,128,18,"Импорт CSV / JSON",7]]],[1,1177,109,123,44,5,[[2,21,13,18,18,30],[0,47,13,56,18,"Экспорт",7]]],[1,1310,109,98,44,6,[[0,21,13,57,18,"+ Навык",8]]],[1,32,177,230,453,7,[[0,21,28,66,20,"Домены",9],[1,104,21,105,36,5,[[2,17,9,18,18,70],[0,43,9,46,18,"Домен",7]],"DomainDialog",0],[1,21,69,188,40,8,[[0,12,11,57,18,"Домен 1",10],[0,162,12,15,15,"NN",11]],"SkillGraph",0],[1,21,113,188,40,9,[[0,12,11,56,18,"Домен 2",4],[0,162,12,15,15,"NN",12]],"SkillGraph",0],[1,21,157,188,40,9,[[0,12,11,56,18,"Домен 3",4],[0,162,12,15,15,"NN",12]],"SkillGraph",0],[1,21,201,188,40,9,[[0,12,11,56,18,"Домен 4",4],[0,162,12,15,15,"NN",12]],"SkillGraph",0],[1,21,245,188,40,9,[[0,12,11,56,18,"Домен 5",4],[0,162,12,15,15,"NN",12]],"SkillGraph",0],[1,21,293,188,36,3,[[0,38,9,113,18,"Изменить домен",7]],"DomainDialog",0],[1,21,349,188,83,10,[[2,16,13,18,18,65],[0,44,12,108,57,"Циклов нет · NN навыков, NN связей",13]]]]],[1,282,177,766,663,11,[[1,1,1,764,61,12,[[0,20,19,67,20,"Домен 1",9],[1,535,12,42,36,5,[[0,17,9,9,18,"−",7]],0,"Уменьшить"],[1,585,12,42,36,5,[[0,17,9,9,18,"+",7]],0,"Увеличить"],[1,635,12,109,36,5,[[0,17,9,76,18,"Выровнять",7]]]]],[2,1,62,764,600,71],[1,279,106,200,82,13,[[0,15,11,50,14,"SKILL.1",14],[0,15,26,53,17,"Навык 1",15],[1,15,49,91,20,14,[[0,10,2,72,14,"N зависимых",16]]]]],[1,49,246,200,56,13,[[0,15,11,50,14,"SKILL.2",14],[0,15,26,53,17,"Навык 2",15]]],[1,279,246,200,82,13,[[0,15,11,50,14,"SKILL.3",14],[0,15,26,53,17,"Навык 3",15],[1,15,49,91,20,14,[[0,10,2,72,14,"N зависимых",16]]]]],[1,509,246,200,56,15,[[0,16,12,50,14,"SKILL.4",14],[0,16,27,53,17,"Навык 4",15]]],[1,49,386,200,56,13,[[0,15,11,50,14,"SKILL.5",14],[0,15,26,53,17,"Навык 5",15]]],[1,279,386,200,82,13,[[0,15,11,50,14,"SKILL.6",14],[0,15,26,53,17,"Навык 6",15],[1,15,49,71,20,4,[[0,10,2,52,14,"черновик",17]]]]],[1,509,386,200,56,13,[[0,15,11,50,14,"SKILL.7",14],[0,15,26,53,17,"Навык 7",15]]],[1,279,526,200,56,13,[[0,15,11,50,14,"SKILL.8",14],[0,15,26,53,17,"Навык 8",15]]],[1,478,206,32,20,16,[[0,6,2,22,15,"0,N",18]]],[1,478,333,32,20,16,[[0,6,2,22,15,"0,N",18]]],[1,593,333,32,20,16,[[0,6,2,22,15,"0,N",18]]]]],[1,1068,177,340,914,7,[[0,21,22,136,20,"Свойства навыка",9],[0,21,71,29,18,"Код",2],[0,49,71,7,18,"*",19],[1,122,58,197,44,17,[[0,14,13,169,18,"SKILL.4",20]],0,"input.in"],[0,21,129,67,18,"Название",2],[0,87,129,7,18,"*",19],[1,122,116,197,44,17,[[0,14,13,169,18,"Навык 4",20]],0,"input.in"],[0,21,187,45,18,"Домен",2],[1,122,174,197,44,17,[[0,14,13,169,18,"Домен 1",20]],0,"select.in"],[0,21,245,84,18,"Уровень max",2],[1,122,232,197,44,17,[[0,14,13,169,18,"N",20]],0,"input.in"],[0,21,303,45,18,"Статус",2],[1,122,290,197,44,17,[[0,14,13,169,18,"активен",20]],0,"select.in"],[0,21,359,65,18,"Описание",2],[1,122,348,197,67,18,[[0,12,24,173,18,"Текст описания навыка…",20]],0,"textarea.in"],[1,21,429,298,187,19,[[0,0,23,113,15,"Теория (Markdown)",21],[1,165,13,133,36,3,[[0,17,9,100,18,"Предпросмотр",7]]],[1,0,57,298,130,18,[[0,12,57,274,16,"#### Ключевые понятия\nТекст теории навыка…\n- пункт 1\n- пункт 2",22]],0,"textarea.in"]]],[1,21,630,298,30,19,[[0,0,14,105,15,"Требует (requires)",23]]],[0,21,687,55,18,"Навык 1",4],[1,195,675,76,44,17,[[0,14,13,48,18,"0,N",24]],0,"Вес связи"],[1,279,679,40,36,5,[[0,16,9,9,18,"×",7]],0,"Удалить связь"],[1,21,733,298,44,17,[[0,14,13,270,18,"+ Добавить prerequisite",20]],0,"Добавить prerequisite"],[1,21,791,298,44,6,[[0,114,13,72,18,"Сохранить",8]]],[1,21,849,298,44,5,[[0,79,13,141,18,"Шаблоны сценариев",7]],"Templates",0]]],[1,0,0,1440,1131,20,[[1,440,150,560,466,21,[[0,25,26,119,23,"Новый домен",25],[0,25,68,480,38,"Домен — предметная область (направление обучения): к нему относятся навыки, целевые уровни и шаблоны сценариев.",26],[0,25,137,29,18,"Код",2],[0,53,137,7,18,"*",19],[1,198,124,337,44,17,[[0,14,13,309,18,"domain_n",24]],0,"input.in"],[0,25,197,67,18,"Название",2],[0,91,197,7,18,"*",19],[1,198,184,337,44,17,[[0,14,13,309,18,"Домен N",20]],0,"input.in"],[0,25,255,65,18,"Описание",2],[1,198,244,337,87,18,[[0,12,34,313,18,"Текст описания домена…",20]],0,"textarea.in"],[0,25,348,508,32,"Код задаётся один раз и используется в импорте и шаблонах; название можно поменять позже.",27],[1,288,397,93,44,5,[[0,21,13,52,18,"Отмена",7]],"SkillGraph",0],[1,391,397,144,44,6,[[0,21,13,103,18,"Создать домен",8]],"SkillGraph",0]]]]]],0,"Новый домен"], page);
const screen = page.children[page.children.length - 1];
screen.name = "Граф компетенций: новый домен · DomainDialog";
screen.x = 1520; screen.y = 4871; screen.clipsContent = true;
return { screen: screen.id, nodes: count };
