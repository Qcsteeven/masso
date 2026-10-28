import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { SkillGraph, SkillNode } from "../api/types";
import { Icon } from "./icons";
import { Markdown } from "./Markdown";
import { Card, CardTitle } from "./ui";

// Short theory per skill, written by the methodist (Д-40): just-in-time reference for situated learning.

export function useSkillTheory(domain: string, codes: string[]): SkillNode[] {
  const graph = useQuery({ queryKey: ["skills-graph", domain], queryFn: () => api.get<SkillGraph>("/api/skills/graph", { domain }), enabled: !!domain && codes.length > 0 });
  const byCode = new Map((graph.data?.skills ?? []).map((s) => [s.code, s]));
  return codes.map((c) => byCode.get(c)).filter((s): s is SkillNode => !!s && !!s.theory.trim());
}

export function TheoryList({ skills, openFirst }: { skills: SkillNode[]; openFirst?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {skills.map((s, i) => (
        <details key={s.id} open={openFirst && i === 0} className="group rounded-2xl bg-sunken/70 px-4 py-2.5 open:pb-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2"><Icon name="bulb" size={16} className="text-accent" />{s.name}</span>
            <Icon name="back" size={16} className="-rotate-90 text-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-2 text-sm leading-relaxed [&_h4]:mb-1 [&_h4]:mt-3 [&_h4]:text-sm [&_h4]:font-semibold"><Markdown source={s.theory} /></div>
        </details>
      ))}
    </div>
  );
}

export function TheoryCard({ domain, codes, title, intro }: { domain: string; codes: string[]; title: string; intro: string }) {
  const skills = useSkillTheory(domain, codes);
  if (!skills.length) return null;
  return (
    <Card className="flex flex-col gap-3 print:hidden">
      <CardTitle>{title}</CardTitle>
      <p className="m-0 text-[13px] text-muted">{intro}</p>
      <TheoryList skills={skills} />
    </Card>
  );
}
