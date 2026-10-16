// API client: unwraps the {request_id, status, data|error} envelope (spec §10),
// keeps the access token in memory and refreshes it once on 401 via the HttpOnly cookie.

export type ErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_FORBIDDEN"
  | "SCENARIO_NOT_VALID"
  | "SESSION_NOT_READY"
  | "HINT_LIMIT_EXCEEDED"
  | "VERIFICATION_FAILED"
  | "LLM_PROVIDER_UNAVAILABLE"
  | "SANDBOX_LIMIT_EXCEEDED"
  | "REPORT_PERIOD_REQUIRED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NETWORK";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;
  constructor(code: ErrorCode, message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type Envelope<T> =
  | { request_id: string; status: "success"; data: T }
  | { request_id: string; status: "error"; error: { code: ErrorCode; message: string; details?: Record<string, unknown> } };

let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}
export function setOnAuthLost(cb: (() => void) | null): void {
  onAuthLost = cb;
}

async function parse<T>(res: Response): Promise<T> {
  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError("NETWORK", "Сервер вернул некорректный ответ.", res.status);
  }
  if (body.status === "success") return body.data;
  const e = body.error;
  throw new ApiError(e.code, e.message, res.status, e.details ?? {});
}

let refreshing: Promise<boolean> | null = null;

export async function refreshToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) return false;
      const data = await parse<{ access_token: string }>(res);
      accessToken = data.access_token;
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  raw?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, window.location.origin);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.pathname + url.search;
}

export async function request<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      credentials: "include",
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("NETWORK", "Нет связи с сервером. Проверьте подключение.", 0);
  }
  if (res.status === 401 && !retried && !path.startsWith("/api/auth/")) {
    if (await refreshToken()) return request<T>(path, opts, true);
    onAuthLost?.();
  }
  return parse<T>(res);
}

export async function download(path: string, query: RequestOptions["query"], filename: string): Promise<void> {
  const res = await fetch(buildUrl(path, query), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: "include",
  });
  if (!res.ok || res.headers.get("content-type")?.includes("application/json")) {
    await parse(res);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body: unknown = {}) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
