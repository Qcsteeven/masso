import { useSyncExternalStore } from "react";

// Light / dark theme: explicit choice in localStorage, otherwise the system preference.
// index.html applies it before the first paint; this module keeps <html data-theme> in sync.
export type Theme = "light" | "dark";
const KEY = "masso-theme";
const listeners = new Set<() => void>();

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function system(): Theme {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function currentTheme(): Theme {
  return stored() ?? system();
}

export function applyTheme(theme: Theme = currentTheme()): void {
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode: the choice lasts until reload */
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribe, () => (document.documentElement.dataset.theme as Theme) ?? currentTheme());
  return [theme, () => setTheme(theme === "dark" ? "light" : "dark")];
}
