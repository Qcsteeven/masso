// Student skill map: state of every skill of a direction from the competency graph and the student's levels.
export type SkillState = "mastered" | "progress" | "available" | "locked";

export interface ProgressInput {
  skills: { id: string; level_max: number }[];
  edges: { skill_id: string; requires_skill_id: string }[];
  levels: Map<string, number>; // missing = level 0
  targets: Map<string, number>; // required level of the direction; missing = optional skill
}

export interface SkillProgress {
  state: SkillState;
  level: number;
  required: number | null;
  prerequisites: string[];
  unlocks: string[];
}

export function skillProgress({ skills, edges, levels, targets }: ProgressInput): Map<string, SkillProgress> {
  const ids = new Set(skills.map((s) => s.id));
  const own = edges.filter((e) => ids.has(e.skill_id) && ids.has(e.requires_skill_id));
  const out = new Map<string, SkillProgress>();
  for (const s of skills) {
    const level = levels.get(s.id) ?? 0;
    const required = targets.get(s.id) ?? null;
    const prerequisites = own.filter((e) => e.skill_id === s.id).map((e) => e.requires_skill_id);
    const unlocks = own.filter((e) => e.requires_skill_id === s.id).map((e) => e.skill_id);
    let state: SkillState;
    if (level >= (required ?? s.level_max)) state = "mastered";
    else if (level > 0) state = "progress";
    // a skill can be started once every prerequisite has been confirmed at least once
    else state = prerequisites.every((p) => (levels.get(p) ?? 0) > 0) ? "available" : "locked";
    out.set(s.id, { state, level, required, prerequisites, unlocks });
  }
  return out;
}

/** Share of the direction's required levels reached, 0–100 (optional skills do not count). */
export function directionPercent(progress: Map<string, SkillProgress>): number {
  let need = 0;
  let have = 0;
  for (const p of progress.values()) {
    if (p.required == null) continue;
    need += p.required;
    have += Math.min(p.level, p.required);
  }
  return need ? Math.round((100 * have) / need) : 0;
}

export const STATE_LABEL: Record<SkillState, string> = {
  mastered: "освоен",
  progress: "в процессе",
  available: "можно начать",
  locked: "закрыт",
};
