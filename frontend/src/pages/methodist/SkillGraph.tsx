import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Background, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, applyNodeChanges, useReactFlow,
  type Edge, type Node, type NodeChange, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/client";
import { SKILL_STATUS_LABEL, type SkillGraph as Graph, type SkillNode, type SkillStatus } from "../../api/types";
import { Page, PageHeader } from "../../components/Layout";
import { Banner, Button, Card, CardTitle, Chip, Empty, ErrorBanner, FieldRow, Input, Loading, Select, Textarea, cx } from "../../components/ui";
import { layeredLayout } from "./layout";
import { useTheme } from "../../theme";
import { Markdown } from "../../components/Markdown";
import type { DomainInfo } from "../../api/domains";

type SkillData = { skill: SkillNode; selected: boolean };

function SkillCard({ data }: NodeProps<Node<SkillData>>) {
  const s = data.skill;
  return (
    <div className={cx("w-[200px] rounded-2xl border bg-surface px-3.5 py-2.5 text-left shadow-card transition-shadow",
      data.selected ? "border-2 border-accent ring-4 ring-amber-bg" : "border-line")}>
      <Handle type="target" position={Position.Top} className="!bg-muted" />
      <div className="font-mono text-[11px] text-muted">{s.code}</div>
      <div className="text-[13px] font-semibold leading-tight">{s.name}</div>
      {(s.status !== "active" || s.dependents > 3) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {s.status !== "active" && <Chip tone={s.status === "draft" ? "amber" : "grey"} className="!h-5 !text-[11px]">{SKILL_STATUS_LABEL[s.status]}</Chip>}
          {s.dependents > 3 && <Chip tone="red" className="!h-5 !text-[11px]">{s.dependents} зависимых</Chip>}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted" />
    </div>
  );
}
const nodeTypes = { skill: SkillCard };

interface Draft { id: string | null; code: string; name: string; description: string; theory: string; domain_code: string; level_max: number; status: SkillStatus; requires: { skill_id: string; weight: number }[] }

function GraphCanvas({ graph, domain, selected, onSelect, relayout }: { graph: Graph; domain: string; selected: string | null; onSelect: (id: string) => void; relayout: number }) {
  const [theme] = useTheme();
  const rf = useReactFlow();
  const skills = useMemo(() => graph.skills.filter((s) => s.domain_code === domain), [graph, domain]);
  const ids = useMemo(() => new Set(skills.map((s) => s.id)), [skills]);
  const edgesIn = useMemo(() => graph.edges.filter((e) => ids.has(e.skill_id) && ids.has(e.requires_skill_id)), [graph, ids]);
  const layout = () => {
    const pos = layeredLayout(skills.map((s) => s.id), edgesIn.map((e) => ({ from: e.requires_skill_id, to: e.skill_id })));
    return skills.map((s): Node<SkillData> => ({ id: s.id, type: "skill", position: pos[s.id], data: { skill: s, selected: false } }));
  };
  const [nodes, setNodes] = useState<Node<SkillData>[]>(layout);
  const [basis, setBasis] = useState({ skills, edgesIn, relayout });
  if (basis.skills !== skills || basis.edgesIn !== edgesIn || basis.relayout !== relayout) {
    setBasis({ skills, edgesIn, relayout });
    setNodes(layout());
  }
  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.1, minZoom: 0.7, maxZoom: 1 }), 50);
    return () => clearTimeout(t);
  }, [basis, rf]);
  const shown = nodes.map((n) => ({ ...n, data: { ...n.data, selected: n.id === selected } }));
  const edges: Edge[] = edgesIn.map((e) => ({
    id: `${e.requires_skill_id}-${e.skill_id}`, source: e.requires_skill_id, target: e.skill_id, type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: e.skill_id === selected ? "var(--color-accent)" : "var(--color-muted)" },
    label: e.skill_id === selected || e.requires_skill_id === selected ? e.weight.toFixed(1).replace(".", ",") : undefined,
    style: { stroke: e.skill_id === selected ? "var(--color-accent)" : "var(--color-muted)", strokeWidth: e.skill_id === selected ? 2 : 1.25 },
    labelStyle: { fill: "var(--color-amber-ink)", fontFamily: "IBM Plex Mono", fontSize: 12 },
    labelBgStyle: { fill: "var(--color-surface)" },
  }));
  return (
    <div className="h-[600px]">
      <ReactFlow colorMode={theme} nodes={shown} edges={edges} nodeTypes={nodeTypes} minZoom={0.2} fitView fitViewOptions={{ minZoom: 0.7, maxZoom: 1 }} proOptions={{ hideAttribution: true }}
        onNodesChange={(ch: NodeChange<Node<SkillData>>[]) => setNodes((ns) => applyNodeChanges(ch, ns))}
        onNodeClick={(_, n) => onSelect(n.id)} nodesConnectable={false}>
        <Background gap={16} color="var(--color-field)" />
      </ReactFlow>
    </div>
  );
}

