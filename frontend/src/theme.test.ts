import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, currentTheme, setTheme } from "./theme";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

describe("theme", () => {
  it("follows the system preference until the user chooses", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("dark") }));
    expect(currentTheme()).toBe("dark");
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("remembers the explicit choice", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("masso-theme")).toBe("light");
    expect(currentTheme()).toBe("light");
  });
});
