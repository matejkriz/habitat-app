import { expect, type Page } from "@playwright/test";

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

