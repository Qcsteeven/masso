// Layered layout for the REQUIRES DAG: prerequisites on top, dependents below.
export interface XY { x: number; y: number }

export function layeredLayout(ids: string[], edges: { from: string; to: string }[], gapX = 230, gapY = 150): Record<string, XY> {
  const set = new Set(ids);
  const parents = new Map<string, string[]>(ids.map((i) => [i, []]));
  for (const e of edges) if (set.has(e.from) && set.has(e.to)) parents.get(e.to)!.push(e.from);
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    if (level.has(id)) return level.get(id)!;
    if (visiting.has(id)) return 0; // defensive: graph is acyclic on the server
    visiting.add(id);
    const d = Math.max(-1, ...parents.get(id)!.map(depth)) + 1;
    visiting.delete(id);
    level.set(id, d);
    return d;
  };
  ids.forEach(depth);
  const rows = new Map<number, string[]>();
  for (const id of ids) rows.set(level.get(id)!, [...(rows.get(level.get(id)!) ?? []), id]);
  const widest = Math.max(1, ...[...rows.values()].map((r) => r.length));
  const pos: Record<string, XY> = {};
  for (const [lv, row] of rows) {
    const offset = ((widest - row.length) * gapX) / 2;
    row.forEach((id, i) => (pos[id] = { x: offset + i * gapX, y: lv * gapY }));
  }
  return pos;
}
