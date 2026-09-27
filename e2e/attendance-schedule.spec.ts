import { expect, test, type Page } from "@playwright/test";
import { persona } from "./helpers";

const childId = "seed-child-oskar";
const childName = "Oskar Okurka";
const weekdays = ["Pondělí", "Úterý", "Středa", "Čtvrtek"];

function futureTuesday() {
  const date = new Date();
  date.setDate(date.getDate() + 4);
  while (date.getDay() !== 2) date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function setRegularTuesday(page: Page, attends: boolean) {
  await page.goto("/reditel/deti");
  await page.getByRole("button", { name: `Upravit ${childName}`, exact: true }).click();
  const tuesday = page.getByRole("button", { name: "Úterý", exact: true });
  if ((await tuesday.getAttribute("aria-pressed")) !== String(attends)) await tuesday.click();
  await expect(tuesday).toHaveAttribute("aria-pressed", String(attends));
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(tuesday).not.toBeVisible();
}

async function openCalendarDay(page: Page, date: string) {
  await page.goto("/kalendar");
  const label = new Date(`${date}T12:00:00`).toLocaleDateString("cs-CZ", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const day = page.getByRole("button", { name: new RegExp(`^${label}`) });
  if (!(await day.isVisible())) {
    await page.getByRole("button", { name: "Další měsíc", exact: true }).click();
  }
  await day.click();
  return page.getByRole("dialog");
}

test("regular day off → parent makeup → staff plan and enrolled lunch without attendance", async ({ page }) => {
  test.skip(process.env.E2E_LOCAL !== "true", "Writes only to the isolated local seeded E2E database.");
  const date = futureTuesday();
  const month = date.slice(0, 7);
  const dayNumber = Number(date.slice(-2));
  const marker = `E2EMakeup${Date.now()}`;
  let created = false;

  await persona(page, "director-bohumil");
  try {
    await page.goto("/reditel/deti");
    await page.getByRole("button", { name: `Upravit ${childName}`, exact: true }).click();
    for (const weekday of weekdays) {
      await expect(page.getByRole("button", { name: weekday, exact: true })).toHaveAttribute("aria-pressed", "true");
    }
    await page.getByRole("button", { name: "Zrušit", exact: true }).click();
    await setRegularTuesday(page, false);
    await page.reload();
    await page.getByRole("button", { name: `Upravit ${childName}`, exact: true }).click();
    await expect(page.getByRole("button", { name: "Úterý", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Zrušit", exact: true }).click();

    await page.goto(`/reditel/obedy?month=${month}`);
    const lunchRow = page.getByRole("row").filter({ hasText: childName });
    await expect(lunchRow.getByRole("img", { name: `${dayNumber}.: Nechodí`, exact: true })).toBeVisible();

    await persona(page, "teacher-kveta");
    let dialog = await openCalendarDay(page, date);
    await expect(dialog.getByText("Nechodí", { exact: true })).toBeVisible();
    const expectedChildren = dialog.locator("section").filter({ has: page.getByRole("heading", { name: "Očekáváme", exact: true }) });
    await expect(expectedChildren.getByText(childName, { exact: true })).toHaveCount(0);

    await persona(page, "parent-roza");
    await page.goto(`/rodic?child=${childId}&month=${month}`);
    const offDay = page.getByRole("button", { name: new RegExp(`úterý ${dayNumber}\\..*Nechodí, zadat náhradu`) });
    await offDay.click();
    await expect(page.getByRole("tab", { name: "Náhrada", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByLabel("Poznámka (volitelné)").fill(marker);
    await page.getByRole("button", { name: "Odeslat náhradu", exact: true }).click();
    await expect(page.getByText("Oběd bude přihlášen.", { exact: true })).toBeVisible();
    created = true;
    await expect(page).toHaveURL(/\/rodic\?child=/);

    await persona(page, "teacher-kveta");
    await page.goto(`/ucitel/dochazka?date=${date}`);
    const plannedChild = page.locator("label").filter({ hasText: childName });
    await expect(plannedChild.getByText("Náhrada", { exact: true })).toBeVisible();
    await expect(plannedChild.getByText("Přítomen", { exact: true })).toBeVisible();
    dialog = await openCalendarDay(page, date);
    const makeupExpected = dialog.locator("section").filter({ has: page.getByRole("heading", { name: "Očekáváme", exact: true }) });
    await expect(makeupExpected.getByText(childName, { exact: true })).toBeVisible();
    await expect(makeupExpected.getByText("Náhrada", { exact: true })).toBeVisible();

    await persona(page, "director-bohumil");
    await page.goto("/reditel/omluvenky");
    const record = page.locator("div.rounded-lg").filter({ has: page.getByText(`Důvod: ${marker}`, { exact: true }) }).last();
    await expect(record.getByText("Náhrada", { exact: true })).toBeVisible();
    await expect(record.getByRole("button", { name: "Přihlásit oběd", exact: true })).toHaveCount(0);
    await page.goto(`/reditel/obedy?month=${month}`);
    await expect(lunchRow.getByRole("img", { name: `${dayNumber}.: Náhrada, oběd přihlášen`, exact: true })).toBeVisible();
  } finally {
    await persona(page, "director-bohumil");
    if (created) {
      await page.goto("/reditel/omluvenky");
      const record = page.locator("div.rounded-lg").filter({ has: page.getByText(`Důvod: ${marker}`, { exact: true }) }).last();
      page.once("dialog", dialog => dialog.accept());
      await record.getByRole("button", { name: "Smazat", exact: true }).click();
      await expect(page.getByText(`Důvod: ${marker}`, { exact: true })).toHaveCount(0);
    }
    await setRegularTuesday(page, true);
  }
});
