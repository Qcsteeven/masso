export type Role = "student" | "teacher" | "methodist" | "admin" | "sysadmin";

export interface UserBrief {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
  group_code: string | null;
}

export interface TemplateBrief {
  id: string;
  code: string;
  title: string;
  domain_code: string;
  kind: "container" | "document" | "code";
  status: "draft" | "published" | "archived";
  version: number;
  difficulty: number;
  time_limit_min: number;
  validated: boolean;
  published_at: string | null;
}

export interface Assignment {
  id: string;
  template: TemplateBrief;
  group_code: string | null;
  user_id: string | null;
  due_at: string | null;
  created_at: string;
  last_session_id: string | null;
  last_session_status: SessionStatus | null;
  last_score: number | null;
}

export type SessionStatus =
  | "starting" | "active" | "paused" | "submitted" | "checking" | "completed" | "failed" | "expired";

export interface DocumentPublic { id: string; title: string; markdown: string }

export interface CodingPublic {
  language: "python";
  func: string;
  statement: string;
  files: Record<string, string>;
  examples: { args: unknown[]; expected: unknown }[];
}

export interface CodeRunOut {
  examples: { call: string; expected: unknown; got: unknown; error: string | null; ok: boolean }[];
  examples_error: string | null;
  tests: { total: number; passed: number; failures: { name: string; error: string }[]; import_error: string | null };
  stdout: string;
  retry_after_sec: number;
}

export interface ScenarioPublic {
  run_id: string;
  code: string;
  domain: string;
  kind: "container" | "document" | "code";
  title: string;
  legend: string;
  difficulty: number;
  time_limit_min: number;
  criteria: string[];
  constraints: string;
  hints_max: number;
  skills: string[];
  documents: DocumentPublic[];
  defect_types: Record<string, string>;
  answer_form: AnswerForm | Record<string, never>;
  coding?: CodingPublic | Record<string, never>;
}

export type AnswerForm =
  | { type: "findings"; sections: Record<string, string>; fields: Record<string, string> }
  | { type: "reconciliation"; documents: Record<string, string>; fields: Record<string, string> };

export interface SessionEvent {
  id?: string;
  type: "status" | "incident" | "hint" | "warning" | "security" | "check" | "answer" | "ping";
  severity?: "info" | "warning" | "error";
  payload: Record<string, unknown>;
  created_at?: string;
}

export interface SessionView {
  id: string;
  run_id: string;
  status: SessionStatus;
  kind: "container" | "document" | "code";
  started_at: string | null;
  finished_at: string | null;
  time_limit_min: number;
  remaining_sec: number | null;
  hints_used: number;
  hints_max: number;
  scenario: ScenarioPublic;
  answers: Record<string, unknown>;
  events: SessionEvent[];
}

export interface HintOut { number: number; hint: string; penalty_percent: number; remaining: number; source: string }

export interface SubmitOut { report_id: string; status: string; score: ScoreBlock }

export interface ScoreBlock {
  base: number;
  final: number;
  passed: boolean;
  critical_failed: boolean;
  hints: number;
  violations: number;
  threshold: number;
  formula: string;
}

export interface ReportCheck { id: string; title: string; weight: number; critical: boolean; passed: boolean; skipped: boolean }

export interface SkillChange {
  skill_id: string;
  code: string;
  name: string;
  level_before: number;
  level_after: number;
  success_streak: number;
  passed: boolean;
}

export interface ReportPayload {
  id: string;
  session_id: string;
  title: string;
  domain: string;
  kind: string;
  legend: string | null;
  score: ScoreBlock;
  checks: ReportCheck[];
  errors: { check: string; critical: boolean }[];
  hints: { number: number; text: string; penalty_percent: number; created_at: string }[];
  incidents: { message: string; created_at: string }[];
  violations: number;
  commands: number;
  time_spent_sec: number;
  time_limit_min: number;
  skill_changes: SkillChange[];
  recommendation: { skill: string; priority: string; template: string | null } | null;
  teacher: { score: number; reason: string; confirmed: boolean; by: string; at: string; alternative: boolean } | null;
  student?: { id: string; full_name: string; group: string | null };
  created_at: string;
}

