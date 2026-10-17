import { describe, expect, it } from "vitest";
import { defaultPeriod, periodError, periodQuery } from "./period";

describe("period", () => {
  it("requires both dates and correct order", () => {
    expect(periodError({ from: "", to: "2026-10-01" })).toMatch(/Укажите/);
    expect(periodError({ from: "2026-10-02", to: "2026-10-01" })).toMatch(/позже/);
    expect(periodError(defaultPeriod())).toBeNull();
  });
  it("converts to day boundaries", () => {
    const q = periodQuery({ from: "2026-10-01", to: "2026-10-01" });
    expect(new Date(q.to!).getTime() - new Date(q.from!).getTime()).toBe(864e5 - 1);
    expect(periodQuery({ from: "", to: "" })).toEqual({ from: undefined, to: undefined });
  });
});
