import { expect, test } from "@playwright/test";
import { persona } from "./helpers";

const date = process.env.E2E_DATE ?? "2026-09-17";
const month = date.slice(0, 7);
const monthName = new Intl.DateTimeFormat("cs-CZ", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const monthLabel = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));

test("director records monthly sibling payments and both final columns stay fixed on mobile", async ({ page }) => {
  await persona(page, "teacher-kveta");
  await page.getByLabel("Datum docházky").fill(date);
  let changed = false;
  for (const name of ["Božena Bublina", "Max Mlsoun"]) {
    const presence = page.getByRole("checkbox", { name: `Docházka: ${name}` });
    if (!(await presence.isChecked())) { await presence.check({ force: true }); changed = true; }
  }
  if (changed) {
    await page.getByRole("button", { name: /Potvrdit docházku|Uložit změny/ }).click();
    await expect(page.getByText(/Docházka uložena/)).toBeVisible();
  }
  await persona(page, "director-bohumil");
  await page.goto(`/reditel?month=${month}#obedy`);
  const table = page.getByRole("table", { name: /^Obědy/ });
  const paid = (name: string) => table.getByRole("checkbox", { name: `Zaplaceno: ${name}` });
  await expect(paid("Božena Bublina")).not.toBeChecked();
  await paid("Božena Bublina").check();
  await expect(paid("Božena Bublina")).toBeEnabled();
  await page.reload();
  await expect(paid("Božena Bublina")).toBeChecked();
  await expect(paid("Max Mlsoun")).not.toBeChecked();

  await page.setViewportSize({ width: 390, height: 844 });
  await table.scrollIntoViewIfNeeded();
  await page.evaluate(async () => { await document.fonts.ready; });
  const positions = () => table.evaluate(element => {
    const amount = element.querySelector("thead th:nth-last-child(2)")!.getBoundingClientRect();
    const paid = element.querySelector("thead th:last-child")!.getBoundingClientRect();
    const amountCell = element.querySelector("tbody tr td:nth-last-child(2)")!.getBoundingClientRect();
    const paidCell = element.querySelector("tbody tr td:last-child")!.getBoundingClientRect();
    const container = element.parentElement!.getBoundingClientRect();
    return { amount: amount.x, paid: paid.x, gap: paid.x - amount.right, edge: container.right - paid.right,
      rowGap: paidCell.x - amountCell.right, paidWidth: paid.width };
  });
  await table.evaluate(element => { element.parentElement!.scrollLeft = 0; });
  const before = await positions();
  await table.evaluate(element => { element.parentElement!.scrollLeft = element.parentElement!.scrollWidth; });
  const after = await positions();
  expect(after.paidWidth).toBe(64);
  expect(Math.abs(after.amount - before.amount), JSON.stringify({ before, after })).toBeLessThan(1);
  expect(Math.abs(after.paid - before.paid)).toBeLessThan(1);
  expect(Math.abs(after.gap)).toBeLessThan(1);
  expect(Math.abs(after.rowGap)).toBeLessThan(1);
  expect(Math.abs(after.edge)).toBeLessThan(2);
  await page.getByRole("region", { name: "Obědy", exact: true }).screenshot({ path: "/tmp/habitat-lunch-paid-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("region", { name: "Obědy", exact: true }).screenshot({ path: "/tmp/habitat-lunch-paid-desktop.png" });

  await page.getByRole("link", { name: "Následující měsíc" }).click();
  await expect(paid("Božena Bublina")).not.toBeChecked();
  await page.getByRole("link", { name: "Předchozí měsíc" }).click();
  await expect(paid("Božena Bublina")).toBeChecked();

  await persona(page, "parent-bedrich");
  await page.goto(`/rodic?child=seed-child-bozena&lunchMonth=${month}#obedy`);
  await expect(table.getByRole("columnheader", { name: "Zaplaceno" })).toHaveCount(0);
  await expect(table.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: `Platba ${monthName}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Obědy ${monthName}: Max Mlsoun`, { exact: true })).toBeVisible();
  const parentMax = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Max Mlsoun", exact: true }) });
  const maxAmount = await parentMax.getByRole("cell").last().textContent();
  await expect(dialog.getByText(maxAmount!, { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await persona(page, "director-bohumil");
  await page.goto(`/reditel?month=${month}#obedy`);
  await paid("Max Mlsoun").check();
  await expect(paid("Max Mlsoun")).toBeEnabled();
  await persona(page, "parent-bedrich");
  await page.goto(`/rodic?child=seed-child-bozena&lunchMonth=${month}#obedy`);
  await expect(page.getByRole("status").filter({ hasText: `Obědy za ${monthLabel} máte zaplacené.` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Platba ${monthName}` })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: `Obědy za ${monthLabel} máte zaplacené.` })).toBeVisible();

  await persona(page, "director-bohumil");
  await page.goto(`/reditel?month=${month}#obedy`);
  for (const name of ["Božena Bublina", "Max Mlsoun"]) {
    await paid(name).uncheck();
    await expect(paid(name)).toBeEnabled();
  }
  await persona(page, "parent-bedrich");
  await page.goto(`/rodic?child=seed-child-bozena&lunchMonth=${month}#obedy`);
  await expect(page.getByRole("button", { name: `Platba ${monthName}` })).toBeEnabled();
});
