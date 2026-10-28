// Stroke icons from the Claude Design mockups (docs/mockups/source).
import type { SVGProps } from "react";

const paths: Record<string, string> = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  terminal: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 9l3 3-3 3M12 15h5",
  report: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  graph: "M8.5 6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M20.5 6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M14.5 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M7.2 8.2l3.6 7.6M16.8 8.2l-3.6 7.6M8.5 6h7",
  users: "M12.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2",
  template: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M8 8h8M8 12h8M8 16h5",
  chip: "M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4",
  shield: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM9 12l2 2 4-4",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  alert: "M12 3l10 18H2zM12 10v5M12 18v.01",
  check: "M5 12l5 5 9-10",
  x: "M6 6l12 12M18 6L6 18",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upload: "M12 20V9M7 14l5-5 5 5M5 4h14",
  print: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  back: "M15 6l-6 6 6 6",
  target: "M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6M12 7.5v.01",
  spinner: "M12 3a9 9 0 1 0 9 9",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={paths[name]} />
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <rect width="44" height="44" rx="14" fill="var(--color-accent)" />
      <g stroke="var(--color-on-accent)" strokeWidth="2.4" fill="none"><path d="M14 15l8 14M30 15l-8 14M14 15h16" /></g>
      <g fill="var(--color-on-accent)"><circle cx="14" cy="15" r="3.8" /><circle cx="30" cy="15" r="3.8" /><circle cx="22" cy="29" r="3.8" /></g>
    </svg>
  );
}
