import { expect, request, test, type Page } from "@playwright/test";
import { persona } from "./helpers";

const date = process.env.E2E_DATE ?? "2026-09-17";
async function editor(page: Page) {
  await page.goto(`/ucitel/dochazka?date=${date}`);
  await page.locator("summary").filter({ hasText: /^Podrobnosti$/ }).click();
  return {
    name: page.getByRole("textbox", { name: "Jméno dne", exact: true }),
    meal: page.getByRole("textbox", { name: "Jídlo", exact: true }),
    report: page.getByRole("textbox", { name: "Report", exact: true }),
  };
}
async function links(page: Page, path: string) {
  await page.goto(path);
  return { habitat: await copyLink(page, "Habitat"), jidelnicek: await copyLink(page, "Habitat jídelníček") };
}

async function copyLink(page: Page, calendar: string) {
  const button = page.getByRole("button", { name: `Kopírovat odkaz na kalendář ${calendar}`, exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toHaveText("Zkopírováno");
  return page.evaluate(() => navigator.clipboard.readText());
}

test("shared calendar copy buttons provide stable feeds that update and cancel without a browser session", async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const anonymous = await request.newContext({ storageState: { cookies: [], origins: [] } });
  const programMarker = `CalendarProgram${Date.now()}`;
  const mealMarker = `CalendarMeal${Date.now()}`;
  const privateMarker = `CalendarPrivate${Date.now()}`;
  await persona(page, "director-bohumil");
  let fields = await editor(page);
  const original = { name: await fields.name.inputValue(), meal: await fields.meal.inputValue(), report: await fields.report.inputValue() };
  try {
    await fields.name.fill(programMarker);
    await fields.meal.fill(`Polévka ${mealMarker}\nRizoto`);
    await fields.report.fill(privateMarker);
    await page.getByRole("button", { name: "Uložit podrobnosti", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Podrobnosti uloženy." })).toBeVisible();
    const staff = await links(page, "/kalendar");
    const initial = await anonymous.get(staff.habitat);
    expect(initial.status()).toBe(200);
    expect(initial.headers()["content-type"]).toContain("text/calendar");
    const initialText = (await initial.text()).replace(/\r\n[ \t]/g, "");
    expect(initialText).toContain(`SUMMARY:${programMarker}\r\n`);
    expect(initialText).not.toContain(privateMarker);
    expect(initialText).not.toContain(mealMarker);
    expect((await anonymous.get(staff.habitat, { headers: { "If-None-Match": initial.headers().etag } })).status()).toBe(304);
    const menu = (await (await anonymous.get(staff.jidelnicek)).text()).replace(/\r\n[ \t]/g, "");
    expect(menu).toContain(`DESCRIPTION:Polévka ${mealMarker}\\nRizoto`);
    expect(menu).not.toContain(programMarker);
    expect(menu).not.toContain(privateMarker);
    expect((await anonymous.post(staff.habitat)).status()).toBe(405);

    await persona(page, "parent-roza");
    const parent = await links(page, "/rodic");
    expect(parent.habitat).not.toBe(staff.habitat);
    expect(await (await anonymous.get(parent.habitat)).text()).toBe(await initial.text());
    await page.reload();
    expect(await copyLink(page, "Habitat")).toBe(parent.habitat);

    await persona(page, "director-bohumil");
    fields = await editor(page);
    await fields.name.fill("");
    await fields.meal.fill("");
    await page.getByRole("button", { name: "Uložit podrobnosti", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Podrobnosti uloženy." })).toBeVisible();
    const cancelled = await anonymous.get(parent.habitat, { headers: { "If-None-Match": initial.headers().etag } });
    expect(cancelled.status()).toBe(200);
    const event = (await cancelled.text()).replace(/\r\n[ \t]/g, "").split("BEGIN:VEVENT").find(value => value.includes(programMarker));
    expect(event).toContain("STATUS:CANCELLED");
    expect(event).toContain("SEQUENCE:1");
    expect(await (await anonymous.get(parent.jidelnicek)).text()).toContain("STATUS:CANCELLED");

  } finally {
    await anonymous.dispose();
    await persona(page, "director-bohumil");
    fields = await editor(page);
    await fields.name.fill(original.name);
    await fields.meal.fill(original.meal);
    await fields.report.fill(original.report);
    await page.getByRole("button", { name: "Uložit podrobnosti", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Podrobnosti uloženy." })).toBeVisible();
  }
});
