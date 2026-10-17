import { describe, expect, it } from "vitest";
import { layeredLayout } from "./layout";

describe("layeredLayout", () => {
  it("puts prerequisites above dependents", () => {
    const p = layeredLayout(["a", "b", "c", "d"], [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "a", to: "c" }]);
    expect(p.a.y).toBe(0);
    expect(p.b.y).toBeGreaterThan(p.a.y);
    expect(p.c.y).toBeGreaterThan(p.b.y);
    expect(p.d.y).toBe(0);
    expect(p.a.x).not.toBe(p.d.x);
  });
  it("ignores edges to unknown nodes", () => {
    expect(layeredLayout(["x"], [{ from: "zz", to: "x" }]).x).toEqual({ x: 0, y: 0 });
  });
});
