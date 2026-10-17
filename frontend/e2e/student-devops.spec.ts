import { expect, test } from "@playwright/test";
import { SHOTS, consoleErrors, ensureAssignments, login } from "./helpers.ts";

// ТЗ 4.2, сценарий 1: обучающийся восстанавливает веб-сервис в учебной среде через терминал и получает протокол.
test("student fixes the web service in the browser terminal and sees the report", async ({ page }) => {
  const errors = consoleErrors(page);
  await ensureAssignments(page);
  await login(page, "kim.ea@masso.local");
  await expect(page.getByRole("heading", { name: "Мои назначения" })).toBeVisible();
  const row = page.getByRole("row", { name: /Восстановление веб-сервиса/ });
  await row.getByRole("button", { name: /Начать|Пройти снова|Продолжить/ }).click();
  await expect(page).toHaveURL(/\/student\/sessions\//, { timeout: 180_000 });
  await expect(page.getByText("WebSocket подключён")).toBeVisible({ timeout: 60_000 });

  const term = page.locator(".xterm");
  await term.click();
  const run = async (cmd: string) => { await page.keyboard.type(cmd + "\n", { delay: 5 }); await page.waitForTimeout(1200); };
  await run("curl -s -o /dev/null -w '%{http_code}\\n' localhost:8080/health");
  await run("sed -i 's/^DB_USER=.*/DB_USER=store/; s/^DB_PASSWORD=.*/DB_PASSWORD=Sh0p-2026-store/' /srv/app/.env");
  await run("supervisorctl restart store-api");
  await page.waitForTimeout(3000);
  await run("curl -s localhost:8080/health; echo");
  await expect(term).toContainText('"status"', { timeout: 20_000 });
  await page.screenshot({ path: `${SHOTS}/e2e-workspace.png` });

  await page.getByRole("button", { name: "Завершить и отправить на проверку" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/reports\//, { timeout: 180_000 });
  await expect(page.getByText("сценарий пройден")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("row", { name: /Магазин отвечает HTTP 200/ })).toContainText("пройдена");
  await page.screenshot({ path: `${SHOTS}/e2e-report.png`, fullPage: true });
  expect(errors).toEqual([]);
});
