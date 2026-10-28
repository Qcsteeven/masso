import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../../api/client";
import { PRIORITY_LABEL, type Assignment, type MySkill, type Recommendations, type SkillGraph } from "../../api/types";
import { Page, PageHeader } from "../../components/Layout";
import { Bar, Card, CardTitle, Chip, Empty, ErrorBanner, Filter, Loading, Select, Table, fmtDate } from "../../components/ui";
import { PRIORITY_TONE } from "./Home";
import { SkillMap } from "./SkillMap";
import { useDomainLabel } from "../../api/domains";

export default function Skills() {
  const domainLabel = useDomainLabel();
  const skills = useQuery({ queryKey: ["skills-me"], queryFn: () => api.get<MySkill[]>("/api/skills/me") });
  const assignments = useQuery({ queryKey: ["assignments-me"], queryFn: () => api.get<Assignment[]>("/api/scenarios/assignments/me") });
  // the student's assigned directions first (as on «Мои назначения»), then the rest of the profile
  const domains = useMemo(() => [...new Set([
    ...(assignments.data ?? []).map((a) => a.template.domain_code),
    ...(skills.data ?? []).map((s) => s.domain_code),
  ])], [assignments.data, skills.data]);
  const [sel, setSel] = useState<string | null>(null);
  const domain = sel ?? domains[0] ?? "devops";
  const recs = useQuery({
    queryKey: ["recommendations", domain],
    queryFn: () => api.get<Recommendations>("/api/skills/recommendations", { domain }),
    enabled: !!domain,
  });
  const graph = useQuery({ queryKey: ["skills-graph", domain], queryFn: () => api.get<SkillGraph>("/api/skills/graph", { domain }), enabled: !!domain });
  const deficits = new Map((recs.data?.deficits ?? []).map((d) => [d.skill_id, d]));
  const rows = (skills.data ?? []).filter((s) => s.domain_code === domain);

  return (
    <>
      <PageHeader title="Мои навыки" subtitle="Карта компетенций направления: что освоено, что изучается и куда двигаться дальше"
        actions={domains.length > 1 && (
          <Filter label="Направление">
            <Select value={domain} onChange={(e) => setSel(e.target.value)}>
              {domains.map((d) => <option key={d} value={d}>{domainLabel(d)}</option>)}
            </Select>
          </Filter>
        )} />
      <Page>
        {graph.error && <ErrorBanner error={graph.error} />}
        {graph.data && skills.data && <SkillMap graph={graph.data} skills={skills.data} deficits={recs.data?.deficits ?? []} domain={domain} />}
        <Card padded={false}>
          <div className="p-5 pb-3"><CardTitle>Подробно: {domainLabel(domain)}</CardTitle></div>
          {skills.isLoading ? <Loading /> : skills.error ? <div className="p-5"><ErrorBanner error={skills.error} /></div> : !rows.length ? (
            <Empty>Профиль ещё не сформирован.</Empty>
          ) : (
            <Table>
              <thead><tr><th>Навык</th><th className="w-[28%]">Уровень</th><th>Требуется</th><th>Подтверждён</th><th>Серия</th><th>Дефицит</th></tr></thead>
              <tbody>
                {rows.map((s) => {
                  const d = deficits.get(s.skill_id);
                  const req = s.required_level ?? s.level_max;
                  return (
                    <tr key={s.skill_id}>
                      <td><div className="font-medium">{s.name}</div><div className="font-mono text-xs text-muted">{s.code}</div></td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex-1"><Bar value={s.level} max={s.level_max} tone={s.level >= req ? "green" : s.level > 0 ? "amber" : "blue"} /></div>
                          <span className="font-mono text-muted">{s.level}/{s.level_max}</span>
                        </div>
                      </td>
                      <td>{s.required_level ?? "—"}</td>
                      <td>{fmtDate(s.last_confirmed)} {s.outdated && <Chip tone="amber">устарел</Chip>}</td>
                      <td>{s.success_streak} из 3</td>
                      <td>{d ? <Chip tone={PRIORITY_TONE[d.priority]}>{PRIORITY_LABEL[d.priority]}</Chip> : <span className="text-muted">нет</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
        <p className="m-0 text-xs text-muted">
          Уровень повышается после трёх успешных прохождений подряд. Дефицит — разрыв с требуемым уровнем от двух или навык не подтверждался более 30 дней.
        </p>
      </Page>
    </>
  );
}
