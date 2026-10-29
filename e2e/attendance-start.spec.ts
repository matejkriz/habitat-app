import { expect, test } from "@playwright/test";
import { persona } from "./helpers";

const scenarioDay = new Date(`${process.env.E2E_DATE ?? "2026-09-17"}T12:00:00Z`);
scenarioDay.setUTCDate(scenarioDay.getUTCDate() - 7);
const startDate = scenarioDay.toISOString().slice(0, 10);

function precedingSchoolDay(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  do {
    day.setUTCDate(day.getUTCDate() - 1);
  } while ([0, 5, 6].includes(day.getUTCDay()));
  return day.toISOString().slice(0, 10);
}

function calendarDateLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("cs-CZ", {
    weekday: "long", day: "numeric", month: "long",
  });
}

test("child starts on the selected date across director, teacher, parent, and lunch views", async ({ page }) => {
  test.skip(process.env.E2E_LOCAL !== "true", "Writes only to the isolated local seeded E2E database.");
  test.setTimeout(90_000);
  const previousDate = precedingSchoolDay(startDate);
  const firstName = `E2EStart${Date.now()}`;
  const childName = `${firstName} Nástupová`;
  let created = false;

  const childCard = page.locator("div.rounded-lg").filter({
    has: page.getByRole("button", { name: `Upravit ${childName}`, exact: true }),
  }).last();

  await persona(page, "director-bohumil");
  try {
    await page.goto("/reditel/deti");
    await page.getByLabel("Jméno", { exact: true }).fill(firstName);
    await page.getByLabel("Příjmení", { exact: true }).fill("Nástupová");
    await page.getByLabel("Pohlaví", { exact: true }).selectOption("FEMALE");
    await page.getByLabel("Datum nástupu", { exact: true }).fill(startDate);
    await page.getByRole("button", { name: "Ulož dítě", exact: true }).click();
    await expect(childCard).toBeVisible();
    created = true;
    await expect(childCard).toContainText(`Nástup: ${new Date(`${startDate}T12:00:00Z`).toLocaleDateString("cs-CZ")}`);
    await page.reload();
    await childCard.getByRole("button", { name: `Upravit ${childName}`, exact: true }).click();
    await expect(page.getByLabel("Datum nástupu", { exact: true }).last()).toHaveValue(startDate);
    await page.getByRole("button", { name: "Zrušit", exact: true }).click();
    await childCard.getByRole("button", { name: "Přiřadit rodiče", exact: true }).click();
    await page.getByLabel("Vyberte rodiče").selectOption("seed-user-parent-roza");
    await page.getByRole("button", { name: "Přiřadit", exact: true }).click();
    await expect(page.getByLabel("Vyberte rodiče")).not.toBeVisible();

    await persona(page, "teacher-kveta");
    await page.goto(`/ucitel/dochazka?date=${previousDate}`);
    const attendanceToggle = page.getByRole("checkbox", { name: `Docházka: ${childName}`, exact: true });
    await expect(attendanceToggle).toBeDisabled();
    await expect(page.locator("label").filter({ has: attendanceToggle })).toContainText("Před nástupem");
    const startedToggles = page.locator('input[type="checkbox"][aria-label^="Docházka:"]:enabled');
    const startedCount = await startedToggles.count();
    expect(startedCount).toBeGreaterThan(0);
    const otherChild = startedToggles.first();
    await otherChild.setChecked(!(await otherChild.isChecked()), { force: true });
    await page.getByRole("button", { name: /^(Potvrdit docházku|Uložit změny)$/ }).click();
    await expect(page.getByText(`Docházka uložena (${startedCount} záznamů)`, { exact: true })).toBeVisible();
    await page.reload();
    await expect(attendanceToggle).toBeDisabled();
    await expect(attendanceToggle).not.toBeChecked();

    await page.goto(`/ucitel/dochazka?date=${startDate}`);
    await expect(attendanceToggle).toBeEnabled();
    await expect(attendanceToggle).toBeChecked();
    await page.getByRole("button", { name: /^(Potvrdit docházku|Uložit změny)$/ }).click();
    await expect(page.getByText(/Docházka uložena/)).toBeVisible();
    await page.reload();
    await expect(attendanceToggle).toBeChecked();

    await persona(page, "director-bohumil");
    await page.goto(`/reditel/obedy?month=${previousDate.slice(0, 7)}`);
    const lunchTable = page.getByRole("table", { name: /^Obědy/ });
    const lunchRow = lunchTable.getByRole("row").filter({
      has: page.getByRole("rowheader", { name: childName, exact: true }),
    });
    await expect(lunchRow.getByRole("img", { name: `${Number(previousDate.slice(-2))}.: Před nástupem`, exact: true })).toBeVisible();
    if (previousDate.slice(0, 7) !== startDate.slice(0, 7)) {
      await page.goto(`/reditel/obedy?month=${startDate.slice(0, 7)}`);
    }
    await expect(lunchRow.getByRole("img", { name: `${Number(startDate.slice(-2))}.: Přišla`, exact: true })).toBeVisible();
    const payableDays = await lunchRow.getByRole("img", { name: /\.: (Přišla|Přijde)$/ }).count();
    expect(payableDays).toBeGreaterThan(0);
    const headers = await lunchTable.locator("thead th").allTextContents();
    const totalColumn = headers.findIndex(text => text.trim() === "Celkem");
    expect(totalColumn).toBeGreaterThan(0);
    await expect(lunchRow.locator(":scope > th, :scope > td").nth(totalColumn)).toHaveText(String(payableDays));

    await persona(page, "parent-roza");
    const childSelector = page.getByRole("combobox").filter({
      has: page.getByRole("option", { name: firstName, exact: true }),
    });
    const childId = await childSelector.getByRole("option", { name: firstName, exact: true }).getAttribute("value");
    expect(childId).toBeTruthy();
    await page.goto(`/rodic?child=${childId}&month=${previousDate.slice(0, 7)}`);
    const beforeStart = page.getByRole("button", { name: `${calendarDateLabel(previousDate)}, Před nástupem`, exact: true });
    await expect(beforeStart).toBeDisabled();
    if (previousDate.slice(0, 7) !== startDate.slice(0, 7)) {
      await page.goto(`/rodic?child=${childId}&month=${startDate.slice(0, 7)}`);
    }
    await expect(page.getByRole("button", { name: `${calendarDateLabel(startDate)}, Přišla, zadat omluvenku`, exact: true })).toBeEnabled();
  } finally {
    if (created) {
      await persona(page, "director-bohumil");
      await page.goto("/reditel/deti");
      await childCard.getByRole("button", { name: "Deaktivovat", exact: true }).click();
      await expect(childCard.getByText("Neaktivní", { exact: true })).toBeVisible();
    }
  }
});
