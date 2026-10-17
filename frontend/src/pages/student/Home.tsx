import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../../api/client";
import { DOMAIN_LABEL, KIND_LABEL, PRIORITY_LABEL, type Assignment, type MyReport, type MySkill, type Recommendations, type SessionStatus } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Page, PageHeader, UserBadge } from "../../components/Layout";
import { Icon } from "../../components/icons";
import { Banner, Bar, Button, Card, CardTitle, Chip, Empty, ErrorBanner, Kpi, Loading, Select, Table, type Tone } from "../../components/ui";
import { useStartScenario } from "./useStartScenario";

const STATUS: Partial<Record<SessionStatus | "assigned", { label: string; tone: Tone }>> = {
  assigned: { label: "назначен", tone: "grey" },
  starting: { label: "запуск среды", tone: "blue" },
  active: { label: "выполняется", tone: "blue" },
  paused: { label: "на паузе", tone: "amber" },
  checking: { label: "проверка", tone: "blue" },
  submitted: { label: "проверка", tone: "blue" },
  completed: { label: "завершён", tone: "green" },
  failed: { label: "ошибка", tone: "red" },
  expired: { label: "истёк", tone: "grey" },
};

export const PRIORITY_TONE = { critical: "red", high: "amber", medium: "blue", low: "grey" } as const;

export function scoreTone(score: number | null | undefined, threshold = 75): Tone {
  if (score == null) return "grey";
  return score >= threshold ? "green" : score >= 50 ? "amber" : "red";
}

