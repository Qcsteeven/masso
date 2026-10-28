import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { DOMAIN_LABEL } from "./types";

// Domains (subject areas) are a reference kept by the methodist: names come from the API, DOMAIN_LABEL is a fallback.
export interface DomainInfo { code: string; name: string; description: string; skills_count: number }

export function useDomains() {
  return useQuery({ queryKey: ["domains"], queryFn: () => api.get<DomainInfo[]>("/api/skills/domains"), staleTime: 5 * 60_000 });
}

export function useDomainLabel(): (code: string) => string {
  const q = useDomains();
  const names = new Map((q.data ?? []).map((d) => [d.code, d.name]));
  return (code) => names.get(code) ?? DOMAIN_LABEL[code] ?? code;
}
