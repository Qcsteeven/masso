import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { api } from "../../api/client";
import { REVIEW_LABEL, REVIEW_TONE, type ReportPayload, type TraceEvent, type VerificationOut } from "../../api/types";
import { Page, PageHeader } from "../../components/Layout";
import { Banner, Button, Card, CardTitle, Chip, Empty, ErrorBanner, FieldRow, Filter, Input, Loading, Select, Table, Textarea, cx, fmtDate, type Tone } from "../../components/ui";

const TYPE: Record<string, { label: string; tone: Tone }> = {
  command: { label: "команда", tone: "grey" },
  status: { label: "статус", tone: "grey" },
  incident: { label: "инцидент", tone: "amber" },
  hint: { label: "подсказка", tone: "blue" },
  warning: { label: "предупреждение", tone: "amber" },
  security: { label: "безопасность", tone: "red" },
  check: { label: "проверка", tone: "grey" },
  answer: { label: "ответ", tone: "blue" },
};
const SEV_ORDER = ["info", "warning", "error", "critical"];
const hhmmss = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const hhmm = (iso: string) => hhmmss(iso).slice(0, 5);
const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-grey-bg px-1.5 py-0.5 font-mono text-[13px]">{children}</code>;

function describe(e: TraceEvent): React.ReactNode {
  const p = e.payload;
  switch (e.type) {
    case "command": return <Code>{String(p.cmd ?? "")}</Code>;
    case "hint": return <>Подсказка {String(p.number)} из 3 выдана (−{String(p.penalty_percent ?? 10)} %): {String(p.text ?? "")}</>;
    case "check":
      if (p.self_check) return <>Самопроверка студента: выполнено {String(p.passed)} из {String(p.total)} критериев</>;
      return <>{String(p.title)} — {p.skipped ? "не применялась" : p.passed ? "пройдена" : "не пройдена"}</>;
    case "answer": return <>Ответ сохранён{p.findings != null ? `: несоответствий ${String(p.findings)}` : ""}</>;
    case "security": return <>{String(p.message ?? "Нарушение политики среды")} {p.cmd ? <Code>{String(p.cmd)}</Code> : null}</>;
    default: return String(p.message ?? "");
  }
}

