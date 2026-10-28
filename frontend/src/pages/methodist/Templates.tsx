import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../../api/client";
import { KIND_LABEL, type TemplateBrief, type TemplateFull } from "../../api/types";
import { Page, PageHeader } from "../../components/Layout";
import { Button, Card, Chip, Empty, ErrorBanner, FieldRow, Filter, Input, Loading, Select, Table, fmtDate, type Tone } from "../../components/ui";
import { useDomainLabel, useDomains } from "../../api/domains";

export const TPL_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "черновик", tone: "amber" },
  published: { label: "опубликован", tone: "green" },
  archived: { label: "в архиве", tone: "grey" },
};

export default function Templates() {
  const domainLabel = useDomainLabel();
  const domainList = useDomains();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [domain, setDomain] = useState("");
  const q = useQuery({ queryKey: ["templates", domain], queryFn: () => api.get<TemplateBrief[]>("/api/scenarios/templates", { domain }) });
  const dlg = useRef<HTMLDialogElement>(null);
  const [base, setBase] = useState("");
  const [code, setCode] = useState("");
  const copy = useMutation({
    mutationFn: async () => {
      const src = await api.get<TemplateFull>(`/api/scenarios/templates/${base}`);
      const spec = { ...src.spec, code, version: 1, title: `${String(src.spec.title)} (копия)` };
      return api.post<TemplateFull>("/api/scenarios/templates", { spec });
    },
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ["templates"] }); navigate(`/methodist/templates/${t.id}`); },
  });
  return (
    <>
      <PageHeader title="Шаблоны сценариев" subtitle="Спецификации сценариев, валидация прогоном и публикация"
        actions={<>
          <Filter label="Направление">
            <Select value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="">Все направления</option>
              {(domainList.data ?? []).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </Select>
          </Filter>
          <Button variant="primary" className="self-end" onClick={() => dlg.current?.showModal()}>+ Шаблон</Button>
        </>} />
      <Page>
        <Card padded={false}>
          {q.isLoading ? <Loading /> : q.error ? <div className="p-5"><ErrorBanner error={q.error} /></div> : !q.data?.length ? <Empty>Шаблонов нет.</Empty> : (
            <Table>
              <thead><tr><th>Шаблон</th><th>Направление</th><th>Движок</th><th>Версия</th><th>Сложность</th><th>Статус</th><th>Валидация</th><th>Опубликован</th></tr></thead>
              <tbody>
                {q.data.map((t) => (
                  <tr key={t.id}>
                    <td><Link to={`/methodist/templates/${t.id}`} className="font-medium">{t.title}</Link><div className="font-mono text-xs text-muted">{t.code}</div></td>
                    <td>{domainLabel(t.domain_code)}</td>
                    <td>{KIND_LABEL[t.kind]}</td>
                    <td>v{t.version}</td>
                    <td>{t.difficulty} из 5</td>
                    <td><Chip tone={TPL_STATUS[t.status].tone}>{TPL_STATUS[t.status].label}</Chip></td>
                    <td><Chip tone={t.validated ? "green" : "grey"}>{t.validated ? "пройдена" : "нет"}</Chip></td>
                    <td className="font-mono">{fmtDate(t.published_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Page>
      <dialog ref={dlg} aria-labelledby="new-tpl" className="m-auto w-[min(94vw,560px)] rounded-card border border-line p-0 backdrop:bg-black/40">
        <form className="flex flex-col gap-4 p-6" onSubmit={(e) => { e.preventDefault(); copy.mutate(); }}>
          <h2 id="new-tpl" className="m-0 text-lg font-semibold">Новый шаблон</h2>
          <p className="m-0 text-sm text-muted">Новый шаблон создаётся на основе существующего: затем отредактируйте спецификацию и выполните валидацию прогоном.</p>
          <FieldRow label="На основе" required>
            {(id) => <Select id={id} required value={base} onChange={(e) => setBase(e.target.value)}>
              <option value="">— шаблон —</option>
              {(q.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>}
          </FieldRow>
          <FieldRow label="Код нового шаблона" required>
            {(id) => <Input id={id} required pattern="[a-z0-9_]+" title="латиница в нижнем регистре, цифры и _" placeholder="new_scenario" value={code} onChange={(e) => setCode(e.target.value)} />}
          </FieldRow>
          <ErrorBanner error={copy.error} />
          <div className="flex justify-end gap-2.5">
            <Button onClick={() => dlg.current?.close()}>Отмена</Button>
            <Button type="submit" variant="primary" loading={copy.isPending}>Создать</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
