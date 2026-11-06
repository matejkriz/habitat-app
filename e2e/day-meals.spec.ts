import { expect, test, type Page } from "@playwright/test";
import { persona } from "./helpers";

const date = process.env.E2E_DATE ?? "2026-09-17";
const month = date.slice(0, 7);
const childId = "seed-child-zofie";
const formattedDate = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Prague",
}).format(new Date(`${date}T12:00:00Z`));
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function openStaffCalendar(page: Page) {
  await page.goto("/kalendar");
  const currentMonth = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric", month: "2-digit", timeZone: "Europe/Prague",
  }).format(new Date());
  const [currentYear, currentMonthNumber] = currentMonth.split("-").map(Number);
  const [year, monthNumber] = month.split("-").map(Number);
  const offset = (year - currentYear) * 12 + monthNumber - currentMonthNumber;
  for (let step = 0; step < Math.abs(offset); step++) {
    const heading = page.getByRole("heading", { level: 2 }).first();
    const previous = await heading.textContent();
    await page.getByRole("button", {
      name: offset > 0 ? "Další měsíc" : "Předchozí měsíc", exact: true,
    }).click();
    await expect(heading).not.toHaveText(previous!);
  }
  return page.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(formattedDate)}`),
  }).first();
}

async function openMealEditor(page: Page) {
  await page.goto(`/ucitel/dochazka?date=${date}`);
  await page.locator("summary").filter({ hasText: /^Podrobnosti$/ }).click();
  const input = page.getByRole("textbox", { name: "Jídlo", exact: true });
  await expect(input).toBeVisible();
  return input;
}

test("director meal edits reach both calendars and disappear when cleared", async ({ page }) => {
  test.setTimeout(120_000);
  const marker = `E2EJidlo${Date.now()}`;
  const soup = `Hrášková polévka ${marker}`;
  const main = "Pečené kuře, brambory a zeleninový salát";
  const meal = `${soup}\n${main}`;

  await persona(page, "director-bohumil");
  await (await openMealEditor(page)).fill(meal);
  await page.getByRole("button", { name: "Uložit podrobnosti", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Podrobnosti uloženy." })).toBeVisible();
  await page.reload();
  const directorMeal = page.getByRole("group", { name: "Jídlo", exact: true });
  await expect(directorMeal).toContainText(soup);
  await expect(directorMeal).toContainText(main);
  await page.locator("summary").filter({ hasText: /^Podrobnosti$/ }).click();
  await expect(page.getByRole("textbox", { name: "Jídlo", exact: true })).toHaveValue(meal);

  await persona(page, "teacher-kveta");
  await page.goto(`/ucitel/dochazka?date=${date}`);
  const teacherMeal = page.getByRole("group", { name: "Jídlo", exact: true });
  await expect(teacherMeal).toContainText(soup);
  await expect(teacherMeal).toContainText(main);
  await expect(page.getByRole("textbox", { name: "Jídlo", exact: true })).toHaveCount(0);
  const day = await openStaffCalendar(page);
  await expect(day).toContainText(soup);
  await day.click();
  const staffDialog = page.getByRole("dialog");
  await expect(staffDialog.getByRole("group", { name: "Jídlo", exact: true })).toContainText(main);
  await expect(staffDialog.getByRole("textbox", { name: "Jídlo", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await persona(page, "parent-roza");
  await page.goto(`/rodic?child=${childId}&month=${month}`);
  const mealButton = page.getByRole("button", { name: `Jídlo · ${formattedDate}`, exact: true });
  await expect(mealButton).toContainText(soup);
  await expect(page.getByRole("textbox", { name: "Jídlo", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await mealButton.click();
  const parentDialog = page.getByRole("dialog");
  await expect(parentDialog.getByRole("group", { name: "Jídlo", exact: true })).toContainText(soup);
  await expect(parentDialog.getByRole("group", { name: "Jídlo", exact: true })).toContainText(main);
  await parentDialog.getByRole("button", { name: "Zavřít", exact: true }).click();
  await expect(parentDialog).not.toBeVisible();
  await page.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(formattedDate)}`),
  }).click();
  await expect(page).toHaveURL(new RegExp(`/rodic/omluvenka\\?child=${childId}&date=${date}`));

  await persona(page, "director-bohumil");
  await (await openMealEditor(page)).fill("");
  await page.getByRole("button", { name: "Uložit podrobnosti", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Podrobnosti uloženy." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "Jídlo", exact: true })).toHaveCount(0);
  await persona(page, "parent-roza");
  await page.goto(`/rodic?child=${childId}&month=${month}`);
  await expect(mealButton).toHaveCount(0);
  await expect(page.getByText(marker, { exact: false })).toHaveCount(0);
});
