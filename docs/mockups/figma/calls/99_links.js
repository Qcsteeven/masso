
const page = figma.root.children[0];
const screens = {};
for (const n of page.children) { const m = n.name.match(/· (\w+)$/); if (m) screens[m[1]] = n; }
let set = 0; const missing = [];
for (const link of page.findAll(n => n.type === "FRAME" && n.name.startsWith("→ "))) {
  const dest = screens[link.name.slice(2)];
  if (!dest) { missing.push(link.name); continue; }
  await link.setReactionsAsync([{ trigger: { type: "ON_CLICK" }, actions: [{ type: "NODE", destinationId: dest.id, navigation: "NAVIGATE", transition: null, preserveScrollPosition: false }] }]);
  set++;
}
page.flowStartingPoints = [{ nodeId: screens.Main.id, name: "МАССО — вход" }];
return { set, missing: [...new Set(missing)] };