const fmtDayMonth = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) : "—";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const assignments = useQuery({ queryKey: ["assignments-me"], queryFn: () => api.get<Assignment[]>("/api/scenarios/assignments/me") });
  const reports = useQuery({ queryKey: ["reports-mine"], queryFn: () => api.get<MyReport[]>("/api/reports/mine") });
  const skills = useQuery({ queryKey: ["skills-me"], queryFn: () => api.get<MySkill[]>("/api/skills/me") });
  const domains = useMemo(() => {
    const set = new Set((assignments.data ?? []).map((a) => a.template.domain_code));
    return set.size ? [...set] : ["devops"];
  }, [assignments.data]);
  const [domainSel, setDomain] = useState<string | null>(null);
  const domain = domainSel ?? domains[0];
  const recs = useQuery({
    queryKey: ["recommendations", domain],
    queryFn: () => api.get<Recommendations>("/api/skills/recommendations", { domain }),
  });
  const starter = useStartScenario();

  const list = assignments.data ?? [];
  const mine = reports.data ?? [];
  const active = list.filter((a) => a.last_session_status === "active" || a.last_session_status === "paused").length;
  const open = list.filter((a) => a.last_session_status !== "completed");
  const nextDue = open.map((a) => a.due_at).filter(Boolean).sort()[0] ?? null;
  const scored = mine.filter((r) => r.score != null);
  const avg = scored.length ? Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length) : null;
  const domainSkills = (skills.data ?? []).filter((s) => s.domain_code === domain && s.required_level != null);

  return (
    <>
      <PageHeader title="Мои назначения" subtitle={`${user?.group_code ?? "Группа не указана"} · ${DOMAIN_LABEL[domain] ?? domain}`}
        actions={<UserBadge />} />
      <Page>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          <Kpi label="Назначено" value={list.length} hint={nextDue ? `ближайший срок ${fmtDayMonth(nextDue)}` : "сроки не заданы"} />
          <Kpi label="Завершено" value={mine.length} hint="протоколов прохождения" />
          <Kpi label="Средний балл" value={avg ?? "—"} hint={`по ${scored.length} протоколам`} />
          <Kpi label="Активные сессии" value={active} hint="в работе или на паузе" />
        </div>
        {starter.stage && <Banner tone="blue" icon="spinner">{starter.stage}</Banner>}
        <ErrorBanner error={starter.error} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card padded={false}>
            <div className="p-5 pb-3"><CardTitle aside={<Chip>{active} активных</Chip>}>Назначенные сценарии</CardTitle></div>
            {assignments.isLoading ? <Loading /> : assignments.error ? <div className="p-5"><ErrorBanner error={assignments.error} /></div> : !list.length ? (
              <Empty>Назначений пока нет. Преподаватель назначит сценарии вашей группе.</Empty>
            ) : (
              <Table>
                <thead><tr><th>Сценарий</th><th>Тип</th><th>Срок</th><th>Статус</th><th><span className="sr-only">Действие</span></th></tr></thead>
                <tbody>
                  {list.map((a) => {
                    const st = a.last_session_status ?? "assigned";
                    const resumable = st === "active" || st === "paused" || st === "starting";
                    const busy = starter.pending && starter.variables === a.template.id;
                    return (
                      <tr key={a.id}>
                        <td>
                          <div className="font-semibold">{a.template.title}</div>
                          <div className="text-xs text-muted">лимит {a.template.time_limit_min} мин · подсказок до 3 · {KIND_LABEL[a.template.kind]}</div>
                        </td>
                        <td><Chip tone="blue">{DOMAIN_LABEL[a.template.domain_code] ?? a.template.domain_code}</Chip></td>
                        <td className="font-mono">{fmtDayMonth(a.due_at)}</td>
                        <td>
                          <Chip tone={st === "completed" ? scoreTone(a.last_score) : STATUS[st]?.tone}>
                            {STATUS[st]?.label ?? st}{st === "completed" && a.last_score != null ? ` · ${a.last_score}` : ""}
                          </Chip>
                        </td>
                        <td className="text-right">
                          {resumable ? (
                            <Button onClick={() => navigate(`/student/sessions/${a.last_session_id}`)}>Продолжить</Button>
                          ) : (
                            <Button variant={st === "assigned" ? "primary" : "default"} loading={busy} disabled={starter.pending}
                              onClick={() => starter.start(a.template.id)}>
                              {st === "assigned" ? "Начать" : "Пройти снова"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
          <Card className="flex flex-col gap-4">
            <CardTitle>Рекомендации</CardTitle>
            {domains.length > 1 && (
              <Select aria-label="Направление" value={domain} onChange={(e) => setDomain(e.target.value)}>
                {domains.map((d) => <option key={d} value={d}>{DOMAIN_LABEL[d] ?? d}</option>)}
              </Select>
            )}
            {recs.isLoading ? <Loading /> : recs.error ? <ErrorBanner error={recs.error} /> : !recs.data?.deficits.length ? (
              <p className="m-0 text-sm text-muted">Дефицитов не выявлено: уровни навыков соответствуют требуемым.</p>
            ) : (
              recs.data.deficits.slice(0, 3).map((d) => (
                <div key={d.skill_id} className="border-b border-line-soft pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <b>{d.name}</b><Chip tone={PRIORITY_TONE[d.priority]}>{PRIORITY_LABEL[d.priority]}</Chip>
                  </div>
                  <p className="m-0 mt-1 text-[13px] text-muted">
                    {d.stale && d.gap < 2
                      ? `Не подтверждался ${d.days_since_confirmed ?? "более 30"} дн.`
                      : `Уровень ${d.current_level} из ${d.required_level} требуемого.`}
                    {d.dependents > 0 && ` Предшествует ${d.dependents} навыкам направления.`}
                  </p>
                </div>
              ))
            )}
            {recs.data?.recommendations[0] && (
              <Button variant="primary" icon="target" disabled={starter.pending}
                loading={starter.pending && starter.variables === recs.data.recommendations[0].template_id}
                onClick={() => starter.start(recs.data!.recommendations[0].template_id)}>
                Сгенерировать сценарий по дефициту
              </Button>
            )}
            {recs.data?.recommendations[0] && (
              <p className="m-0 -mt-2 text-xs text-muted">Будет подготовлен вариант сценария «{recs.data.recommendations[0].title}».</p>
            )}
          </Card>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-5">
          <Card className="flex flex-col gap-3">
            <CardTitle aside={<Link to="/student/skills">Все навыки</Link>}>Профиль компетенций</CardTitle>
            {skills.isLoading ? <Loading /> : !domainSkills.length ? <Empty>Профиль ещё не сформирован.</Empty> : domainSkills.slice(0, 6).map((s) => {
              const req = s.required_level ?? s.level_max;
              const tone = s.level >= req ? "green" : req - s.level >= 2 ? "red" : s.outdated ? "amber" : "blue";
              return (
                <div key={s.skill_id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px] items-center gap-4 text-sm">
                  <span className="truncate">{s.name}</span>
                  <Bar value={s.level} max={req} tone={tone} />
                  <span className="text-right font-mono text-muted">{s.level}/{req}</span>
                </div>
              );
            })}
          </Card>
          <Card className="flex flex-col">
            <CardTitle aside={<Link to="/student/reports">Все протоколы</Link>}>Последние протоколы</CardTitle>
            {reports.isLoading ? <Loading /> : !mine.length ? <Empty>Протоколов пока нет.</Empty> : mine.slice(0, 3).map((r) => (
              <Link key={r.id} to={`/student/reports/${r.session_id}`}
                className="flex items-center justify-between gap-3 border-b border-line-soft py-3 !text-ink no-underline last:border-0 hover:bg-bg">
                <span className="truncate">{r.title}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-muted">{fmtDayMonth(r.created_at)}</span>
                  <Chip tone={scoreTone(r.score)}>{r.score ?? "—"}</Chip>
                  <Icon name="back" size={16} className="rotate-180 text-muted" />
                </span>
              </Link>
            ))}
          </Card>
        </div>
      </Page>
    </>
  );
}
