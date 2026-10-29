
await figma.loadFontAsync({ family: "IBM Plex Sans", style: "Bold" });
const ids = [];
for (const r of [{"text":"Вход","x":0,"y":0},{"text":"Обучающийся","x":0,"y":1260},{"text":"Преподаватель","x":0,"y":3247},{"text":"Методист","x":0,"y":4631},{"text":"Администратор","x":0,"y":6231},{"text":"Системный администратор","x":0,"y":7601}]) {
  const t = figma.createText(); t.fontName = { family: "IBM Plex Sans", style: "Bold" }; t.characters = r.text; t.fontSize = 72;
  t.x = r.x; t.y = r.y + 40; t.name = "Ряд: " + r.text; ids.push(t.id);
}
return { ids };
