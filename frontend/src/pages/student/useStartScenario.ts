import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/client";
import type { RunOut, SessionView } from "../../api/types";

/** Generate a variant (ScenarioAgent) and start a session for it, with status messages (ТП разд. 10). */
export function useStartScenario() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async (templateId: string) => {
      setStage("Генерация сценария: подбор параметров и проверка достижимости…");
      const run = await api.post<RunOut>("/api/scenarios/generate", { template_id: templateId });
      setStage("Запуск учебной среды…");
      return api.post<SessionView>("/api/sessions", { run_id: run.run_id });
    },
    onSuccess: (s) => navigate(`/student/sessions/${s.id}`),
    onSettled: () => setStage(null),
  });
  return { start: m.mutate, pending: m.isPending, variables: m.variables, error: m.error, stage };
}
