import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function expectMealLayout(day: Locator) {
  const meal = day.getByRole("group", { name: "Jídlo", exact: true });
  const groupBounds = await meal.boundingBox();
  const iconBounds = await meal.locator("svg").boundingBox();
  expect(groupBounds).not.toBeNull();
  expect(iconBounds).not.toBeNull();
  expect(Math.abs(iconBounds!.x + iconBounds!.width / 2 - groupBounds!.x - groupBounds!.width / 2)).toBeLessThan(2);
  expect(Math.abs(iconBounds!.y + iconBounds!.height / 2 - groupBounds!.y)).toBeLessThan(2);
  const badge = meal.getByLabel("Počet objednaných jídel: 100", { exact: true });
  if (await badge.count()) {
    const badgeBounds = (await badge.boundingBox())!;
    const dayBounds = (await day.boundingBox())!;
    expect(badgeBounds.height).toBeLessThanOrEqual(24);
    expect(badgeBounds.x + badgeBounds.width).toBeLessThanOrEqual(groupBounds!.x + groupBounds!.width);
    expect(badgeBounds.x).toBeGreaterThanOrEqual(dayBounds.x);
    expect(badgeBounds.x + badgeBounds.width).toBeLessThanOrEqual(dayBounds.x + dayBounds.width);
  }
}

test("director meal edits reach both calendars and disappear when cleared", async ({ page }) => {
  test.setTimeout(120_000);
  const marker = `E2EJidlo${Date.now()}`;
  const soup = `Hrášková polévka ${marker}`;
  const main = "Pečené kuře, brambory a zeleninový salát";
  const meal = `${soup}\n${main}`;

  await persona(page, "director-bohumil");
  await (await openMealEditor(page)).fill(meal);
  await page.getByRole("spinbutton", { name: "Počet objednaných jídel", exact: true }).fill("100");
  await page.getByRole("button", { name: "Uložit podrobnosti", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Podrobnosti uloženy." })).toBeVisible();
  await page.reload();
  const directorMeal = page.getByRole("group", { name: "Jídlo", exact: true });
  await expect(directorMeal).toContainText(soup);
  await expect(directorMeal).toContainText(main);
  await expect(directorMeal.getByLabel("Počet objednaných jídel: 100", { exact: true })).toBeVisible();
  await page.locator("summary").filter({ hasText: /^Podrobnosti$/ }).click();
  await expect(page.getByRole("textbox", { name: "Jídlo", exact: true })).toHaveValue(meal);
  await expect(page.getByRole("spinbutton", { name: "Počet objednaných jídel", exact: true })).toHaveValue("100");
  const directorDay = await openStaffCalendar(page);
  await expect(directorDay.getByLabel("Počet objednaných jídel: 100", { exact: true })).toBeVisible();
  await directorDay.click();
  await expect(page.getByRole("dialog").getByRole("spinbutton", { name: "Počet objednaných jídel", exact: true })).toHaveValue("100");
  await page.keyboard.press("Escape");

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const mobileDay = page.getByRole("button", { name: new RegExp(`^${escapeRegExp(formattedDate)}`) }).first();
    await expectMealLayout(mobileDay);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  await persona(page, "teacher-kveta");
  await page.goto(`/ucitel/dochazka?date=${date}`);
  const teacherMeal = page.getByRole("group", { name: "Jídlo", exact: true });
  await expect(teacherMeal).toContainText(soup);
  await expect(teacherMeal).toContainText(main);
  await expect(page.getByRole("spinbutton", { name: "Počet objednaných jídel", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Počet objednaných jídel: 100", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Jídlo", exact: true })).toHaveCount(0);
  const day = await openStaffCalendar(page);
  await expect(day).toContainText(soup);
  await day.click();
  const staffDialog = page.getByRole("dialog");
  await expect(staffDialog.getByRole("group", { name: "Jídlo", exact: true })).toContainText(main);
  await expect(staffDialog.getByRole("textbox", { name: "Jídlo", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Počet objednaných jídel: 100", { exact: true })).toHaveCount(0);
  await expect(staffDialog.getByRole("spinbutton", { name: "Počet objednaných jídel", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await persona(page, "parent-roza");
  await page.goto(`/rodic?child=${childId}&month=${month}`);
  const mealButton = page.getByRole("button", { name: `Jídlo · ${formattedDate}`, exact: true });
  await expect(mealButton).toContainText(soup);
  await expect(page.getByRole("spinbutton", { name: "Počet objednaných jídel", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Počet objednaných jídel: 100", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Jídlo", exact: true })).toHaveCount(0);
  for (const width of [1280, 320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expectMealLayout(mealButton);
    const heights = await mealButton.evaluate(button => {
      const grid = button.parentElement!.parentElement!;
      return Array.from(grid.children)
        .filter(card => card.querySelector("button") && card.getBoundingClientRect().width > 0)
        .map(card => card.getBoundingClientRect().height);
    });
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
    if (width < 640) {
      const dotPosition = await mealButton.evaluate(button => {
        const day = button.parentElement!.querySelector("button")!;
        const card = day.getBoundingClientRect();
        const dot = day.querySelector('[aria-hidden="true"]')!.getBoundingClientRect();
        return { top: dot.top - card.top, right: card.right - dot.right };
      });
      expect(dotPosition.top).toBeLessThan(16);
      expect(dotPosition.right).toBeLessThan(16);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await mealButton.click();
  const parentDialog = page.getByRole("dialog");
  await expect(parentDialog.getByRole("group", { name: "Jídlo", exact: true })).toContainText(soup);
  await expect(parentDialog.getByRole("group", { name: "Jídlo", exact: true })).toContainText(main);
  await expect(parentDialog.getByLabel("Počet objednaných jídel: 100", { exact: true })).toHaveCount(0);
  await parentDialog.getByRole("button", { name: "Zavřít", exact: true }).click();
  await expect(parentDialog).not.toBeVisible();
  await page.getByRole("button", {
    name: new RegExp(`^${escapeRegExp(formattedDate)}`),
  }).click();
  await expect(page).toHaveURL(new RegExp(`/rodic/omluvenka\\?child=${childId}&date=${date}`));

  await persona(page, "director-bohumil");
  await (await openMealEditor(page)).fill("");
  await page.getByRole("spinbutton", { name: "Počet objednaných jídel", exact: true }).fill("");
  await page.getByRole("button", { name: "Uložit podrobnosti", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Podrobnosti uloženy." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("group", { name: "Jídlo", exact: true })).toHaveCount(0);
  await persona(page, "parent-roza");
  await page.goto(`/rodic?child=${childId}&month=${month}`);
  await expect(mealButton).toHaveCount(0);
  await expect(page.getByText(marker, { exact: false })).toHaveCount(0);
});
