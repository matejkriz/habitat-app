import { expect, test } from "@playwright/test";
import { persona } from "./helpers";

const date = process.env.E2E_DATE ?? "2026-09-17";
const month = date.slice(0, 7);
const [year, monthNumber] = month.split("-").map(Number);
const nextDate = new Date(year, monthNumber, 1);
const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
function monthLabel(month: string) {
  const label = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
const money = (amount: number) => new Intl.NumberFormat("cs-CZ", {
  style: "currency", currency: "CZK", minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
}).format(amount);

test("monthly lunch pricing persists, carries forward, and reaches the parent overview", async ({ page }) => {
  await persona(page, "teacher-kveta");
  await page.getByLabel("Datum docházky").fill(date);
  const presence = page.getByRole("checkbox", { name: "Docházka: Oskar Okurka" });
  await expect(presence).toBeAttached();
  if (!(await presence.isChecked())) {
    await presence.check({ force: true });
    await page.getByRole("button", { name: /Potvrdit docházku|Uložit změny/ }).click();
    await expect(page.getByText(/Docházka uložena/)).toBeVisible();
  }

  await persona(page, "director-bohumil");
  await page.goto(`/reditel?month=${month}#obedy`);
  const price = page.getByLabel("Cena jednoho obědu (Kč)");
  await expect(price).toHaveValue("55");
  await price.fill("65,50");
  await page.getByRole("button", { name: "Uložit cenu" }).click();
  await expect(page.getByText("Cena byla uložena.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(price).toHaveValue("65.5");

  const table = page.getByRole("table", { name: /^Obědy/ });
  const oskar = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Oskar Okurka", exact: true }) });
  const count = Number(await oskar.getByRole("cell").nth(-2).textContent());
  expect(count).toBeGreaterThan(0);
  await expect(oskar.getByRole("cell").last()).toHaveText(money(count * 65.5));
  const rowCounts = await table.locator("tbody tr").evaluateAll(rows => rows.map(row => Number(row.querySelector("td:nth-last-child(2)")?.textContent)));
  const total = rowCounts.reduce((sum, value) => sum + value, 0);
  const footer = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Součet", exact: true }) });
  await expect(footer.getByRole("cell").nth(-2)).toHaveText(String(total));
  await expect(footer.getByRole("cell").last()).toHaveText(money(total * 65.5));

  await page.setViewportSize({ width: 390, height: 844 });
  await table.evaluate(element => { element.parentElement!.scrollLeft = element.parentElement!.scrollWidth; });
  await expect(oskar.getByRole("cell").last()).toBeVisible();
  await page.getByRole("region", { name: "Obědy", exact: true }).screenshot({ path: "/tmp/habitat-lunch-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("region", { name: "Obědy", exact: true }).screenshot({ path: "/tmp/habitat-lunch-desktop.png" });

  await page.getByRole("link", { name: "Následující měsíc" }).click();
  await expect(page).toHaveURL(new RegExp(`month=${nextMonth}`));
  await expect(page.getByRole("heading", { name: monthLabel(nextMonth), exact: true })).toBeVisible();
  await expect(price).toHaveValue("65.5");
  await price.fill("70");
  await page.getByRole("button", { name: "Uložit cenu" }).click();
  await expect(page.getByText("Cena byla uložena.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Uložit cenu" })).toBeEnabled();
  await page.getByRole("link", { name: "Předchozí měsíc" }).click();
  await expect(page).toHaveURL(new RegExp(`month=${month}`));
  await expect(page.getByRole("heading", { name: monthLabel(month), exact: true })).toBeVisible();
  await expect(price).toHaveValue("65.5");

  await persona(page, "parent-roza");
  await page.goto(`/rodic?child=seed-child-oskar&lunchMonth=${month}#obedy`);
  const parentTable = page.getByRole("table", { name: /^Obědy/ });
  const parentRow = parentTable.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Oskar Okurka", exact: true }) });
  await expect(parentRow.getByRole("cell").last()).toHaveText(money(count * 65.5));
  await expect(price).toHaveCount(0);
  await expect(parentTable.getByRole("rowheader", { name: "Součet" })).toHaveCount(0);
});
