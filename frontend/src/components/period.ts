// Report periods (ТП разд. 10: «Дата начала» и «Дата окончания» обязательны).
export interface Period { from: string; to: string } // YYYY-MM-DD from <input type="date">

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function defaultPeriod(days = 30): Period {
  const to = new Date();
  const from = new Date(to.getTime() - days * 864e5);
  return { from: ymd(from), to: ymd(to) };
}

/** Query params for the API: local day boundaries as ISO; empty values are passed as missing. */
export function periodQuery(p: Period): { from?: string; to?: string } {
  return {
    from: p.from ? new Date(`${p.from}T00:00:00`).toISOString() : undefined,
    to: p.to ? new Date(`${p.to}T23:59:59.999`).toISOString() : undefined,
  };
}

export function periodError(p: Period): string | null {
  if (!p.from || !p.to) return "Укажите дату начала и дату окончания периода.";
  if (p.from > p.to) return "Дата начала позже даты окончания.";
  return null;
}
