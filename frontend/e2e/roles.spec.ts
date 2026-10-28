import { expect, test } from "@playwright/test";
import { SHOTS, consoleErrors, login } from "./helpers.ts";

// Each role opens its screens without console errors; screenshots go to .artifacts/ui for comparison with docs/mockups.
const ROLES: { email: string; pages: [string, RegExp][] }[] = [
  { email: "demonov.la@masso.local", pages: [["/student", /Мои назначения/], ["/student/reports", /Протоколы/], ["/student/skills", /Мои навыки/]] },
  { email: "teacher@masso.local", pages: [["/teacher", /Панель группы/], ["/teacher/assignments", /Назначения/], ["/teacher/export", /Экспорт отчётов/]] },
  { email: "methodist@masso.local", pages: [["/methodist/skills", /Граф компетенций/], ["/methodist/templates", /Шаблоны сценариев/], ["/methodist/targets", /Целевые уровни/]] },
  { email: "admin@masso.local", pages: [["/admin/users", /Пользователи и роли/], ["/admin/llm", /LLM и песочницы/], ["/admin/audit", /Аудит и безопасность/]] },
  { email: "ops@masso.local", pages: [["/sysadmin", /Состояние системы/], ["/sysadmin/audit", /Аудит и безопасность/]] },
];

for (const r of ROLES) {
  test(`screens of ${r.email}`, async ({ page }) => {
    const errors = consoleErrors(page);
    await login(page, r.email);
    for (const [path, heading] of r.pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${SHOTS}/${path.replace(/\//g, "_").slice(1)}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test("a student sees the competency map and skill details", async ({ page }) => {
  await login(page, "demonov.la@masso.local");
  await page.goto("/student/skills");
  await expect(page.getByText(/Направление освоено на \d+ %/)).toBeVisible();
  const node = page.locator(".react-flow__node", { hasText: "Основы Linux" });
  await node.click();
  await expect(page.getByRole("heading", { level: 2, name: "Основы Linux" })).toBeVisible();
  await expect(page.getByText("Открывает")).toBeVisible();
  await expect(page.getByText("Теория", { exact: true })).toBeVisible();
});

test("a student cannot open staff screens", async ({ page }) => {
  await login(page, "demonov.la@masso.local");
  for (const path of ["/teacher", "/methodist/templates", "/admin/users", "/sysadmin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/student$/);
  }
});
