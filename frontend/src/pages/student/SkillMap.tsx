import {
  Background, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider,
  type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { PRIORITY_LABEL, type Deficit, type MySkill, type SkillGraph } from "../../api/types";
import { Icon } from "../../components/icons";
import { Card, CardTitle, Chip, cx, fmtDate, type Tone } from "../../components/ui";
import { useTheme } from "../../theme";
import { layeredLayout } from "../methodist/layout";
import { PRIORITY_TONE } from "./Home";
import { STATE_LABEL, directionPercent, skillProgress, type SkillProgress, type SkillState } from "./skillProgress";
import { TheoryList } from "../../components/Theory";

// Student's competency map: the direction's REQUIRES graph coloured by the student's progress (ТЗ 4.3, Д-39).

const STATE_TONE: Record<SkillState, Tone> = { mastered: "green", progress: "amber", available: "blue", locked: "grey" };
const STATE_CARD: Record<SkillState, string> = {
  mastered: "border-green/60 bg-green-bg/50",
  progress: "border-amber/60 bg-amber-bg/50",
  available: "border-blue-ink/40 border-dashed bg-surface",
  locked: "border-line bg-sunken/60 opacity-70",
};
const STATE_FILL: Record<SkillState, string> = { mastered: "bg-green", progress: "bg-amber", available: "bg-blue-ink", locked: "bg-field" };
const STATE_ICON = { mastered: "check", progress: "activity", available: "target", locked: "lock" } as const;

type MapData = { name: string; code: string; levelMax: number; p: SkillProgress; deficit?: Deficit; selected: boolean };

function Levels({ level, max, required, state }: { level: number; max: number; required: number | null; state: SkillState }) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cx("h-1.5 flex-1 rounded-full", i < level ? STATE_FILL[state] : "bg-line",
          required != null && i === required - 1 && "outline outline-1 outline-offset-1 outline-label/50")} />
      ))}
    </div>
  );
}

function SkillNodeCard({ data }: NodeProps<Node<MapData>>) {
  const { p } = data;
  return (
    <div className={cx("w-[210px] rounded-2xl border px-3.5 py-2.5 text-left shadow-card transition-shadow hover:shadow-lg",
      STATE_CARD[p.state], data.selected && "ring-4 ring-accent/30", data.deficit && "outline outline-2 outline-offset-2 outline-red/50")}>
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-muted" />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted">{data.code}</span>
        <Icon name={STATE_ICON[p.state]} size={14} className={cx(p.state === "mastered" ? "text-green" : p.state === "progress" ? "text-amber" : "text-muted")} />
      </div>
      <div className="mb-2 mt-0.5 text-[13px] font-medium leading-tight">{data.name}</div>
      <Levels level={p.level} max={data.levelMax} required={p.required} state={p.state} />
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
        <span>уровень {p.level}{p.required != null ? ` из ${p.required}` : ""}</span>
        {data.deficit && <span className="font-medium text-red-ink">дефицит</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-muted" />
    </div>
  );
}
const nodeTypes = { skill: SkillNodeCard };

function Ring({ value }: { value: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`Направление освоено на ${value} %`}>
      <circle cx="56" cy="56" r={r} fill="none" stroke="var(--color-sunken)" strokeWidth="10" />
      <circle cx="56" cy="56" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 56 56)" className="transition-[stroke-dasharray] duration-700" />
      <text x="56" y="60" textAnchor="middle" fontSize="24" fontWeight="600" fill="var(--color-ink)">{value}%</text>
    </svg>
  );
}

