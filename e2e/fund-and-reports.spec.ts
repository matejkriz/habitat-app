import { expect, test, type Page } from "@playwright/test";
import { persona } from "./helpers";

const date = process.env.E2E_DATE!;
const money = (amount: number) => new Intl.NumberFormat("cs-CZ", {
  style: "currency", currency: "CZK", maximumFractionDigits: 0,
}).format(amount);

async function fundRow(page: Page, name: string, balance: number) {
  const table = page.getByRole("table", { name: "Výletní fond", exact: true });
  const row = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name, exact: true }) });
  await expect(row.getByRole("cell").last()).toHaveText(money(balance));
  return row;
}

test("trip fund persists individual charges and recalculates after attendance correction", async ({ page }) => {
  const firstName = `E2EFond${Date.now()}`;
  const name = `${firstName} Testovací`;
  await persona(page, "director-bohumil");
  await page.goto("/reditel/deti");
  await page.getByLabel("Jméno", { exact: true }).fill(firstName);
  await page.getByLabel("Příjmení", { exact: true }).fill("Testovací");
  await page.getByLabel("Pohlaví", { exact: true }).selectOption("FEMALE");
  await page.getByRole("button", { name: "Přidat dítě", exact: true }).click();
  const child = page.locator("div.rounded-lg").filter({
    has: page.getByRole("button", { name: `Upravit ${name}`, exact: true }),
  }).last();
  await child.getByRole("button", { name: "Přiřadit rodiče" }).click();
  await page.getByLabel("Vyberte rodiče").selectOption("seed-user-parent-roza");
  await page.getByRole("button", { name: "Přiřadit", exact: true }).click();
  await expect(page.getByLabel("Vyberte rodiče")).not.toBeVisible();

  await page.goto("/reditel");
  await page.getByRole("button", { name: `Upravit příjem: ${name}`, exact: true }).click();
  await page.getByLabel("Částka (Kč)", { exact: true }).fill("1000");
  await page.getByLabel("Částka (Kč)", { exact: true }).press("Enter");
  await fundRow(page, name, 1000);

  await persona(page, "teacher-kveta");
  await page.goto(`/ucitel/dochazka?date=${date}`);
  const attendance = page.getByRole("checkbox", { name: `Docházka: ${name}`, exact: true });
  await expect(attendance).toBeAttached();
  await attendance.check({ force: true });
  await page.getByRole("button", { name: /Potvrdit docházku|Uložit změny/ }).click();
  await expect(page.getByText(/Docházka uložena/)).toBeVisible();

  await persona(page, "director-bohumil");
  await page.getByRole("button", { name: "Přidat útratu", exact: true }).click();
  await page.getByLabel("Datum výletu").fill(date);
  await page.getByLabel("Výchozí částka (Kč)").fill("120");
  await page.getByLabel(`Útrata ${name} (Kč)`, { exact: true }).fill("80");
  await page.getByRole("button", { name: "Uložit útratu", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  const row = await fundRow(page, name, 920);
  await expect(row.getByRole("button", { name: /^Upravit útratu:/ })).toHaveText(money(80));

  await persona(page, "parent-roza");
  const parentRow = await fundRow(page, name, 920);
  await expect(parentRow.getByRole("button")).toHaveCount(0);
  await expect(parentRow.getByRole("cell").filter({ hasText: /^80\s*Kč$/ })).toHaveCount(1);

  await persona(page, "teacher-kveta");
  await page.goto(`/ucitel/dochazka?date=${date}`);
  await expect(attendance).toBeChecked();
  await attendance.uncheck({ force: true });
  await page.getByRole("button", { name: "Uložit změny", exact: true }).click();
  await expect(page.getByText(/Docházka uložena/)).toBeVisible();
  await persona(page, "director-bohumil");
  await fundRow(page, name, 1000);
  await persona(page, "parent-roza");
  await page.reload();
  const corrected = await fundRow(page, name, 1000);
  await expect(corrected.getByText(money(80), { exact: true })).toHaveCount(0);
  await persona(page, "parent-bedrich");
  await expect(page.getByRole("table", { name: "Výletní fond", exact: true })).toBeVisible();
  await expect(page.getByRole("rowheader", { name, exact: true })).toHaveCount(0);
});

test("teacher report survives reload and is read-only for parents", async ({ page }) => {
  const marker = `E2EReport${Date.now()}`;
  await persona(page, "teacher-kveta");
  await page.goto("/kalendar");
  await page.getByRole("button", { name: "Přidat report", exact: true }).click();
  await page.getByLabel("Datum", { exact: true }).fill(date);
  const input = page.getByLabel("Report", { exact: true });
  await expect(input).toBeEnabled();
  // Preserve any existing test report when rerunning the scenario.
  await input.fill(`${await input.inputValue()}\n\n**${marker}**`);
  await page.getByRole("button", { name: "Uložit report", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await persona(page, "parent-roza");
  await page.reload();
  const region = page.getByRole("region", { name: "Denní reporty", exact: true });
  await expect(region).toBeVisible();
  for (let i = 0; i < 40 && !(await region.getByText(marker, { exact: true }).isVisible()); i++) {
    const currentDate = region.locator("#current-report-date");
    const previous = await currentDate.innerText();
    await page.getByRole("button", { name: /^Starší report:/ }).click();
    await expect(currentDate).not.toHaveText(previous);
    await expect(region).toHaveAttribute("aria-busy", "false");
  }
  await expect(region.locator("strong").getByText(marker, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Přidat report|Uložit report|Upravit report/ })).toHaveCount(0);
  await expect(page.getByLabel("Report", { exact: true })).toHaveCount(0);
});
