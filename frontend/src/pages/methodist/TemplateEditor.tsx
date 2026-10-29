import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { api } from "../../api/client";
import { ENGINE_LABEL, type SkillGraph, type TemplateFull, type ValidationStep } from "../../api/types";
import { Icon } from "../../components/icons";
import { Page, PageHeader } from "../../components/Layout";
import { Banner, Button, Card, CardTitle, Chip, ErrorBanner, FieldRow, Input, Loading, Select, Table, Textarea, cx } from "../../components/ui";
import { TPL_STATUS } from "./Templates";
import { useDomainLabel } from "../../api/domains";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Spec = Record<string, any>;

const STEP_LABEL: Record<string, string> = {
  select_params: "Подбор параметров варианта",
  generate_legend: "Генерация легенды",
  static_validate: "Спецификация соответствует JSON-схеме и бизнес-правилам",
  dedup: "Близость легенды к опубликованным ниже порога 0,90",
  dynamic_validate: "Динамическая проверка прогоном",
  clean_environment: "Учебная среда запущена, все проверки проходят на чистой среде",
  fault_breaks_checks: "Сбой ломает проверки",
  fix_restores_checks: "Эталонное исправление: все проверки пройдены",
  quotes: "Цитаты эталона присутствуют в документах",
  reference_answer: "Эталонный ответ проходит все проверки",
  empty_answer: "Пустой ответ не проходит проверки",
};
function stepLabel(s: string): string {
  const m = /^incident:([^:]+)(?::(breaks|fix))?$/.exec(s);
  if (m) return m[2] === "breaks" ? `Инцидент ${m[1]}: проверки провалены` : m[2] === "fix" ? `Инцидент ${m[1]}: исправление восстанавливает` : `Инцидент ${m[1]} применим`;
  return STEP_LABEL[s] ?? s;
}

const TABS = ["Легенда", "Навыки", "Сбои и проверки", "Подсказки", "JSON"] as const;

