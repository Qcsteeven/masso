import { expect, test } from "@playwright/test";
import { ensureAssignments, login } from "./helpers.ts";

// Д-44: a code task — statement, editor, «Запустить тесты», autosave, submit with hidden checks.
test("student works on a code task: run, edit, submit", async ({ page }) => {
  test.setTimeout(240_000);
  await ensureAssignments(page);
  await login(page, "zakharov.ni@masso.local");
  await page.getByRole("row", { name: /Быстрый поиск в журнале/ }).getByRole("button", { name: /Начать|Пройти снова|Продолжить/ }).click();
  await expect(page).toHaveURL(/\/student\/sessions\//, { timeout: 180_000 });
  await expect(page.getByRole("heading", { name: "Условие" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("tab", { name: /solution\.py/ }).first()).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Запустить тесты" }).click();
  await expect(page.getByRole("heading", { name: "Результат запуска" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("0 из 1")).toBeVisible(); // the skeleton fails the example test

  await page.locator(".cm-content").first().click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n# черновик решения");
  await expect(page.getByText(/Сохранено в/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Завершить и отправить на проверку" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/reports\//, { timeout: 180_000 });
  await expect(page.getByRole("row", { name: /Ваши тесты находят типичные ошибки/ })).toContainText("не пройдена");
});
