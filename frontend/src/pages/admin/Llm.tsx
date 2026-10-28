import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";
import { Page, PageHeader } from "../../components/Layout";
import { Banner, Button, Card, CardTitle, Chip, ErrorBanner, FieldRow, Loading, Table, Textarea, cx, fmtTime } from "../../components/ui";

type Mode = "external" | "local" | "template";
interface Provider { id: string; code: string; mode: Mode; base_url: string | null; chat_model: string | null; embeddings_model: string | null; api_key_env: string | null; priority: number; status: string; last_error: string | null; last_error_at: string | null }
interface Providers { generation_mode: Mode; updated_at: string; reason: string | null; providers: Provider[] }
interface Probe { code: string; ok: boolean; latency_ms: number | null; error: string | null }
interface Profile { code: string; image: string; cpu: number; mem_mb: number; pids_limit: number; storage_mb: number; network_policy: string; active: number }
interface Background { incidents_pending: number; paused_sessions: number; checking: number; generated_last_hour: number; worker: { age_sec: number | null; ticks: number } }

const MODES: { mode: Mode; title: string; sub: string }[] = [
  { mode: "external", title: "Внешний", sub: "основной" },
  { mode: "local", title: "Локальный", sub: "резервный" },
  { mode: "template", title: "Шаблонный", sub: "деградация" },
];
const MODE_LABEL: Record<Mode, string> = { external: "внешний", local: "локальный", template: "шаблонный" };
const PROVIDER_TITLE: Record<Mode, string> = { external: "Внешний", local: "Локальный (Ollama)", template: "Шаблонный" };
const mb = (v: number) => (v >= 1024 ? `${(v / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ГБ` : `${v} МБ`);

