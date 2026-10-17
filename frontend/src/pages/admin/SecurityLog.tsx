import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, download } from "../../api/client";
import { defaultPeriod, periodError, periodQuery } from "../../components/period";
import { Banner, Button, Card, CardTitle, Chip, Empty, ErrorBanner, Filter, Input, Loading, Select, Table, fmtDateTime, type Tone } from "../../components/ui";

interface SecRow { id: string; created_at: string; kind: string; severity: string; user: string | null; session_id: string | null; details: Record<string, unknown> }
interface AuditRow { id: string; created_at: string; actor: string | null; action: string; object_type: string; object_id: string; before: unknown; after: unknown; reason: string | null }

const SEV_TONE: Record<string, Tone> = { low: "grey", medium: "amber", high: "red", critical: "red" };
const KIND_LABEL: Record<string, string> = {
  privilege_escalation: "попытка повышения прав", sandbox_escape: "выход за пределы среды", network_scan: "сетевое сканирование",
  prompt_injection: "prompt injection", login_failed: "неудачный вход", refresh_reuse: "повторное использование токена",
  forbidden_file: "доступ к запрещённому файлу",
};
const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-grey-bg px-1.5 py-0.5 font-mono text-xs">{children}</code>;

function secText(e: SecRow) {
  const d = e.details;
  if (d.cmd) return <>Команда <Code>{String(d.cmd)}</Code> отклонена политикой среды</>;
  if (d.question) return <>Запрос к подсказке отфильтрован: <span className="text-muted">«{String(d.question).slice(0, 120)}»</span></>;
  if (d.email) return <>Учётная запись <Code>{String(d.email)}</Code></>;
  return <span className="text-muted">{JSON.stringify(d).slice(0, 160)}</span>;
}

/** Security events and audit log with mandatory period and CSV export (ТП рис. 43). */
export function SecurityLog({ initialLog = "security" }: { initialLog?: "security" | "audit" }) {
  const [f, setF] = useState({ ...defaultPeriod(7), log: initialLog });
  const invalid = periodError(f);
  const q = useQuery({
    queryKey: ["logs", f],
    queryFn: (): Promise<SecRow[] | AuditRow[]> => f.log === "security"
      ? api.get<SecRow[]>("/api/admin/security-events", periodQuery(f))
      : api.get<AuditRow[]>("/api/admin/audit", periodQuery(f)),
    enabled: !invalid,
  });
  const csv = useMutation({ mutationFn: () => download("/api/admin/logs/export", { log: f.log, ...periodQuery(f) }, `${f.log}-${f.from}-${f.to}.csv`) });
  const rows = q.data ?? [];
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-end justify-between gap-4 p-5">
        <CardTitle>События безопасности и аудит</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <Filter label="Дата начала *"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Filter>
          <Filter label="Дата окончания *"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Filter>
          <Filter label="Журнал">
            <Select value={f.log} onChange={(e) => setF({ ...f, log: e.target.value as "security" | "audit" })}>
              <option value="security">Безопасность</option><option value="audit">Аудит действий</option>
            </Select>
          </Filter>
          <Button variant="primary" icon="download" disabled={!!invalid} loading={csv.isPending} onClick={() => csv.mutate()}>Экспорт CSV</Button>
        </div>
      </div>
      <div className="px-5 empty:hidden">{invalid && <Banner tone="red" icon="alert" role="alert">{invalid}</Banner>}<ErrorBanner error={q.error || csv.error} /></div>
      {q.isLoading ? <Loading /> : !rows.length ? <Empty>За период записей нет.</Empty> : f.log === "security" ? (
        <Table>
          <thead><tr><th>Время</th><th>Severity</th><th>Тип</th><th>Пользователь</th><th>Сессия</th><th>Описание</th></tr></thead>
          <tbody>{(rows as SecRow[]).map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap font-mono">{fmtDateTime(e.created_at)}</td>
              <td><Chip tone={SEV_TONE[e.severity] ?? "grey"}>{e.severity}</Chip></td>
              <td>{KIND_LABEL[e.kind] ?? e.kind}</td>
              <td>{e.user ?? "—"}</td>
              <td className="font-mono text-xs">{e.session_id?.slice(0, 8) ?? "—"}</td>
              <td>{secText(e)}</td>
            </tr>
          ))}</tbody>
        </Table>
      ) : (
        <Table>
          <thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th><th>Объект</th><th>Причина</th></tr></thead>
          <tbody>{(rows as AuditRow[]).map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap font-mono">{fmtDateTime(a.created_at)}</td>
              <td>{a.actor ?? "система"}</td>
              <td><Code>{a.action}</Code></td>
              <td>{a.object_type} <span className="font-mono text-xs text-muted">{a.object_id.slice(0, 12)}</span></td>
              <td>{a.reason ?? "—"}</td>
            </tr>
          ))}</tbody>
        </Table>
      )}
    </Card>
  );
}
