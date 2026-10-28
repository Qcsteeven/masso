import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { api } from "../../api/client";
import { KIND_LABEL, type Assignment, type TemplateBrief } from "../../api/types";
import { Page, PageHeader } from "../../components/Layout";
import { Banner, Button, Card, CardTitle, Chip, Empty, ErrorBanner, FieldRow, Input, Loading, Select, Table, fmtDate } from "../../components/ui";
import { useGroups } from "./Group";
import { useDomainLabel } from "../../api/domains";

export default function Assignments() {
  const domainLabel = useDomainLabel();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const groups = useGroups();
  const [groupSel, setGroup] = useState(params.get("group") ?? "");
  const group = groupSel || groups.data?.[0] || "";
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => api.get<TemplateBrief[]>("/api/scenarios/templates") });
  const list = useQuery({
    queryKey: ["assignments", group],
    queryFn: () => api.get<Assignment[]>("/api/scenarios/assignments", { group }),
    enabled: !!group,
  });
  const published = (templates.data ?? []).filter((t) => t.status === "published");
  const [tpl, setTpl] = useState("");
  const [due, setDue] = useState("");
  const create = useMutation({
    mutationFn: () => api.post<Assignment>("/api/scenarios/assignments", {
      template_id: tpl, group_code: group, due_at: due ? new Date(`${due}T23:59:00`).toISOString() : null,
    }),
    onSuccess: () => { setTpl(""); setDue(""); qc.invalidateQueries({ queryKey: ["assignments", group] }); },
  });

  return (
    <>
      <PageHeader title="Назначения" subtitle="Сценарии, назначенные группе" />
      <Page>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
          <Card padded={false}>
            <div className="p-5 pb-3">
              <CardTitle aside={
                <Select aria-label="Группа" className="!h-9 !w-auto" value={group} onChange={(e) => setGroup(e.target.value)}>
                  {(groups.data ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
                </Select>
              }>Назначенные сценарии</CardTitle>
            </div>
            <ErrorBanner error={list.error || groups.error} />
            {list.isLoading ? <Loading /> : !list.data?.length ? <Empty>Группе пока ничего не назначено.</Empty> : (
              <Table>
                <thead><tr><th>Сценарий</th><th>Направление</th><th>Тип</th><th>Срок</th><th>Назначен</th></tr></thead>
                <tbody>
                  {list.data.map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium">{a.template.title}</td>
                      <td><Chip tone="blue">{domainLabel(a.template.domain_code)}</Chip></td>
                      <td>{KIND_LABEL[a.template.kind]}</td>
                      <td className="font-mono">{fmtDate(a.due_at)}</td>
                      <td className="font-mono">{fmtDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card>
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <CardTitle>Новое назначение</CardTitle>
              <FieldRow label="Группа" required>{(id) => <Input id={id} value={group} readOnly />}</FieldRow>
              <FieldRow label="Сценарий" required>
                {(id) => (
                  <Select id={id} required value={tpl} onChange={(e) => setTpl(e.target.value)}>
                    <option value="">— выберите сценарий —</option>
                    {published.map((t) => <option key={t.id} value={t.id}>{t.title} · v{t.version}</option>)}
                  </Select>
                )}
              </FieldRow>
              <FieldRow label="Срок выполнения">{(id) => <Input id={id} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}</FieldRow>
              <ErrorBanner error={create.error} />
              {create.isSuccess && <Banner tone="green" icon="check">Сценарий назначен группе {group}.</Banner>}
              <Button type="submit" variant="primary" className="self-end" disabled={!tpl || !group} loading={create.isPending}>Назначить</Button>
              <p className="m-0 text-xs text-muted">Каждый обучающийся получит собственный вариант сценария при запуске. Назначение записывается в журнал аудита.</p>
            </form>
          </Card>
        </div>
      </Page>
    </>
  );
}