export default function Llm() {
  const qc = useQueryClient();
  const prov = useQuery({ queryKey: ["llm-providers"], queryFn: () => api.get<Providers>("/api/admin/llm/providers") });
  const probe = useQuery({ queryKey: ["llm-health"], queryFn: () => api.get<Probe[]>("/api/admin/llm/health"), staleTime: 60_000 });
  const profiles = useQuery({ queryKey: ["sandbox-profiles"], queryFn: () => api.get<Profile[]>("/api/admin/sandbox/profiles") });
  const bg = useQuery({ queryKey: ["background"], queryFn: () => api.get<Background>("/api/admin/background"), refetchInterval: 15_000 });
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const current = prov.data?.generation_mode;
  const target = mode ?? current;
  const sw = useMutation({
    mutationFn: () => api.post("/api/admin/llm/switch-mode", { mode: target, reason }),
    onSuccess: () => { setReason(""); setMode(null); qc.invalidateQueries({ queryKey: ["llm-providers"] }); qc.invalidateQueries({ queryKey: ["llm-status"] }); },
  });
  const probes = new Map((probe.data ?? []).map((p) => [p.code, p]));

  return (
    <>
      <PageHeader title="LLM и песочницы" subtitle="Режим LLM Gateway, провайдеры, профили учебных сред"
        actions={current && <Chip tone={current === "external" ? "green" : "amber"}>режим: {MODE_LABEL[current]} с {fmtTime(prov.data!.updated_at).slice(0, 5)}</Chip>} />
      <Page>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card padded={false}>
              <div className="p-5 pb-3"><CardTitle aside={<Button small loading={probe.isFetching} onClick={() => probe.refetch()}>Проверить доступность</Button>}>Провайдеры (OpenAI-совместимый API)</CardTitle></div>
              <ErrorBanner error={prov.error} />
              {prov.isLoading ? <Loading /> : (
                <Table>
                  <thead><tr><th>Провайдер</th><th>Адрес</th><th>Задержка</th><th>Состояние</th></tr></thead>
                  <tbody>{prov.data?.providers.map((p) => {
                    const pr = probes.get(p.code);
                    const inUse = p.mode === current;
                    return (
                      <tr key={p.id} className={cx(inUse && "bg-blue-bg/40")}>
                        <td>
                          <div className="font-semibold">{PROVIDER_TITLE[p.mode] ?? p.code}</div>
                          <div className="text-xs text-muted">
                            {p.mode === "template" ? "утверждённые варианты шаблонов" : [p.chat_model ? `модель ${p.chat_model}` : "модель задаётся в настройках", p.api_key_env && `ключ в переменной ${p.api_key_env}`].filter(Boolean).join(" · ")}
                            {inUse && " · используется сейчас"}
                          </div>
                        </td>
                        <td className="font-mono text-xs">{p.base_url ?? "—"}</td>
                        <td className="font-mono">{pr?.latency_ms != null ? `${(pr.latency_ms / 1000).toFixed(1).replace(".", ",")} с` : "—"}</td>
                        <td>
                          {probe.isLoading ? <Chip>проверка…</Chip> : pr ? (
                            <span title={pr.error ?? undefined}><Chip tone={pr.ok ? "green" : "red"}>{pr.ok ? "доступен" : "недоступен"}</Chip></span>
                          ) : <Chip tone={p.last_error ? "red" : "grey"}>{p.last_error ? "ошибка" : p.status}</Chip>}
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </Table>
              )}
            </Card>
            <Card padded={false}>
              <div className="p-5 pb-3"><CardTitle aside={<span className="text-xs text-muted">no-new-privileges · cap-drop ALL · read-only rootfs</span>}>Профили песочниц</CardTitle></div>
              <ErrorBanner error={profiles.error} />
              {profiles.isLoading ? <Loading /> : (
                <Table>
                  <thead><tr><th>Профиль</th><th>CPU</th><th>RAM</th><th>Процессы</th><th>Диск /srv</th><th>Сеть</th><th>Активно</th></tr></thead>
                  <tbody>{[...(profiles.data ?? [])].sort((a, b) => (a.code === "document" ? 1 : 0) - (b.code === "document" ? 1 : 0) || a.mem_mb - b.mem_mb).map((p) => p.code === "document" ? (
                    <tr key={p.code}><td className="font-mono">{p.code}</td><td colSpan={5} className="text-muted">без контейнера · документный тренажёр</td><td>{p.active}</td></tr>
                  ) : (
                    <tr key={p.code}>
                      <td className="font-mono">{p.code}</td><td>{p.cpu}</td><td>{mb(p.mem_mb)}</td><td>{p.pids_limit}</td><td>{mb(p.storage_mb)}</td>
                      <td><Chip>{p.network_policy === "deny_all" ? "отключена" : p.network_policy}</Chip></td><td>{p.active}</td>
                    </tr>
                  ))}</tbody>
                </Table>
              )}
            </Card>
          </div>
          <div className="flex flex-col gap-5">
            <Card>
              <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); sw.mutate(); }}>
                <CardTitle>Режим генерации</CardTitle>
                <div role="radiogroup" aria-label="Режим генерации" className="grid grid-cols-3 overflow-hidden rounded-xl border border-field">
                  {MODES.map((m) => (
                    <button key={m.mode} type="button" role="radio" aria-checked={target === m.mode} onClick={() => setMode(m.mode)}
                      className={cx("border-l border-field px-3 py-2.5 text-left first:border-l-0", target === m.mode ? "bg-blue-bg text-blue-ink" : "hover:bg-bg")}>
                      <div className="text-sm font-semibold">{m.title}</div><div className="text-xs opacity-80">{m.sub}</div>
                    </button>
                  ))}
                </div>
                <FieldRow label="Причина" required top>{(id) => <Textarea id={id} rows={3} required minLength={3} placeholder="Причина переключения (обязательно)." value={reason} onChange={(e) => setReason(e.target.value)} />}</FieldRow>
                <ErrorBanner error={sw.error} />
                {sw.isSuccess && <Banner tone="green" icon="check">Режим переключён и записан в журнал аудита.</Banner>}
                <Button type="submit" variant="primary" disabled={target === current || reason.trim().length < 3} loading={sw.isPending}>Переключить режим</Button>
                <Banner tone="blue" icon="info">Активные сессии не прерываются. Переключение записывается в журнал аудита, преподаватели видят предупреждение.</Banner>
                {prov.data?.reason && <p className="m-0 text-xs text-muted">Последняя причина: {prov.data.reason}</p>}
              </form>
            </Card>
            <Card className="flex flex-col gap-2.5">
              <CardTitle>Фоновые задачи</CardTitle>
              {bg.data && ([
                ["Сценариев сгенерировано за час", bg.data.generated_last_hour],
                ["Инциденты по расписанию", `${bg.data.incidents_pending} ожидают`],
                ["Проверки в работе", bg.data.checking],
                ["Сессии на паузе (контроль бездействия)", bg.data.paused_sessions],
                ["Пульс worker", bg.data.worker.age_sec != null ? `${Math.round(bg.data.worker.age_sec)} с назад` : "нет данных"],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 text-sm"><span>{k}</span><span className="font-mono">{v}</span></div>
              ))}
              <ErrorBanner error={bg.error} />
            </Card>
          </div>
        </div>
      </Page>
    </>
  );
}
