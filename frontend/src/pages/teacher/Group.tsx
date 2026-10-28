import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, download } from "../../api/client";
import { DOMAIN_LABEL, REVIEW_LABEL, REVIEW_TONE, type GroupOverview } from "../../api/types";
import { Page, PageHeader, UserBadge } from "../../components/Layout";
import { defaultPeriod, periodError, periodQuery, type Period } from "../../components/period";
import { Banner, Bar, Button, Card, CardTitle, Chip, Empty, ErrorBanner, Filter, Input, Kpi, Loading, Select, Table } from "../../components/ui";

interface Filters extends Period { group: string; domain: string }

export function useGroups() {
  return useQuery({ queryKey: ["groups"], queryFn: () => api.get<string[]>("/api/reports/groups/list") });
}

const dm = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) : "—");

/** Sessions of the period: the whole row opens the digital trace; the «Открыть» link keeps it keyboard-reachable. */
export function SessionsTable({ sessions }: { sessions: GroupOverview["sessions"] }) {
  const navigate = useNavigate();
  return (
    <Table>
      <thead><tr><th>Обучающийся</th><th>Сценарий</th><th>Дата</th><th>Авто</th><th>Эксперт</th><th>Статус оценки</th><th><span className="sr-only">Цифровой след</span></th></tr></thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.session_id} className="cursor-pointer hover:bg-bg" onClick={() => navigate(`/teacher/sessions/${s.session_id}`)}>
            <td>{s.student}</td>
            <td>{s.title}</td>
            <td className="font-mono">{dm(s.finished_at)}</td>
            <td>{s.auto_score}</td>
            <td>{s.expert_score ?? "—"}</td>
            <td><Chip tone={REVIEW_TONE[s.review_status]}>{REVIEW_LABEL[s.review_status]}</Chip></td>
            <td><Link to={`/teacher/sessions/${s.session_id}`} aria-label={`Открыть цифровой след: ${s.student}`} onClick={(e) => e.stopPropagation()}>Открыть</Link></td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default function Group() {
  const navigate = useNavigate();
  const groups = useGroups();
  const initial: Filters = { ...defaultPeriod(), group: "", domain: "" };
  const [draft, setDraft] = useState<Filters>(initial);
  const [applied, setApplied] = useState<Filters>(initial);
  const group = applied.group || groups.data?.[0] || "";
  const invalid = periodError(applied);
  const q = useQuery({
    queryKey: ["group-overview", applied, group],
    queryFn: () => api.get<GroupOverview>("/api/reports", { group, domain: applied.domain, ...periodQuery(applied) }),
    enabled: !invalid && !!groups.data,
  });
  const csv = useMutation({
    mutationFn: () => download("/api/reports/export", { group, format: "csv", ...periodQuery(applied) }, `masso-${group}-${applied.from}-${applied.to}.csv`),
  });
  const set = (k: keyof Filters) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });
  const d = q.data;

  return (
    <>
      <PageHeader title="Панель группы" subtitle="Результаты сессий, проблемные навыки и расхождения оценок" actions={<UserBadge />} />
      <Page>
        <Card>
          <form className="flex flex-wrap items-end gap-4" onSubmit={(e) => { e.preventDefault(); setApplied(draft); }}>
            <Filter label="Группа">
              <Select className="min-w-44" value={draft.group || group} onChange={set("group")}>
                {(groups.data ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            </Filter>
            <Filter label="Направление">
              <Select className="min-w-52" value={draft.domain} onChange={set("domain")}>
                <option value="">Все направления</option>
                {Object.entries(DOMAIN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Filter>
            <Filter label="Дата начала *"><Input type="date" required value={draft.from} onChange={set("from")} /></Filter>
            <Filter label="Дата окончания *"><Input type="date" required value={draft.to} onChange={set("to")} /></Filter>
            <div className="ml-auto flex gap-2.5">
              <Button onClick={() => { setDraft(initial); setApplied(initial); }}>Сбросить</Button>
              <Button type="submit" variant="primary">Применить</Button>
            </div>
          </form>
        </Card>
        {invalid && <Banner tone="red" icon="alert" role="alert">{invalid}</Banner>}
        <ErrorBanner error={q.error || groups.error} />
        {q.isLoading && <Loading text="Формирование отчёта…" />}
        {d && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              <Kpi label="Завершённых сессий" value={d.kpi.sessions} hint={`${d.kpi.students} обучающихся`} />
              <Kpi label="Средний балл" value={d.kpi.avg_score ?? "—"} hint={`медиана ${d.kpi.median_score ?? "—"}`} />
              <Kpi label="Подсказок на сессию" value={d.kpi.hints_per_session.toLocaleString("ru-RU")} hint="лимит 3" />
              <Kpi label="Ждут решения" value={d.kpi.pending_review} hint="авто-оценка не подтверждена" danger={d.kpi.pending_review > 0} />
            </div>
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card padded={false}>
                <div className="p-5 pb-3">
                  <CardTitle aside={<Button small icon="download" loading={csv.isPending} onClick={() => csv.mutate()}>CSV</Button>}>Сессии за период</CardTitle>
                </div>
                <ErrorBanner error={csv.error} />
                {!d.sessions.length ? <Empty>За выбранный период завершённых сессий нет.</Empty> : (
                  <SessionsTable sessions={d.sessions} />
                )}
              </Card>
              <Card className="flex flex-col gap-3">
                <CardTitle>Проблемные навыки</CardTitle>
                <p className="m-0 text-[13px] text-muted">Доля непройденных проверок по навыку</p>
                {!d.problem_skills.length && <p className="m-0 text-sm text-muted">Нет данных за период.</p>}
                {d.problem_skills.map((p) => (
                  <div key={p.skill_id} className="grid grid-cols-[minmax(0,1fr)_110px_40px] items-center gap-3 text-sm">
                    <span className="truncate" title={p.name}>{p.name}</span>
                    <Bar value={p.fail_percent} tone={p.fail_percent >= 50 ? "red" : p.fail_percent >= 25 ? "amber" : "blue"} />
                    <span className="text-right font-mono text-muted">{p.fail_percent}%</span>
                  </div>
                ))}
                <Button className="mt-2" onClick={() => navigate(`/teacher/assignments?group=${encodeURIComponent(group)}`)}>Назначить сценарий группе</Button>
              </Card>
            </div>
          </>
        )}
      </Page>
    </>
  );
}
