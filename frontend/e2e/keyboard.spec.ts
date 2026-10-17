import { expect, test } from "@playwright/test";
import { PASSWORD, ensureAssignments } from "./helpers.ts";

// ТП разд. 10: основные действия доступны с клавиатуры.
test("login and main navigation work from the keyboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").focus();
  await page.keyboard.type("teacher@masso.local");
  await page.keyboard.press("Tab");
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/teacher$/);
  const nav = page.getByRole("navigation", { name: "Основное меню" });
  await nav.getByRole("link", { name: "Экспорт отчётов" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/teacher\/export$/);
  // the form submits with Enter and reports the mandatory period
  await page.getByLabel("Дата начала").fill("");
  await page.getByLabel("Дата окончания").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Укажите дату начала");
});

test("submit confirmation closes with Escape", async ({ page }) => {
  await ensureAssignments(page); // the test must not depend on other specs having run first
  await page.goto("/login");
  await page.getByLabel("Email").fill("orlova.dp@masso.local");
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/student$/);
  const row = page.getByRole("row", { name: /Проверка договора/ });
  await row.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/student\/sessions\//, { timeout: 120_000 });
  await page.getByRole("button", { name: "Завершить и отправить на проверку" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
