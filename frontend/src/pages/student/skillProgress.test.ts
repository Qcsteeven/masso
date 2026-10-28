import { describe, expect, it } from "vitest";
import { directionPercent, skillProgress } from "./skillProgress";

// LINUX → NET → NGINX, LINUX → LOGS; OPT has no target
const skills = ["LINUX", "NET", "NGINX", "LOGS", "OPT"].map((id) => ({ id, level_max: 5 }));
const edges = [
  { requires_skill_id: "LINUX", skill_id: "NET" },
  { requires_skill_id: "NET", skill_id: "NGINX" },
  { requires_skill_id: "LINUX", skill_id: "LOGS" },
];
const targets = new Map([["LINUX", 3], ["NET", 3], ["NGINX", 2], ["LOGS", 2]]);

describe("skillProgress", () => {
  it("classifies skills by level, target and prerequisites", () => {
    const p = skillProgress({ skills, edges, targets, levels: new Map([["LINUX", 3], ["NET", 1]]) });
    expect(p.get("LINUX")?.state).toBe("mastered");
    expect(p.get("NET")?.state).toBe("progress");
    expect(p.get("NGINX")?.state).toBe("available"); // NET confirmed once
    expect(p.get("LOGS")?.state).toBe("available");
    expect(p.get("OPT")?.state).toBe("available"); // no prerequisites
    expect(p.get("LINUX")?.unlocks).toEqual(["NET", "LOGS"]);
    expect(p.get("NGINX")?.prerequisites).toEqual(["NET"]);
  });

  it("locks a skill until its prerequisites are started; optional skills need level_max", () => {
    const p = skillProgress({ skills, edges, targets, levels: new Map([["OPT", 3]]) });
    expect(p.get("NET")?.state).toBe("locked");
    expect(p.get("NGINX")?.state).toBe("locked");
    expect(p.get("OPT")?.state).toBe("progress");
    expect(p.get("OPT")?.required).toBeNull();
  });

  it("counts the direction percent over required levels only", () => {
    const p = skillProgress({ skills, edges, targets, levels: new Map([["LINUX", 5], ["NET", 1], ["OPT", 5]]) });
    expect(directionPercent(p)).toBe(40); // (3 + 1 + 0 + 0) / (3 + 3 + 2 + 2)
    expect(directionPercent(skillProgress({ skills, edges, targets: new Map(), levels: new Map() }))).toBe(0);
  });
});
