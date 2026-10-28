// Small UI kit: structure from docs/mockups (Claude Design), style «мягкий современный» with a dark theme (index.css).
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { ApiError } from "../api/client";
import { Icon, type IconName } from "./icons";

export type Tone = "blue" | "green" | "amber" | "red" | "grey";

const toneClass: Record<Tone, string> = {
  blue: "bg-blue-bg text-blue-ink",
  green: "bg-green-bg text-green-ink",
  amber: "bg-amber-bg text-amber-ink",
  red: "bg-red-bg text-red-ink",
  grey: "bg-grey-bg text-grey-ink",
};

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Chip({ tone = "grey", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium", toneClass[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ children, className, padded = true, ...rest }: { children: ReactNode; className?: string; padded?: boolean } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx("min-w-0 rounded-card border border-line/70 bg-surface shadow-card", padded && "p-5", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="m-0 text-base font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

type BtnVariant = "primary" | "default" | "danger" | "ghost";
const btnClass: Record<BtnVariant, string> = {
  primary: "border-accent bg-accent text-on-accent hover:bg-accent-dark hover:border-accent-dark",
  default: "border-line bg-surface text-ink hover:bg-sunken",
  danger: "border-red/60 bg-surface text-red-ink hover:bg-red-bg",
  ghost: "border-transparent bg-transparent text-ink hover:bg-sunken",
};

export function Button({ variant = "default", icon, loading, children, className, small, ...rest }:
  { variant?: BtnVariant; icon?: IconName; loading?: boolean; small?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || loading}
      className={cx("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border px-5 text-sm font-medium transition-[background-color,border-color,color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        small ? "min-h-9 px-4" : "min-h-11", btnClass[variant], className)}>
      {loading ? <Icon name="spinner" size={18} className="animate-spin" /> : icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

const fieldInput = "h-11 w-full rounded-xl border border-field bg-surface px-3.5 text-sm text-ink transition-colors hover:border-label/50";

/** Form row: label ~34 %, control ~66 % (ТП разд. 10). */
export function FieldRow({ label, children, required, top }: { label: string; children: (id: string) => ReactNode; required?: boolean; top?: boolean }) {
  const id = useId();
  return (
    <div className={cx("grid grid-cols-[34%_66%]", top ? "items-start" : "items-center")}>
      <label htmlFor={id} className={cx("text-sm text-label", top && "pt-2.5")}>
        {label} {required && <span className="text-red-ink">*</span>}
      </label>
      {children(id)}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldInput, props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldInput, props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx("w-full rounded-xl border border-field bg-surface p-3 text-sm text-ink transition-colors hover:border-label/50", props.className)} />;
}

/** Stacked filter label (filters bars). */
export function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-label">
      {label}
      {children}
    </label>
  );
}

export function Banner({ tone, icon, children, role = "status" }: { tone: Tone; icon?: IconName; children: ReactNode; role?: "status" | "alert" }) {
  return (
    <div role={role} className={cx("flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm leading-snug", toneClass[tone])}>
      {icon && <Icon name={icon} size={18} className="mt-px shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof ApiError ? error.message : "Не удалось выполнить действие.";
  return <Banner tone="red" icon="alert" role="alert">{msg}</Banner>;
}

export function Loading({ text = "Загрузка…" }: { text?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-4 text-sm text-muted">
      <Icon name="spinner" size={18} className="animate-spin" /> {text}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="p-6 text-center text-sm text-muted">{children}</div>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm [&_td]:border-b [&_td]:border-line-soft [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-middle [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-sunken/60">
        {children}
      </table>
    </div>
  );
}

export function Kpi({ label, value, hint, danger }: { label: string; value: ReactNode; hint?: string; danger?: boolean }) {
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-muted">{label}</span>
      <b className={cx("text-[32px] font-semibold leading-none tracking-tight", danger && "text-red-ink")}>{value}</b>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Card>
  );
}

export function Bar({ value, max = 100, tone = "blue" }: { value: number; max?: number; tone?: "blue" | "green" | "amber" | "red" }) {
  const color = { blue: "bg-accent", green: "bg-green", amber: "bg-amber", red: "bg-red" }[tone];
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <span className={cx("block h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