/** Theory for students (Markdown): shown on the skill map, in the workspace and in the report. */
function TheoryField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="skill-theory" className="text-xs font-medium text-muted">Теория (Markdown)</label>
        <Button small variant="ghost" onClick={() => setPreview((p) => !p)}>{preview ? "Редактировать" : "Предпросмотр"}</Button>
      </div>
      {preview
        ? <div className="max-h-80 overflow-auto rounded-xl bg-sunken p-3 text-sm">{value.trim() ? <Markdown source={value} /> : <span className="text-muted">Теория не заполнена.</span>}</div>
        : <Textarea id="skill-theory" rows={8} className="font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)}
            placeholder={"Кратко: что это, ключевые понятия, команды или признаки, типичные ошибки.\n#### Заголовок, - список, `код`, **важно**"} />}
    </div>
  );
}

function ZoomButtons({ onRelayout }: { onRelayout: () => void }) {
  const rf = useReactFlow();
  return (
    <div className="flex gap-2">
      <Button small aria-label="Уменьшить" onClick={() => rf.zoomOut()}>−</Button>
      <Button small aria-label="Увеличить" onClick={() => rf.zoomIn()}>+</Button>
      <Button small onClick={onRelayout}>Выровнять</Button>
    </div>
  );
}

interface DomainForm { code: string; name: string; description: string; isNew: boolean }

