import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { api } from "../../api/client";
import type { ReportPayload, SkillChange } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Page, PageHeader } from "../../components/Layout";
import { Banner, Button, Card, CardTitle, Chip, ErrorBanner, Loading, Table, fmtDate, type Tone } from "../../components/ui";

function ScoreRing({ value, passed }: { value: number; passed: boolean }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Итоговый балл ${value} из 100`}>
      <circle cx="66" cy="66" r={r} fill="none" stroke="#e6eaee" strokeWidth="12" />
      <circle cx="66" cy="66" r={r} fill="none" stroke={passed ? "#1d5fd1" : "#b3261e"} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 66 66)" />
      <text x="66" y="68" textAnchor="middle" fontSize="34" fontWeight="600" fill="#14212e">{value}</text>
      <text x="66" y="90" textAnchor="middle" fontSize="12" fill="#556270">из 100</text>
    </svg>
  );
}

function changeChip(c: SkillChange): { label: string; tone: Tone } {
  if (c.level_after > c.level_before) return { label: `уровень ${c.level_before} → ${c.level_after}`, tone: "green" };
  if (!c.passed) return { label: "серия сброшена", tone: "amber" };
  return { label: `подтверждение ${c.success_streak} из 3`, tone: "blue" };
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-l border-line px-5">
      <span className="text-sm text-muted">{label}</span>
      <b className="text-xl font-semibold">{value}</b>
    </div>
  );
}

export default function Report() {
  const { sessionId = "" } = useParams();
  const { hasRole } = useAuth();
  const q = useQuery({
    queryKey: ["report", sessionId],
    queryFn: () => api.get<ReportPayload>(`/api/reports/by-session/${sessionId}`),
  });
  if (q.isLoading) return <Loading text="Загрузка протокола…" />;
  if (q.error || !q.data) return <Page><ErrorBanner error={q.error} /></Page>;
  const r = q.data;
  const sc = r.score;
  const counted = r.checks.filter((c) => !c.skipped);
  const finalScore = r.teacher?.score ?? sc.final;
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `protocol-${r.session_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const back = hasRole("student") ? "/student" : `/teacher/sessions/${sessionId}`;

  return (
    <>
      <PageHeader crumbs={`Протокол прохождения · сессия ${r.session_id.slice(0, 8)} · ${fmtDate(r.created_at)}`} title={r.title}
        actions={<div className="flex gap-2.5 print:hidden">
          <Button icon="download" onClick={downloadJson}>JSON</Button>
          <Button icon="print" onClick={() => window.print()}>Печать PDF</Button>
        </div>} />
      <Page>
        <Card className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <div className="flex items-center gap-5">
            <ScoreRing value={finalScore} passed={finalScore >= sc.threshold} />
            <div className="flex flex-col gap-2">
              <Chip tone={sc.passed ? "green" : "red"} className="self-start">{sc.passed ? "сценарий пройден" : "сценарий не пройден"}</Chip>
              <code className="text-[13px] text-muted">база × (1 − 0,1 × подсказки) − 10 × нарушения</code>
              <code className="text-[13px] text-muted">{sc.formula}</code>
              {sc.critical_failed && <span className="text-xs text-red-ink">Не пройдена критическая проверка: балл ограничен 49.</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-y-4">
            <Metric label="Проверки" value={`${counted.filter((c) => c.passed).length} из ${counted.length}`} />
            <Metric label="Время" value={`${Math.max(1, Math.round(r.time_spent_sec / 60))} мин`} />
            <Metric label="Подсказки" value={`${sc.hints} (−${sc.hints * 10} %)`} />
            <Metric label="Инциденты" value={r.incidents.length} />
            <Metric label="Нарушения" value={sc.violations} />
          </div>
        </Card>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card padded={false}>
            <div className="p-5 pb-3"><CardTitle>Результаты проверок</CardTitle></div>
            <Table>
              <thead><tr><th>Проверка</th><th>Вес</th><th>Результат</th></tr></thead>
              <tbody>
                {r.checks.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title} {c.critical && <Chip className="ml-1">критическая</Chip>}</td>
                    <td>{c.weight}</td>
                    <td>
                      <Chip tone={c.skipped ? "grey" : c.passed ? "green" : "red"}>
                        {c.skipped ? "не применялась" : c.passed ? "пройдена" : "не пройдена"}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {r.errors.length > 0 && (
              <div className="flex flex-col gap-2 p-5">
                {r.errors.map((e) => (
                  <Banner key={e.check} tone="red" icon="alert">
                    <b>Ошибка.</b> Не выполнен критерий «{e.check}»{e.critical ? " (критический)" : ""}. Вернитесь к легенде и сверьте результат с этим критерием.
                  </Banner>
                ))}
              </div>
            )}
            {r.hints.length > 0 && (
              <div className="border-t border-line-soft p-5">
                <div className="mb-2 text-sm font-semibold">Полученные подсказки</div>
                <ol className="m-0 flex flex-col gap-1.5 pl-5 text-sm">{r.hints.map((h) => <li key={h.number}>{h.text}</li>)}</ol>
              </div>
            )}
          </Card>
          <div className="flex flex-col gap-5">
            <Card className="flex flex-col gap-3">
              <CardTitle>Изменения профиля</CardTitle>
              {!r.skill_changes.length && <p className="m-0 text-sm text-muted">Навыки сценария не изменились.</p>}
              {r.skill_changes.map((c) => {
                const ch = changeChip(c);
                return <div key={c.skill_id} className="flex items-center justify-between gap-3 text-sm"><span>{c.name}</span><Chip tone={ch.tone}>{ch.label}</Chip></div>;
              })}
            </Card>
            <Card className="flex flex-col gap-3">
              <CardTitle>Рекомендация</CardTitle>
              <p className="m-0 text-sm leading-relaxed">
                {r.recommendation
                  ? <>Дефицит навыка «{r.recommendation.skill}».{r.recommendation.template && <> Рекомендуемый сценарий: «{r.recommendation.template}».</>}</>
                  : "Дефицитов в направлении не выявлено. Продолжайте выполнять назначенные сценарии."}
              </p>
              {hasRole("student") && <Link to="/student" className="no-underline print:hidden"><Button variant="primary" className="w-full">Перейти к назначениям</Button></Link>}
            </Card>
            <Card className="flex flex-col gap-2">
              <CardTitle>Оценка преподавателя</CardTitle>
              {r.teacher ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Chip tone={r.teacher.confirmed ? "green" : "blue"}>{r.teacher.confirmed ? "подтверждена" : `скорректирована: ${r.teacher.score}`}</Chip>
                    <span className="text-muted">{r.teacher.by}, {fmtDate(r.teacher.at)}</span>
                  </div>
                  <p className="m-0 text-sm">{r.teacher.reason}</p>
                </>
              ) : (
                <p className="m-0 text-[13px] text-muted">Автоматическая оценка ожидает подтверждения. При корректировке здесь появится причина изменения.</p>
              )}
            </Card>
            {!hasRole("student") && <Link to={back} className="print:hidden">К цифровому следу</Link>}
          </div>
        </div>
      </Page>
    </>
  );
}
