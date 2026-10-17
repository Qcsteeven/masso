import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";
import type { SkillGraph } from "../../api/types";
import { Page, PageHeader } from "../../components/Layout";
import { Banner, Button, Card, CardTitle, ErrorBanner, Filter, Input, Loading, Select, Table } from "../../components/ui";

/** Required levels per direction (track targets) — input for the deficit algorithm. */
export default function Targets() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["skill-graph"], queryFn: () => api.get<SkillGraph>("/api/skills/graph") });
  const [domainSel, setDomain] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const g = q.data;
  const domain = domainSel ?? g?.domains[0]?.code ?? "";
  const save = useMutation({
    mutationFn: () => {
      const current = new Map(g!.targets.filter((t) => t.domain_code === domain).map((t) => [t.skill_id, String(t.required_level)]));
      const merged = { ...Object.fromEntries(current), ...edits };
      const items = Object.entries(merged).filter(([, v]) => v !== "").map(([skill_id, v]) => ({ skill_id, required_level: Number(v) }));
      return api.put("/api/skills/targets", { domain_code: domain, items });
    },
    onSuccess: () => { setEdits({}); qc.invalidateQueries({ queryKey: ["skill-graph"] }); },
  });
  if (q.isLoading) return <Loading />;
  if (!g) return <Page><ErrorBanner error={q.error} /></Page>;
  const target = new Map(g.targets.filter((t) => t.domain_code === domain).map((t) => [t.skill_id, t.required_level]));
  const skills = g.skills.filter((s) => s.domain_code === domain);
  return (
    <>
      <PageHeader title="Целевые уровни" subtitle="Требуемый уровень навыков по направлению подготовки"
        actions={<Filter label="Направление">
          <Select value={domain} onChange={(e) => { setDomain(e.target.value); setEdits({}); }}>
            {g.domains.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </Select>
        </Filter>} />
      <Page>
        <Card padded={false}>
          <div className="p-5 pb-3"><CardTitle aside={<Button variant="primary" loading={save.isPending} disabled={!Object.keys(edits).length} onClick={() => save.mutate()}>Сохранить</Button>}>Навыки направления</CardTitle></div>
          <div className="px-5"><ErrorBanner error={save.error} />{save.isSuccess && <Banner tone="green" icon="check">Целевые уровни сохранены и записаны в журнал аудита.</Banner>}</div>
          <Table>
            <thead><tr><th>Код</th><th>Навык</th><th>Уровень max</th><th>Требуемый уровень</th></tr></thead>
            <tbody>
              {skills.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.code}</td>
                  <td>{s.name}</td>
                  <td>{s.level_max}</td>
                  <td className="w-44">
                    <Input aria-label={`Требуемый уровень: ${s.name}`} type="number" min={0} max={s.level_max} placeholder="не задан"
                      value={edits[s.id] ?? (target.has(s.id) ? String(target.get(s.id)) : "")}
                      onChange={(e) => setEdits({ ...edits, [s.id]: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Page>
    </>
  );
}