export function SkillMap({ graph, skills, deficits, domain }: { graph: SkillGraph; skills: MySkill[]; deficits: Deficit[]; domain: string }) {
  const [theme] = useTheme();
  const nodesIn = useMemo(() => graph.skills.filter((s) => s.domain_code === domain && s.status === "active"), [graph, domain]);
  const ids = useMemo(() => new Set(nodesIn.map((s) => s.id)), [nodesIn]);
  const edgesIn = useMemo(() => graph.edges.filter((e) => ids.has(e.skill_id) && ids.has(e.requires_skill_id)), [graph, ids]);
  const progress = useMemo(() => skillProgress({
    skills: nodesIn, edges: edgesIn,
    levels: new Map(skills.map((s) => [s.skill_id, s.level])),
    targets: new Map(graph.targets.filter((t) => t.domain_code === domain).map((t) => [t.skill_id, t.required_level])),
  }), [nodesIn, edgesIn, skills, graph, domain]);
  const pos = useMemo(() => layeredLayout(nodesIn.map((s) => s.id), edgesIn.map((e) => ({ from: e.requires_skill_id, to: e.skill_id }))), [nodesIn, edgesIn]);
  const deficitBy = useMemo(() => new Map(deficits.map((d) => [d.skill_id, d])), [deficits]);
  const mine = useMemo(() => new Map(skills.map((s) => [s.skill_id, s])), [skills]);
  const byId = useMemo(() => new Map(nodesIn.map((s) => [s.id, s])), [nodesIn]);
  const [selected, setSelected] = useState<string | null>(null);

  const counts = { mastered: 0, progress: 0, available: 0, locked: 0 } as Record<SkillState, number>;
  progress.forEach((p) => counts[p.state]++);
  const percent = directionPercent(progress);
  const next = deficits.find((d) => ids.has(d.skill_id) && progress.get(d.skill_id)?.state !== "locked");

  const nodes: Node<MapData>[] = nodesIn.map((s) => ({
    id: s.id, type: "skill", position: pos[s.id], draggable: false,
    data: { name: s.name, code: s.code, levelMax: s.level_max, p: progress.get(s.id)!, deficit: deficitBy.get(s.id), selected: s.id === selected },
  }));
  const edges: Edge[] = edgesIn.map((e) => {
    const toState = progress.get(e.skill_id)!.state;
    const done = progress.get(e.requires_skill_id)!.state === "mastered";
    const hot = e.skill_id === selected || e.requires_skill_id === selected;
    return {
      id: `${e.requires_skill_id}-${e.skill_id}`, source: e.requires_skill_id, target: e.skill_id, type: "smoothstep",
      animated: toState === "available" || toState === "progress",
      markerEnd: { type: MarkerType.ArrowClosed, color: hot ? "var(--color-accent)" : done ? "var(--color-green)" : "var(--color-field)" },
      style: { stroke: hot ? "var(--color-accent)" : done ? "var(--color-green)" : "var(--color-field)", strokeWidth: hot ? 2.2 : 1.4 },
    };
  });

  const sel = selected ? byId.get(selected) : undefined;
  const sp = selected ? progress.get(selected) : undefined;
  const sm = selected ? mine.get(selected) : undefined;
  const sd = selected ? deficitBy.get(selected) : undefined;

  return (
    <>
      <Card className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <Ring value={percent} />
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <div className="text-lg font-semibold tracking-tight">Направление освоено на {percent} %</div>
          <div className="text-sm text-muted">Доля требуемых уровней, которые вы уже подтвердили. Уровень растёт после трёх успешных прохождений подряд.</div>
          {next && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>Следующий шаг: <b className="font-medium">{next.name}</b></span>
              <Chip tone={PRIORITY_TONE[next.priority]}>{PRIORITY_LABEL[next.priority]}</Chip>
              <Link to="/student" className="rounded-full bg-sunken px-3 py-1 no-underline hover:bg-line">К назначениям →</Link>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(counts) as SkillState[]).map((st) => (
            <div key={st} className="flex min-w-[120px] flex-col gap-0.5 rounded-2xl bg-sunken px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs text-muted"><Icon name={STATE_ICON[st]} size={13} />{STATE_LABEL[st]}</span>
              <b className="text-2xl font-semibold">{counts[st]}</b>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
            <CardTitle>Карта навыков</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STATE_LABEL) as SkillState[]).map((st) => <Chip key={st} tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Chip>)}
              <Chip tone="red">дефицит</Chip>
            </div>
          </div>
          <div className="h-[560px] border-t border-line-soft" aria-label="Граф компетенций направления">
            <ReactFlowProvider>
              <ReactFlow colorMode={theme} style={{ background: "transparent" }} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.12, minZoom: 0.5, maxZoom: 1 }}
                minZoom={0.3} nodesConnectable={false} nodesDraggable={false} proOptions={{ hideAttribution: true }}
                onNodeClick={(_, n) => setSelected(n.id)} onPaneClick={() => setSelected(null)}>
                <Background gap={18} color="var(--color-line)" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 self-start">
          {!sel || !sp ? (
            <>
              <CardTitle>Как читать карту</CardTitle>
              <p className="m-0 text-sm leading-relaxed text-muted">
                Стрелка ведёт от навыка, который нужен, к навыку, который он открывает. Полоски на карточке — уровни навыка,
                обведена полоска требуемого уровня. Пунктирные стрелки показывают, куда можно двигаться дальше; «закрыт» —
                сначала нужно хотя бы раз подтвердить предыдущие навыки.
              </p>
              <p className="m-0 text-sm text-muted">Нажмите на навык, чтобы увидеть подробности.</p>
            </>
          ) : (
            <>
              <div>
                <div className="font-mono text-xs text-muted">{sel.code}</div>
                <h2 className="m-0 text-lg font-semibold leading-snug">{sel.name}</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone={STATE_TONE[sp.state]}>{STATE_LABEL[sp.state]}</Chip>
                {sd && <Chip tone={PRIORITY_TONE[sd.priority]}>дефицит: {PRIORITY_LABEL[sd.priority]}</Chip>}
                {sm?.outdated && <Chip tone="amber">давно не подтверждался</Chip>}
                {sp.required == null && <Chip>вне цели направления</Chip>}
              </div>
              {sel.description && <p className="m-0 text-sm leading-relaxed">{sel.description}</p>}
              {sel.theory.trim() && (
                <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
                  <div className="text-xs font-medium text-muted">Теория</div>
                  <TheoryList skills={[sel]} openFirst />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm"><span className="text-muted">Уровень</span><b className="font-medium">{sp.level} из {sel.level_max}{sp.required != null ? ` · нужен ${sp.required}` : ""}</b></div>
                <Levels level={sp.level} max={sel.level_max} required={sp.required} state={sp.state} />
                <div className="flex justify-between text-sm"><span className="text-muted">Серия успехов</span><span>{sm?.success_streak ?? 0} из 3 до повышения</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted">Прохождений</span><span>{sm?.success_count ?? 0} успешно · {sm?.fail_count ?? 0} нет</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted">Подтверждён</span><span>{fmtDate(sm?.last_confirmed)}</span></div>
              </div>
              {([["Нужно сначала", sp.prerequisites], ["Открывает", sp.unlocks]] as const).map(([title, list]) => list.length > 0 && (
                <div key={title} className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
                  <div className="text-xs font-medium text-muted">{title}</div>
                  {list.map((id) => {
                    const o = byId.get(id)!;
                    const st = progress.get(id)!.state;
                    return (
                      <button key={id} type="button" onClick={() => setSelected(id)}
                        className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-sunken">
                        <span>{o.name}</span><Chip tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Chip>
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