/** Create or rename a domain (subject area): a reference kept by the methodist (ТЗ 4.10). */
function DomainDialog({ dialog, form, setForm, onDone }: {
  dialog: React.RefObject<HTMLDialogElement | null>; form: DomainForm | null; setForm: (f: DomainForm) => void; onDone: (code: string) => void;
}) {
  const m = useMutation({
    mutationFn: (f: DomainForm) => f.isNew
      ? api.post<DomainInfo>("/api/skills/domains", { code: f.code, name: f.name, description: f.description })
      : api.patch<DomainInfo>(`/api/skills/domains/${f.code}`, { name: f.name, description: f.description }),
    onSuccess: (d) => { dialog.current?.close(); onDone(d.code); },
  });
  return (
    <dialog ref={dialog} aria-labelledby="dom-title" onClose={() => m.reset()} className="m-auto w-[min(94vw,560px)] rounded-card border border-line p-0 shadow-card backdrop:bg-black/40">
      {form && (
        <form className="flex flex-col gap-4 p-6" onSubmit={(e) => { e.preventDefault(); m.mutate(form); }}>
          <h2 id="dom-title" className="m-0 text-lg font-semibold">{form.isNew ? "Новый домен" : "Домен"}</h2>
          <p className="m-0 text-sm text-muted">Домен — предметная область (направление обучения): к нему относятся навыки, целевые уровни и шаблоны сценариев.</p>
          <FieldRow label="Код" required>{(id) => (
            <Input id={id} required readOnly={!form.isNew} pattern="[a-z][a-z0-9_]{1,31}" title="Латиница в нижнем регистре, цифры и _, от 2 символов"
              placeholder="dataeng" className="font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} />
          )}</FieldRow>
          <FieldRow label="Название" required>{(id) => <Input id={id} required minLength={2} maxLength={128} placeholder="Инженерия данных" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</FieldRow>
          <FieldRow label="Описание" top>{(id) => <Textarea id={id} rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</FieldRow>
          {form.isNew && <p className="m-0 text-xs text-muted">Код задаётся один раз и используется в импорте и шаблонах; название можно поменять позже.</p>}
          <ErrorBanner error={m.error} />
          <div className="flex justify-end gap-2.5">
            <Button onClick={() => dialog.current?.close()}>Отмена</Button>
            <Button type="submit" variant="primary" loading={m.isPending}>{form.isNew ? "Создать домен" : "Сохранить"}</Button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function ImportDialog({ dialog, onDone }: { dialog: React.RefObject<HTMLDialogElement | null>; onDone: () => void }) {
  const [fmt, setFmt] = useState<"json" | "csv">("json");
  const [content, setContent] = useState("");
  const [replace, setReplace] = useState(false);
  const m = useMutation({
    mutationFn: () => api.post<{ created: number; updated: number; edges: number; targets: number }>("/api/skills/import", { format: fmt, content, replace }),
    onSuccess: onDone,
  });
  return (
    <dialog ref={dialog} aria-labelledby="imp-title" className="m-auto w-[min(94vw,640px)] rounded-card border border-line p-0 backdrop:bg-black/40">
      <form className="flex flex-col gap-4 p-6" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <h2 id="imp-title" className="m-0 text-lg font-semibold">Импорт графа компетенций</h2>
        <FieldRow label="Формат">
          {(id) => <Select id={id} value={fmt} onChange={(e) => setFmt(e.target.value as "json" | "csv")}><option value="json">JSON</option><option value="csv">CSV</option></Select>}
        </FieldRow>
        <FieldRow label="Файл">
          {(id) => <input id={id} type="file" accept=".json,.csv,text/csv,application/json" className="text-sm"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setContent(await f.text()); setFmt(f.name.endsWith(".csv") ? "csv" : "json"); } }} />}
        </FieldRow>
        <FieldRow label="Содержимое" top>{(id) => <Textarea id={id} rows={8} className="font-mono text-xs" value={content} onChange={(e) => setContent(e.target.value)} />}</FieldRow>
        <label className="ml-[34%] flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Обновлять существующие навыки
        </label>
        <ErrorBanner error={m.error} />
        {m.data && <Banner tone="green" icon="check">Создано {m.data.created}, обновлено {m.data.updated}, связей {m.data.edges}, целевых уровней {m.data.targets}. Цикл не обнаружен.</Banner>}
        <div className="flex justify-end gap-2.5">
          <Button onClick={() => dialog.current?.close()}>Закрыть</Button>
          <Button type="submit" variant="primary" icon="upload" disabled={content.length < 2} loading={m.isPending}>Импортировать</Button>
        </div>
      </form>
    </dialog>
  );
}

export default function SkillGraph() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["skill-graph"], queryFn: () => api.get<Graph>("/api/skills/graph") });
  const g = q.data;
  const [domainSel, setDomain] = useState<string | null>(null);
  const domain = domainSel ?? [...(g?.domains ?? [])].sort((a, b) => b.skills_count - a.skills_count)[0]?.code ?? "";
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [relayout, setRelayout] = useState(0);
  const importDlg = useRef<HTMLDialogElement>(null);
  const domainDlg = useRef<HTMLDialogElement>(null);
  const [domainForm, setDomainForm] = useState<DomainForm | null>(null);
  const openDomain = (f: DomainForm) => { setDomainForm(f); domainDlg.current?.showModal(); };

  const select = (id: string) => {
    const s = g!.skills.find((x) => x.id === id)!;
    setSelected(id);
    setDraft({ ...s, id: s.id, requires: g!.edges.filter((e) => e.skill_id === id).map((e) => ({ skill_id: e.requires_skill_id, weight: e.weight })) });
  };
  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = { name: d.name, description: d.description, theory: d.theory, domain_code: d.domain_code, level_max: d.level_max, status: d.status, requires: d.requires };
      return d.id ? api.patch<SkillNode>(`/api/skills/${d.id}`, body) : api.post<SkillNode>("/api/skills", { ...body, code: d.code });
    },
    onSuccess: (s) => { setSelected(s.id); setDraft((d) => d && { ...d, id: s.id }); qc.invalidateQueries({ queryKey: ["skill-graph"] }); },
  });
  const exportJson = () => {
    if (!g) return;
    const code = new Map(g.skills.map((s) => [s.id, s.code]));
    const data = {
      skills: g.skills.map((s) => ({ code: s.code, domain: s.domain_code, name: s.name, description: s.description, theory: s.theory, level_max: s.level_max, status: s.status,
        requires: g.edges.filter((e) => e.skill_id === s.id).map((e) => ({ code: code.get(e.requires_skill_id), weight: e.weight })) })),
      targets: g.targets.map((t) => ({ domain: t.domain_code, skill: code.get(t.skill_id), required_level: t.required_level })),
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "skill-graph.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (q.isLoading) return <Loading text="Загрузка графа…" />;
  if (!g) return <Page><ErrorBanner error={q.error} /></Page>;
  const domainName = g.domains.find((d) => d.code === domain)?.name ?? domain;
  const candidates = g.skills.filter((s) => s.id !== draft?.id && !draft?.requires.some((r) => r.skill_id === s.id));

  return (
    <>
      <PageHeader title="Граф компетенций" subtitle="Навыки, prerequisite-связи и веса · граф остаётся ациклическим"
        actions={<>
          <Button icon="upload" onClick={() => importDlg.current?.showModal()}>Импорт CSV / JSON</Button>
          <Button icon="download" onClick={exportJson}>Экспорт</Button>
          <Button variant="primary" onClick={() => { setSelected(null); setDraft({ id: null, code: "", name: "", description: "", theory: "", domain_code: domain, level_max: 5, status: "draft", requires: [] }); }}>+ Навык</Button>
        </>} />
      <Page>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[230px_minmax(0,1fr)_340px]">
          <Card className="flex flex-col gap-1">
            <CardTitle aside={<Button small icon="plus" onClick={() => openDomain({ code: "", name: "", description: "", isNew: true })}>Домен</Button>}>Домены</CardTitle>
            <nav aria-label="Домены" className="mt-2 flex flex-col gap-1">
              {g.domains.map((d) => (
                <button key={d.code} type="button" aria-current={d.code === domain}
                  onClick={() => { setDomain(d.code); setSelected(null); setDraft(null); }}
                  className={cx("flex min-h-10 items-center justify-between gap-2 rounded-xl px-3 text-left text-sm",
                    d.code === domain ? "bg-blue-bg font-semibold text-blue-ink" : "hover:bg-bg")}>
                  <span>{d.name}</span><span className="font-mono text-xs">{d.skills_count}</span>
                </button>
              ))}
            </nav>
            {g.domains.some((d) => d.code === domain) && (
              <Button small variant="ghost" className="mt-1 w-full" onClick={() => {
                const d = g.domains.find((x) => x.code === domain)!;
                openDomain({ code: d.code, name: d.name, description: d.description, isNew: false });
              }} title={`Изменить название и описание: ${domainName}`}>Изменить домен</Button>
            )}
            <div className="mt-4">
              <Banner tone={g.acyclic ? "green" : "red"} icon={g.acyclic ? "check" : "alert"}>
                {g.acyclic ? "Циклов нет" : "Обнаружен цикл"} · {g.skills.length} навыков, {g.edges.length} связей
              </Banner>
            </div>
          </Card>
          <Card padded={false} className="overflow-hidden">
            <ReactFlowProvider>
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                <h2 className="m-0 text-base font-semibold">{domainName}</h2>
                <ZoomButtons onRelayout={() => setRelayout((x) => x + 1)} />
              </div>
              {g.skills.some((x) => x.domain_code === domain)
                ? <GraphCanvas graph={g} domain={domain} selected={selected} onSelect={select} relayout={relayout} />
                : <Empty>В домене пока нет навыков. Добавьте их кнопкой «+ Навык» или импортом CSV / JSON, затем задайте целевые уровни.</Empty>}
            </ReactFlowProvider>
          </Card>
          <Card>
            {!draft ? (
              <p className="m-0 text-sm text-muted">Выберите навык на графе или создайте новый.</p>
            ) : (
              <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); save.mutate(draft); }}>
                <CardTitle>{draft.id ? "Свойства навыка" : "Новый навык"}</CardTitle>
                <FieldRow label="Код" required>{(id) => <Input id={id} required value={draft.code} readOnly={!!draft.id} pattern="[A-Z0-9_.\-]+" title="Латиница в верхнем регистре, цифры, точка, дефис" onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />}</FieldRow>
                <FieldRow label="Название" required>{(id) => <Input id={id} required minLength={2} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</FieldRow>
                <FieldRow label="Домен">
                  {(id) => <Select id={id} value={draft.domain_code} onChange={(e) => setDraft({ ...draft, domain_code: e.target.value })}>{g.domains.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}</Select>}
                </FieldRow>
                <FieldRow label="Уровень max">{(id) => <Input id={id} type="number" min={1} max={10} value={draft.level_max} onChange={(e) => setDraft({ ...draft, level_max: Number(e.target.value) })} />}</FieldRow>
                <FieldRow label="Статус">
                  {(id) => <Select id={id} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as SkillStatus })}>{Object.entries(SKILL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}
                </FieldRow>
                <FieldRow label="Описание" top>{(id) => <Textarea id={id} rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />}</FieldRow>
                <TheoryField value={draft.theory} onChange={(theory) => setDraft({ ...draft, theory })} />
                <div className="border-t border-line-soft pt-3 text-xs font-semibold text-muted">Требует (requires)</div>
                {draft.requires.map((r, i) => (
                  <div key={r.skill_id} className="grid grid-cols-[minmax(0,1fr)_76px_40px] items-center gap-2 text-sm">
                    <span className="truncate">{g.skills.find((s) => s.id === r.skill_id)?.name}</span>
                    <Input aria-label="Вес связи" type="number" min={0} max={1} step={0.1} className="font-mono" value={r.weight}
                      onChange={(e) => setDraft({ ...draft, requires: draft.requires.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)) })} />
                    <Button small aria-label="Удалить связь" onClick={() => setDraft({ ...draft, requires: draft.requires.filter((_, j) => j !== i) })}>×</Button>
                  </div>
                ))}
                <Select aria-label="Добавить prerequisite" value="" onChange={(e) => e.target.value && setDraft({ ...draft, requires: [...draft.requires, { skill_id: e.target.value, weight: 0.5 }] })}>
                  <option value="">+ Добавить prerequisite</option>
                  {candidates.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
                </Select>
                <ErrorBanner error={save.error} />
                {save.isSuccess && <Banner tone="green" icon="check">Сохранено. Граф остаётся ациклическим.</Banner>}
                <Button type="submit" variant="primary" loading={save.isPending}>Сохранить</Button>
                {draft.id && <Button onClick={() => navigate("/methodist/templates")}>Шаблоны сценариев</Button>}
              </form>
            )}
          </Card>
        </div>
      </Page>
      <ImportDialog dialog={importDlg} onDone={() => qc.invalidateQueries({ queryKey: ["skill-graph"] })} />
      <DomainDialog dialog={domainDlg} form={domainForm} setForm={setDomainForm} onDone={(code) => {
        qc.invalidateQueries({ queryKey: ["skill-graph"] });
        qc.invalidateQueries({ queryKey: ["domains"] });
        setDomain(code); setSelected(null); setDraft(null);
      }} />
    </>
  );
}
