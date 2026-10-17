import { expect, request, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "masso-demo";
export const SHOTS = "../.artifacts/ui";

export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: /Войти/ }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

/** Collects console errors except the expected 401 of the silent refresh before login. */
export function consoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("401")) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

export async function api<T>(ctx: APIRequestContext, path: string, token: string, body?: unknown): Promise<T> {
  const r = await ctx.fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await r.json()).data as T;
}

export async function token(ctx: APIRequestContext, email: string): Promise<string> {
  const r = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  return (await r.json()).data.access_token as string;
}

/** Teacher assigns every published template to the demo group (idempotent). Uses its own cookie jar. */
export async function ensureAssignments(page: Page): Promise<void> {
  const ctx = await request.newContext({ baseURL: new URL(page.url() === "about:blank" ? process.env.E2E_BASE_URL ?? "http://localhost:8080" : page.url()).origin });
  try {
    const t = await token(ctx, "teacher@masso.local");
    const group = "ИСИб-23-1";
    const tpls = await api<{ id: string; status: string }[]>(ctx, "/api/scenarios/templates", t);
    const have = await api<{ template: { id: string } }[]>(ctx, `/api/scenarios/assignments?group=${encodeURIComponent(group)}`, t);
    for (const tp of tpls.filter((x) => x.status === "published")) {
      if (!have.some((a) => a.template.id === tp.id)) await api(ctx, "/api/scenarios/assignments", t, { template_id: tp.id, group_code: group });
    }
  } finally {
    await ctx.dispose();
  }
}
