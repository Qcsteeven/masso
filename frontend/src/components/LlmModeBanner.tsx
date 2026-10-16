import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Icon } from "./icons";
import { fmtTime } from "./ui";

interface LlmStatus { generation_mode: "external" | "local" | "template"; updated_at: string; reason: string | null }

const LABEL = { local: "локальный режим", template: "шаблонный режим", external: "внешний режим" } as const;

/** Teacher warning when the LLM contour is not the primary one (ТЗ 4.4, сценарий 5). */
export function LlmModeBanner() {
  const { data } = useQuery({
    queryKey: ["llm-status"],
    queryFn: () => api.get<LlmStatus>("/api/llm/status"),
    refetchInterval: 60_000,
    retry: false,
  });
  if (!data || data.generation_mode === "external") return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#f0d68a] bg-amber-bg px-8 py-2.5 text-[13px] text-[#5c3b00]">
      <Icon name="alert" size={18} />
      <span className="flex-[1_1_400px]">
        <b>LLM-контур переключён: {LABEL[data.generation_mode]}</b> с {fmtTime(data.updated_at)}. Активные сессии
        продолжаются; новые сценарии генерируются {data.generation_mode === "local" ? "локальной моделью" : "из утверждённых вариантов"}.
      </span>
    </div>
  );
}
