import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Page, PageHeader } from "../../components/Layout";
import { Bar, Button, Card, CardTitle, Chip, Empty, ErrorBanner, Loading, Table, cx, fmtDateTime, type Tone } from "../../components/ui";
import { SecurityLog } from "../admin/SecurityLog";

interface Comp { ok: boolean; error?: string; [k: string]: unknown }
interface Sandbox { id: string; container_id: string; kind: string; session_id: string; user: string | null; session_status: string | null; state: string; status: string; uptime_sec: number; orphan: boolean }
interface HealthOut {
  checked_at: string;
  components: { postgresql: Comp; worker: Comp; docker: Comp; llm: Comp & { generation_mode: string | null; providers: { code: string; status: string; last_error: string | null }[] } };
  sandboxes: Sandbox[];
  sessions: Record<string, number>;
  capacity: { active: number; max: number };
  disk: { total: number; used: number };
}

const gb = (b: number) => (b < 1024 ** 3
  ? `${Math.round(b / 1024 ** 2)} МБ`
  : `${(b / 1024 ** 3).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ГБ`);
const hm = (sec: number) => `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}`;
const MODE: Record<string, string> = { external: "внешний режим", local: "локальный режим", template: "шаблонный режим" };

function StatusCard({ title, tone, text }: { title: string; tone: "green" | "amber" | "red"; text: string }) {
  const dot = { green: "bg-green", amber: "bg-amber", red: "bg-red" }[tone];
  return (
    <Card className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2"><b className="text-[15px]">{title}</b><span aria-label={tone === "green" ? "в норме" : tone === "amber" ? "предупреждение" : "ошибка"} className={cx("size-2.5 rounded-full", dot)} /></div>
      <span className="text-[13px] text-muted">{text}</span>
    </Card>
  );
}

function sandboxChip(s: Sandbox): { label: string; tone: Tone } {
  if (s.orphan) return { label: s.session_status ? `сессия ${s.session_status}` : "без сессии", tone: "red" };
  if (s.state === "paused" || s.session_status === "paused") return { label: "пауза", tone: "amber" };
  return { label: "активна", tone: "green" };
}

export default function Health() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sys-health"], queryFn: () => api.get<HealthOut>("/api/admin/health"), refetchInterval: 15_000 });
  const clean = useMutation({
    mutationFn: (s: Sandbox) => api.post(`/api/admin/sandboxes/${s.container_id}/cleanup`, undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sys-health"] }),
  });
  const h = q.data;
  const c = h?.components;
  const workerAge = c?.worker.age_sec as number | null | undefined;
  const sessionCount = Object.values(h?.sessions ?? {}).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Состояние системы" subtitle={h ? `Обновлено ${fmtDateTime(h.checked_at)} · данные /api/admin/health и /metrics` : "Загрузка…"}
        actions={<>
          <a href="/metrics" target="_blank" rel="noreferrer" className="no-underline"><Button>Метрики Prometheus</Button></a>
          <Button loading={q.isFetching} onClick={() => q.refetch()}>Обновить</Button>
        </>} />
      <Page>
        <ErrorBanner error={q.error || clean.error} />
        {q.isLoading && <Loading />}
        {h && c && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              <StatusCard title="Backend/API" tone="green" text={`всего сессий ${sessionCount}`} />
              <StatusCard title="PostgreSQL" tone={c.postgresql.ok ? "green" : "red"} text={c.postgresql.ok ? `БД ${gb(Number(c.postgresql.size_bytes ?? 0))}` : String(c.postgresql.error)} />
              <StatusCard title="Фоновый worker" tone={c.worker.ok ? "green" : "red"} text={workerAge != null ? `пульс ${Math.round(workerAge)} с назад` : "нет пульса"} />
              <StatusCard title="Docker Engine" tone={c.docker.ok ? "green" : "red"} text={c.docker.ok ? `${h.sandboxes.length} учебных контейнеров · ${String(c.docker.server_version)}` : String(c.docker.error)} />
              <StatusCard title="LLM Gateway" tone={c.llm.generation_mode === "external" ? "green" : "amber"} text={MODE[c.llm.generation_mode ?? ""] ?? "режим не задан"} />
            </div>
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <Card className="flex flex-col gap-3.5">
                <CardTitle>Ресурсы стенда</CardTitle>
                {c.docker.ok && (
                  <div className="flex justify-between text-sm"><span>CPU / RAM хоста</span><span className="font-mono">{String(c.docker.ncpu)} vCPU · {gb(Number(c.docker.mem_total ?? 0))}</span></div>
                )}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm"><span>Диск</span><span className="font-mono">{gb(h.disk.used)} / {gb(h.disk.total)}</span></div>
                  <Bar value={h.disk.used} max={h.disk.total} tone={h.disk.used / h.disk.total > 0.85 ? "red" : "blue"} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm"><span>Учебные сессии</span><span className="font-mono">{h.capacity.active} / {h.capacity.max}</span></div>
                  <Bar value={h.capacity.active} max={h.capacity.max} tone={h.capacity.active >= h.capacity.max ? "red" : "green"} />
                </div>
              </Card>
              <Card padded={false}>
                <div className="p-5 pb-3"><CardTitle aside={<span className="text-xs text-muted">автоочистка после завершения сессии</span>}>Учебные среды</CardTitle></div>
                {!h.sandboxes.length ? <Empty>Запущенных учебных сред нет.</Empty> : (
                  <Table>
                    <thead><tr><th>Контейнер</th><th>Назначение</th><th>Пользователь</th><th>Работает</th><th>Состояние</th><th><span className="sr-only">Действие</span></th></tr></thead>
                    <tbody>{h.sandboxes.map((s) => {
                      const st = sandboxChip(s);
                      return (
                        <tr key={s.id}>
                          <td className="font-mono text-xs">{s.container_id}</td>
                          <td>{s.kind === "validation" ? "валидация" : "сессия"}</td>
                          <td>{s.user ?? "—"}</td>
                          <td className="font-mono">{hm(s.uptime_sec)}</td>
                          <td><Chip tone={st.tone}>{st.label}</Chip></td>
                          <td className="text-right">{s.orphan && <Button small loading={clean.isPending && clean.variables?.id === s.id} onClick={() => clean.mutate(s)}>Очистить</Button>}</td>
                        </tr>
                      );
                    })}</tbody>
                  </Table>
                )}
              </Card>
            </div>
          </>
        )}
        <SecurityLog />
      </Page>
    </>
  );
}
