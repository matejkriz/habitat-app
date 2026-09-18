import { expect, test, type Page } from "@playwright/test";

const date = process.env.E2E_DATE ?? "2026-09-17";
const childId = "seed-child-zofie";
const childName = "Žofie Žížalka";
const marker = `E2E-${Date.now()}`;

async function persona(
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

async function setAbsence(page: Page) {
  await persona(page, "teacher-kveta");
  await page.getByLabel("Datum docházky").fill(date);
  const toggle = page.getByRole("checkbox", { name: `Docházka: ${childName}` });
  await expect(toggle).toBeAttached();
  if (!(await toggle.isChecked())) {
    await toggle.check({ force: true });
    await page.getByRole("button", { name: /Potvrdit docházku|Uložit změny/ }).click();
    await expect(page.getByText(/Docházka uložena/)).toBeVisible();
  }
  await toggle.uncheck({ force: true });
  await page.getByRole("button", { name: /Potvrdit docházku|Uložit změny/ }).click();
  await expect(page.getByText(/Docházka uložena/)).toBeVisible();
}

test("parent excuse → director approval → lunch cancellation", async ({
  page,
}) => {
  await setAbsence(page);
  await persona(page, "parent-roza");
  await page.goto(`/rodic/omluvenka?child=${childId}&date=${date}`);
  await expect(page.getByRole("checkbox", { name: "Žofie", exact: true })).toBeChecked();
  await page.getByLabel("Důvod (volitelné)").fill(marker);
  await page.getByRole("button", { name: "Odeslat omluvenku" }).click();
  await expect(page).toHaveURL(/\/rodic\?child=/);
  await expect(page.getByText(marker, { exact: true })).toBeVisible();

  await persona(page, "director-bohumil");
  await page.goto("/reditel/omluvenky");
  const excuse = page
    .locator("div.rounded-lg")
    .filter({ has: page.getByText(`Důvod: ${marker}`, { exact: true }) })
    .last();
  await excuse.getByRole("button", { name: "Schválit", exact: true }).click();
  await expect(
    excuse.getByRole("button", { name: "Zrušit schválení" }),
  ).toBeVisible();
  await page.goto(`/reditel/obedy?month=${date.slice(0, 7)}`);
  const row = page.getByRole("row").filter({ hasText: childName });
  await expect(
    row.getByRole("img", {
      name: `${Number(date.slice(-2))}.: Včas omluven/a`,
      exact: true,
    }),
  ).toBeVisible();
});

test("saved attendance survives reload and is visible to the parent", async ({
  page,
}) => {
  await setAbsence(page);
  await page.reload();
  await page.getByLabel("Datum docházky").fill(date);
  await expect(
    page.getByRole("checkbox", { name: `Docházka: ${childName}` }),
  ).not.toBeChecked();
  await persona(page, "parent-roza");
  await page.goto(`/rodic?child=${childId}&month=${date.slice(0, 7)}`);
  const formatted = new Date(`${date}T12:00:00Z`).toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  await expect(
    page.getByRole("button", {
      name: new RegExp(`${formatted}.*(Nepřítomna|Omluvena|Bez omluvy)`),
    }),
  ).toBeVisible();
});

test("director assigns a child and only the linked family sees it", async ({
  page,
}) => {
  const firstName = `E2E${Date.now()}`;
  const lastName = "Testovací";
  await persona(page, "director-bohumil");
  await page.goto("/reditel/deti");
  await expect(page.getByRole("heading", { name: "Přidat nové dítě" })).toBeVisible();
  await page.getByLabel("Jméno", { exact: true }).fill(firstName);
  await page.getByLabel("Příjmení", { exact: true }).fill(lastName);
  await page.getByLabel("Pohlaví", { exact: true }).selectOption("FEMALE");
  await page.getByRole("button", { name: "Přidat dítě", exact: true }).click();
  const child = page
    .locator("div.rounded-lg")
    .filter({
      has: page.getByRole("button", {
        name: `Upravit ${firstName} ${lastName}`,
        exact: true,
      }),
    })
    .last();
  await child.getByRole("button", { name: "Přiřadit rodiče" }).click();
  await page.getByLabel("Vyberte rodiče").selectOption("seed-user-parent-roza");
  await page.getByRole("button", { name: "Přiřadit", exact: true }).click();
  await expect(page.getByLabel("Vyberte rodiče")).not.toBeVisible();

  await persona(page, "parent-roza");
  await page.goto("/rodic/omluvenka");
  await expect(
    page.getByRole("checkbox", { name: firstName, exact: true }),
  ).toBeVisible();
  await persona(page, "parent-bedrich");
  await page.goto("/rodic/omluvenka");
  await expect(
    page.getByRole("checkbox", { name: "Božena", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: firstName, exact: true }),
  ).toHaveCount(0);
});