export default function Trace() {
  const { sessionId = "" } = useParams();
  const qc = useQueryClient();
  const report = useQuery({ queryKey: ["report", sessionId], queryFn: () => api.get<ReportPayload>(`/api/reports/by-session/${sessionId}`) });
  const ver = useQuery({ queryKey: ["verification", sessionId], queryFn: () => api.get<VerificationOut>(`/api/verification/${sessionId}`) });
  const events = useQuery({ queryKey: ["events", sessionId], queryFn: () => api.get<TraceEvent[]>("/api/events", { session_id: sessionId }) });
  const [f, setF] = useState({ from: "", to: "", type: "", sev: "info" });
  const [score, setScore] = useState<string>("");
  const [reason, setReason] = useState("");
  const [alt, setAlt] = useState(false);
  const correct = useMutation({
    mutationFn: (confirm: boolean) => api.patch<VerificationOut>(`/api/verification/${sessionId}`,
      confirm ? { confirm: true, reason: reason || undefined } : { score: Number(score), reason, alternative: alt }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification", sessionId] });
      qc.invalidateQueries({ queryKey: ["report", sessionId] });
      qc.invalidateQueries({ queryKey: ["group-overview"] });
    },
  });

  if (report.isLoading || ver.isLoading) return <Loading text="Загрузка цифрового следа…" />;
  if (report.error || !report.data) return <Page><ErrorBanner error={report.error} /></Page>;
  const r = report.data;
  const v = ver.data;
  const list = (events.data ?? []).filter((e) => {
    const t = hhmm(e.created_at);
    return (!f.type || e.type === f.type) && SEV_ORDER.indexOf(e.severity) >= SEV_ORDER.indexOf(f.sev)
      && (!f.from || t >= f.from) && (!f.to || t <= f.to);
  });
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ session_id: sessionId, student: r.student, scenario: r.title, events: list }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trace-${sessionId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const reasonMissing = score !== "" && reason.trim().length < 3;

  return (
    <>
      <PageHeader title={`Цифровой след: ${r.title}`}
        crumbs={<><Link to="/teacher">Группа</Link> · {r.student?.full_name ?? "Обучающийся"} · сессия {sessionId.slice(0, 8)} · {fmtDate(r.created_at)}</>}
        actions={<>
          {r.score.critical_failed && <Chip tone="red">критическая проверка не пройдена</Chip>}
          <Chip>подсказок {r.score.hints}</Chip>
          <Chip>{Math.max(1, Math.round(r.time_spent_sec / 60))} мин</Chip>
          <Link to={`/student/reports/${sessionId}`}>Протокол</Link>
        </>} />
      <Page>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card>
              <div className="flex flex-wrap items-end gap-4">
                <Filter label="Время с"><Input type="time" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Filter>
                <Filter label="Время по"><Input type="time" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Filter>
                <Filter label="Тип события">
                  <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                    <option value="">Все типы</option>
                    {Object.entries(TYPE).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                  </Select>
                </Filter>
                <Filter label="Severity">
                  <Select value={f.sev} onChange={(e) => setF({ ...f, sev: e.target.value })}>
                    <option value="info">info и выше</option>
                    <option value="warning">warning и выше</option>
                    <option value="error">error и выше</option>
                  </Select>
                </Filter>
                <Button className="ml-auto" icon="download" onClick={exportJson}>Экспорт JSON</Button>
              </div>
            </Card>
            <Card padded={false}>
              <ErrorBanner error={events.error} />
              {events.isLoading ? <Loading /> : !list.length ? <Empty>Нет событий по выбранным фильтрам.</Empty> : (
                <Table>
                  <thead><tr><th>Время</th><th>Тип</th><th>Severity</th><th>Событие</th></tr></thead>
                  <tbody>
                    {list.map((e) => {
                      const t = TYPE[e.type] ?? { label: e.type, tone: "grey" as Tone };
                      return (
                        <tr key={e.id} className={cx(e.type === "incident" && "bg-amber-bg/60", e.type === "security" && "bg-red-bg/60")}>
                          <td className="whitespace-nowrap font-mono">{hhmmss(e.created_at)}</td>
                          <td><Chip tone={t.tone}>{t.label}</Chip></td>
                          <td className={cx(e.severity === "warning" && "text-amber-ink", (e.severity === "error" || e.severity === "critical") && "text-red-ink", e.severity === "info" && "text-muted")}>{e.severity}</td>
                          <td className="break-words">{describe(e)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
          <div className="flex flex-col gap-5">
            <Card className="flex flex-col gap-3">
              <CardTitle aside={v && <Chip tone={REVIEW_TONE[v.review_status]}>{REVIEW_LABEL[v.review_status]}</Chip>}>Автоматическая оценка</CardTitle>
              <div className="flex items-baseline gap-3">
                <b className="text-5xl font-semibold">{r.score.final}</b>
                <span className="text-sm text-muted">база {r.score.base}{r.score.critical_failed ? " · потолок 49 при провале критической проверки" : ""}</span>
              </div>
              <code className="text-xs text-muted">{r.score.formula}</code>
              {r.checks.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{c.title}{c.critical ? " *" : ""}</span>
                  <Chip tone={c.skipped ? "grey" : c.passed ? "green" : "red"}>{c.skipped ? "не применялась" : c.passed ? "пройдена" : "не пройдена"}</Chip>
                </div>
              ))}
              {r.teacher?.alternative && <Banner tone="blue" icon="info">Решение отмечено как альтернативное и сохранено для методиста.</Banner>}
              {v?.correction_reason && v.review_status !== "pending" && (
                <Banner tone={v.review_status === "confirmed" ? "green" : "blue"} icon="check">
                  {v.review_status === "confirmed" ? "Оценка подтверждена" : `Экспертная оценка ${v.corrected_score}`}: {v.correction_reason}
                </Banner>
              )}
            </Card>
            <Card>
              <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (!reasonMissing && score !== "") correct.mutate(false); }}>
                <CardTitle>Решение преподавателя</CardTitle>
                <FieldRow label="Экспертная оценка">
                  {(id) => <Input id={id} type="number" min={0} max={100} value={score} placeholder={String(v?.corrected_score ?? r.score.final)} onChange={(e) => setScore(e.target.value)} />}
                </FieldRow>
                <FieldRow label="Причина изменения" required top>
                  {(id) => <Textarea id={id} rows={4} value={reason} aria-invalid={reasonMissing} onChange={(e) => setReason(e.target.value)} placeholder="Обоснование изменения оценки (обязательно)." />}
                </FieldRow>
                {reasonMissing && <span className="-mt-2 text-xs text-red-ink">Укажите причину изменения оценки.</span>}
                <label className="ml-[34%] flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4" checked={alt} onChange={(e) => setAlt(e.target.checked)} />
                  Отметить как альтернативное решение
                </label>
                <ErrorBanner error={correct.error} />
                {correct.isSuccess && <Banner tone="green" icon="check">Решение сохранено и записано в журнал аудита.</Banner>}
                <div className="flex flex-col items-end gap-2.5">
                  <Button loading={correct.isPending && correct.variables === true} onClick={() => correct.mutate(true)}>Подтвердить авто-оценку</Button>
                  <Button type="submit" variant="primary" disabled={score === "" || reasonMissing} loading={correct.isPending && correct.variables === false}>Сохранить корректировку</Button>
                </div>
                <p className="m-0 text-xs text-muted">Изменение записывается в журнал аудита вместе с причиной.</p>
              </form>
            </Card>
          </div>
        </div>
      </Page>
    </>
  );
}
