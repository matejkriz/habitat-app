import { expect, type Page } from "@playwright/test";
import { getPreviousLunchPaymentMonth } from "../lib/lunch-payment";

export function previousBillingSchoolDay(): string {
  const [year, month] = getPreviousLunchPaymentMonth().split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0, 12));
  while ([0, 5, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function persona(
  page: Page,
  role: "parent-roza" | "parent-bedrich" | "teacher-kveta" | "director-bohumil",
) {
  await page.goto("/");
  const selector = page.getByRole("combobox", { name: "Testovací identita" });
  // This control exists only after real developer authentication in an allowed environment.
  await expect(selector).toBeVisible();
  await selector.selectOption(`seed-user-${role}`);
  await expect(selector).toBeEnabled();
  await expect(selector).toHaveValue(`seed-user-${role}`);
  await expect(page).toHaveURL(
    role.startsWith("parent")
      ? /\/rodic/
      : role.startsWith("teacher")
        ? /\/ucitel\/dochazka/
        : /\/reditel/,
  );
}