export default function TemplateEditor() {
  const domainLabel = useDomainLabel();
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["template", id], queryFn: () => api.get<TemplateFull>(`/api/scenarios/templates/${id}`) });
  const graph = useQuery({ queryKey: ["skill-graph"], queryFn: () => api.get<SkillGraph>("/api/skills/graph") });
  const [spec, setSpec] = useState<Spec | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Сбои и проверки");
  const [json, setJson] = useState("");
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<TemplateFull | null>(null);
  if (q.data && q.data !== loaded) {
    // reset local edits whenever the server version changes (render-time state reset)
    setLoaded(q.data);
    setSpec(structuredClone(q.data.spec));
    setJson(JSON.stringify(q.data.spec, null, 2));
    setDirty(false);
  }
  const done = (t: TemplateFull) => { qc.setQueryData(["template", id], t); qc.invalidateQueries({ queryKey: ["templates"] }); };
  const save = useMutation({ mutationFn: () => api.patch<TemplateFull>(`/api/scenarios/templates/${id}`, { spec }), onSuccess: done });
  const validate = useMutation({ mutationFn: () => api.post<TemplateFull>(`/api/scenarios/templates/${id}/validate`), onSuccess: done });
  const publish = useMutation({ mutationFn: () => api.post<TemplateFull>(`/api/scenarios/templates/${id}/publish`), onSuccess: done });
  const archive = useMutation({ mutationFn: () => api.post<TemplateFull>(`/api/scenarios/templates/${id}/archive`), onSuccess: done });

  if (q.isLoading || !spec) return q.error ? <Page><ErrorBanner error={q.error} /></Page> : <Loading text="Загрузка шаблона…" />;
  const t = q.data!;
  const upd = (fn: (s: Spec) => void) => { const n = structuredClone(spec); fn(n); setSpec(n); setJson(JSON.stringify(n, null, 2)); setDirty(true); };
  const container = spec.kind === "container";
  const rep = t.validation_report;
  const repCurrent = rep && rep.version === t.version;
  const busy = save.isPending || validate.isPending || publish.isPending;
  const inc = (spec.incidents ?? [])[0];
  const faultUse = (fid: string) => (spec.faults?.initial ?? []).includes(fid) ? "при запуске" : (spec.incidents ?? []).some((i: any) => i.fault === fid) ? "инцидент" : "резерв";

  return (
    <>
      <PageHeader crumbs={<><Link to="/methodist/templates">Шаблоны</Link> · <span className="font-mono">{t.code}</span> · версия {t.version}</>} title={String(spec.title)}
        actions={<>
          <Chip tone={TPL_STATUS[t.status].tone}>{TPL_STATUS[t.status].label}</Chip>
          {dirty && <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Сохранить</Button>}
          <Button loading={validate.isPending} disabled={busy || dirty} onClick={() => validate.mutate()}>Валидировать прогоном</Button>
          {t.status !== "published"
            ? <Button variant="primary" loading={publish.isPending} disabled={busy || dirty || !repCurrent || rep?.status !== "published"} onClick={() => publish.mutate()}>Опубликовать</Button>
            : <Button variant="danger" loading={archive.isPending} onClick={() => archive.mutate()}>В архив</Button>}
        </>} />
      <Page>
        <ErrorBanner error={save.error || validate.error || publish.error || archive.error} />
        {validate.isPending && <Banner tone="blue" icon="spinner">Валидация прогоном: генерация варианта, запуск учебной среды, применение сбоев и эталонных исправлений… Это может занять до двух минут.</Banner>}
        {dirty && <Banner tone="amber" icon="info">Есть несохранённые изменения. После сохранения версия увеличится и потребуется повторная валидация.</Banner>}
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card className="grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
              <FieldRow label="Движок">{(i) => <Input id={i} readOnly value={ENGINE_LABEL[spec.kind] ?? spec.kind} />}</FieldRow>
              <FieldRow label="Сложность">{(i) => <Select id={i} value={spec.difficulty} onChange={(e) => upd((s) => (s.difficulty = Number(e.target.value)))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} из 5</option>)}</Select>}</FieldRow>
              <FieldRow label="Лимит времени, мин">{(i) => <Input id={i} type="number" min={5} max={240} value={spec.time_limit_min} onChange={(e) => upd((s) => (s.time_limit_min = Number(e.target.value)))} />}</FieldRow>
              <FieldRow label="Профиль песочницы">{(i) => <Input id={i} value={spec.profile ?? "document"} readOnly={!container} onChange={(e) => upd((s) => (s.profile = e.target.value))} />}</FieldRow>
              <FieldRow label="Порог зачёта">{(i) => <Input id={i} type="number" min={1} max={100} value={spec.success?.threshold ?? 75} onChange={(e) => upd((s) => (s.success = { threshold: Number(e.target.value) }))} />}</FieldRow>
              <FieldRow label="Инцидент">{(i) => <Input id={i} readOnly value={inc ? `через ${inc.after_min[0]}–${inc.after_min[1]} мин после старта` : "нет"} />}</FieldRow>
            </Card>
            <Card padded={false}>
              <div role="tablist" className="flex flex-wrap gap-1 border-b border-line px-4">
                {TABS.map((x) => (
                  <button key={x} type="button" role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
                    className={cx("-mb-px min-h-12 border-b-2 px-4 text-sm", tab === x ? "border-accent font-semibold text-accent" : "border-transparent text-muted hover:text-ink")}>{x}</button>
                ))}
              </div>
              <div role="tabpanel" className="flex flex-col gap-4 py-4">
                {tab === "Легенда" && (
                  <div className="flex flex-col gap-3 px-5">
                    <FieldRow label="Название" required>{(i) => <Input id={i} value={spec.title} onChange={(e) => upd((s) => (s.title = e.target.value))} />}</FieldRow>
                    <FieldRow label="Шаблон легенды" required top>{(i) => <Textarea id={i} rows={6} value={spec.legend.template} onChange={(e) => upd((s) => (s.legend.template = e.target.value))} />}</FieldRow>
                    <FieldRow label="Указания для LLM" top>{(i) => <Textarea id={i} rows={3} value={spec.legend.brief ?? ""} onChange={(e) => upd((s) => (s.legend.brief = e.target.value))} />}</FieldRow>
                    <FieldRow label="Ограничения среды" top>{(i) => <Textarea id={i} rows={2} value={spec.constraints ?? ""} onChange={(e) => upd((s) => (s.constraints = e.target.value))} />}</FieldRow>
                    {Object.keys(spec.params ?? {}).length > 0 && (
                      <div className="text-sm"><div className="mb-1 font-semibold">Параметры варианта</div>
                        {Object.entries(spec.params).map(([k, v]) => <div key={k}><code className="font-mono text-xs">{`{${k}}`}</code>: {(v as unknown[]).map(String).join(" · ")}</div>)}
                      </div>
                    )}
                  </div>
                )}
                {tab === "Навыки" && (
                  <div className="flex flex-col gap-3 px-5">
                    {(spec.target_skills as { skill: string; weight: number }[]).map((ts, i) => (
                      <div key={i} className="grid grid-cols-[minmax(0,1fr)_100px_44px] items-center gap-2">
                        <Select aria-label="Навык" value={ts.skill} onChange={(e) => upd((s) => (s.target_skills[i].skill = e.target.value))}>
                          {(graph.data?.skills ?? []).filter((x) => x.domain_code === spec.domain || x.code === ts.skill).map((x) => <option key={x.id} value={x.code}>{x.code} · {x.name}</option>)}
                        </Select>
                        <Input aria-label="Вес" type="number" step={0.1} min={0.1} max={1} value={ts.weight} onChange={(e) => upd((s) => (s.target_skills[i].weight = Number(e.target.value)))} />
                        <Button small aria-label="Удалить навык" disabled={spec.target_skills.length < 2} onClick={() => upd((s) => s.target_skills.splice(i, 1))}>×</Button>
                      </div>
                    ))}
                    <Button className="self-start" onClick={() => upd((s) => s.target_skills.push({ skill: graph.data?.skills.find((x) => x.domain_code === spec.domain)?.code ?? "", weight: 0.5 }))}>+ Навык</Button>
                    <p className="m-0 text-xs text-muted">Направление: {domainLabel(spec.domain)}. Навыки обновляются в профиле обучающегося после проверки.</p>
                  </div>
                )}
                {tab === "Сбои и проверки" && (
                  <>
                    {container ? (
                      <>
                        <div className="px-5"><CardTitle aside={<span className="text-xs text-muted">скрыто от обучающегося</span>}>Каталог сбоев</CardTitle></div>
                        <Table>
                          <thead><tr><th>Сбой</th><th>Когда</th><th>Описание</th></tr></thead>
                          <tbody>{Object.entries(spec.faults.catalog as Record<string, { description?: string }>).map(([fid, f]) => (
                            <tr key={fid}><td><code className="rounded bg-grey-bg px-1.5 font-mono text-xs">{fid}</code></td><td>{faultUse(fid)}</td><td>{f.description || "—"}</td></tr>
                          ))}</tbody>
                        </Table>
                      </>
                    ) : (
                      <div className="px-5"><Banner tone="grey" icon="info">Документный сценарий: документы, дефекты и эталонные ответы строит генератор <code className="font-mono">{spec.builder || spec.generator}</code>; ключ ответов скрыт от обучающегося.</Banner></div>
                    )}
                    <div className="px-5 pt-2"><CardTitle>Проверки</CardTitle></div>
                    <Table>
                      <thead><tr><th>Код</th><th>Критерий</th><th>Тип</th><th>Вес</th><th>Критичная</th></tr></thead>
                      <tbody>{(spec.checks as any[]).map((c, i) => (
                        <tr key={c.id}>
                          <td className="font-mono text-xs">{c.id}</td>
                          <td><Input aria-label={`Критерий ${c.id}`} className="!h-9" value={c.title} onChange={(e) => upd((s) => (s.checks[i].title = e.target.value))} /></td>
                          <td className="font-mono text-xs">{c.type}</td>
                          <td className="w-24"><Input aria-label={`Вес ${c.id}`} className="!h-9" type="number" min={1} value={c.weight} onChange={(e) => upd((s) => (s.checks[i].weight = Number(e.target.value)))} /></td>
                          <td><button type="button" onClick={() => upd((s) => (s.checks[i].critical = !c.critical))} aria-pressed={!!c.critical}><Chip tone={c.critical ? "red" : "grey"}>{c.critical ? "да" : "нет"}</Chip></button></td>
                        </tr>
                      ))}</tbody>
                    </Table>
                    <p className="m-0 px-5 text-xs text-muted">Параметры проверок и скрипты сбоев редактируются на вкладке JSON.</p>
                  </>
                )}
                {tab === "Подсказки" && (
                  <div className="flex flex-col gap-3 px-5">
                    <FieldRow label="Политика">{(i) => <Select id={i} value={spec.hints.policy} onChange={(e) => upd((s) => (s.hints.policy = e.target.value))}>
                      <option value="limited_3">не более 3, −10 % за каждую</option><option value="teacher_allowed">по разрешению преподавателя</option><option value="none">без подсказок</option>
                    </Select>}</FieldRow>
                    {[0, 1, 2].map((n) => (
                      <FieldRow key={n} label={`Ступень ${n + 1}`} top>{(i) => <Textarea id={i} rows={2} value={spec.hints.ladder[n] ?? ""} onChange={(e) => upd((s) => (s.hints.ladder[n] = e.target.value))} />}</FieldRow>
                    ))}
                    <p className="m-0 text-xs text-muted">Подсказки не должны содержать команд из эталонных исправлений — это проверяется при валидации и при выдаче.</p>
                  </div>
                )}
                {tab === "JSON" && (
                  <div className="flex flex-col gap-3 px-5">
                    <Textarea aria-label="Спецификация JSON" rows={24} spellCheck={false} className="font-mono text-xs" value={json} onChange={(e) => { setJson(e.target.value); setJsonErr(null); }} />
                    {jsonErr && <Banner tone="red" icon="alert" role="alert">{jsonErr}</Banner>}
                    <Button className="self-end" onClick={() => { try { setSpec(JSON.parse(json)); setDirty(true); } catch (e) { setJsonErr(`Некорректный JSON: ${(e as Error).message}`); } }}>Применить JSON</Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
          <Card className="flex flex-col gap-3">
            <CardTitle aside={rep && <Chip tone={rep.status === "published" ? (repCurrent ? "green" : "amber") : "red"}>
              {rep.status === "published" ? (repCurrent ? (rep.duration_ms == null ? "пройдена" : `пройдена · ${Math.round(rep.duration_ms / 1000)} с`) : `устарела (v${rep.version})`) : "не пройдена"}
            </Chip>}>Отчёт валидации</CardTitle>
            {!rep ? <p className="m-0 text-sm text-muted">Валидация ещё не выполнялась. Публикация доступна только после успешного прогона текущей версии.</p> : (
              <ol className="m-0 flex list-none flex-col p-0">
                {rep.steps.map((s: ValidationStep, i: number) => (
                  <li key={i} className="flex gap-3 border-b border-line-soft py-2.5 text-sm last:border-0">
                    <Icon name={s.ok ? "check" : "x"} size={18} className={cx("mt-0.5 shrink-0", s.ok ? "text-green" : "text-red-ink")} />
                    <div className="min-w-0 flex-1"><div>{stepLabel(s.step)}</div><div className="text-xs text-muted">{s.detail}</div></div>
                    {s.duration_ms != null && <span className="font-mono text-xs text-muted">{(s.duration_ms / 1000).toFixed(1).replace(".", ",")} с</span>}
                  </li>
                ))}
              </ol>
            )}
            {rep?.errors?.length ? <Banner tone="red" icon="alert">{rep.errors.join("; ")}</Banner> : null}
            <pre className="m-0 overflow-auto rounded-2xl bg-term p-4 font-mono text-xs leading-relaxed text-term-ink">{JSON.stringify({
              engine: spec.kind, ...(container ? { profile: spec.profile, faults: Object.keys(spec.faults.catalog) } : { builder: spec.builder }),
              checks: spec.checks.length, incidents: (spec.incidents ?? []).length, hints_max: spec.hints.policy === "none" ? 0 : 3, threshold: spec.success?.threshold ?? 75,
            }, null, 2)}</pre>
          </Card>
        </div>
      </Page>
    </>
  );
}
