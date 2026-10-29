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
return { screen: screen.id, nodes: count };