export interface MyReport {
  id: string;
  session_id: string;
  title: string;
  domain: string;
  score: number | null;
  passed: boolean | null;
  created_at: string;
}

export interface MySkill {
  skill_id: string;
  code: string;
  name: string;
  domain_code: string;
  level: number;
  level_max: number;
  required_level: number | null;
  last_confirmed: string | null;
  success_streak: number;
  success_count: number;
  fail_count: number;
  outdated: boolean;
}

export type Priority = "critical" | "high" | "medium" | "low";

export interface Deficit {
  skill_id: string;
  code: string;
  name: string;
  current_level: number;
  required_level: number;
  gap: number;
  stale: boolean;
  days_since_confirmed: number | null;
  dependents: number;
  priority: Priority;
}

export interface Recommendations {
  domain: string;
  deficits: Deficit[];
  recommendations: { template_id: string; code: string; title: string; domain_code: string; kind: string; score: number; covers: string[] }[];
}

export interface RunOut { run_id: string; status: string; generation_mode: string; duration_ms: number }

export const DOMAIN_LABEL: Record<string, string> = {
  devops: "DevOps и администрирование",
  security: "Информационная безопасность",
  legal: "Юриспруденция",
  audit: "Экономика и аудит",
  algorithms: "Алгоритмы и структуры данных",
};

export const KIND_LABEL: Record<string, string> = { container: "учебная среда", document: "документный тренажёр", code: "задача на код" };

export const PRIORITY_LABEL: Record<Priority, string> = { critical: "критический", high: "высокий", medium: "средний", low: "низкий" };

export type ReviewStatus = "pending" | "confirmed" | "corrected";

export interface GroupOverview {
  period: { from: string; to: string };
  group: string | null;
  kpi: { sessions: number; students: number; avg_score: number | null; median_score: number | null; hints_per_session: number; pending_review: number };
  problem_skills: { skill_id: string; name: string; fail_percent: number; sessions: number }[];
  sessions: {
    session_id: string;
    student: string;
    student_id: string;
    group: string | null;
    title: string;
    domain: string;
    finished_at: string | null;
    auto_score: number;
    expert_score: number | null;
    review_status: ReviewStatus;
    verification_status: string;
    hints: number;
  }[];
}

export interface VerificationOut {
  session_id: string;
  checks: (ReportCheck & { type: string; judge?: unknown })[];
  base_score: number;
  final_score: number;
  status: string;
  errors: { check: string; critical: boolean }[];
  corrected_score: number | null;
  correction_reason: string | null;
  corrected_by: string | null;
  review_status: ReviewStatus;
  created_at: string;
}

export interface TraceEvent {
  id: string;
  session_id: string;
  type: string;
  severity: "info" | "warning" | "error" | "critical";
  payload: Record<string, unknown>;
  created_at: string;
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = { pending: "ожидает", confirmed: "подтверждена", corrected: "скорректирована" };
export const REVIEW_TONE = { pending: "amber", confirmed: "green", corrected: "blue" } as const;

export type SkillStatus = "draft" | "active" | "deprecated" | "archived";
export interface SkillNode { id: string; code: string; domain_code: string; name: string; description: string; theory: string; level_max: number; status: SkillStatus; dependents: number }
export interface SkillGraph {
  domains: { code: string; name: string; description: string; skills_count: number }[];
  skills: SkillNode[];
  edges: { skill_id: string; requires_skill_id: string; weight: number }[];
  targets: { domain_code: string; skill_id: string; required_level: number }[];
  acyclic: boolean;
}
export const SKILL_STATUS_LABEL: Record<SkillStatus, string> = { draft: "черновик", active: "активен", deprecated: "устаревший", archived: "в архиве" };

export interface ValidationStep { step: string; ok: boolean; detail: string; duration_ms?: number } // absent in seed reports
export interface TemplateFull extends TemplateBrief {
  spec: Record<string, unknown>;
  validation_report: { status: string; version: number; steps: ValidationStep[]; errors: string[]; generation_mode: string; duration_ms?: number; validated_at: string } | null;
  created_at: string;
}
