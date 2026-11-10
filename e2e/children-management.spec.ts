import { expect, test, type Locator, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { persona } from "./helpers";

function childCard(page: Page, name: string): Locator {
  return page.locator("div.rounded-lg").filter({
    has: page.getByRole("button", { name: `Upravit ${name}`, exact: true }),
  }).last();
}

async function expandChild(page: Page, name: string) {
  const toggle = childCard(page, name).getByRole("button", { name, exact: true });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`children search, sorting, independent details and confirmed deactivation at ${viewport.width}px`, async ({ page }) => {
    test.skip(process.env.E2E_LOCAL !== "true", "Writes only to the isolated local seeded E2E database.");
    const convexUrl = new URL(process.env.CONVEX_URL!);
    expect(["127.0.0.1", "localhost", "[::1]"]).toContain(convexUrl.hostname);
    const convex = new ConvexHttpClient(convexUrl.origin);
    const secret = process.env.PUSH_INTERNAL_SECRET!;
    expect(secret).toBeTruthy();
    await page.setViewportSize(viewport);
    await persona(page, "director-bohumil");
    await page.goto("/reditel/deti");

    const marker = `E2ESpráva${Date.now()}`;
    const children = [
      { firstName: `${marker} Anna`, lastName: "Žáková", start: "2026-09-01" },
      { firstName: `${marker} Bára`, lastName: "Adamová", start: "2026-10-01" },
      { firstName: `${marker} Čeněk`, lastName: "Novák", start: "2026-11-01" },
    ].map(child => ({ ...child, name: `${child.firstName} ${child.lastName}` }));

    try {
      for (const child of children) {
        await page.getByRole("button", { name: "Přidat dítě", exact: true }).click();
        await page.getByLabel("Jméno", { exact: true }).fill(child.firstName);
        await page.getByLabel("Příjmení", { exact: true }).fill(child.lastName);
        await page.getByLabel("Pohlaví", { exact: true }).selectOption("FEMALE");
        await page.getByLabel("Datum nástupu", { exact: true }).fill(child.start);
        await page.getByRole("button", { name: "Ulož dítě", exact: true }).click();
        await expect(childCard(page, child.name).getByRole("button", { name: child.name, exact: true }))
          .toHaveAttribute("aria-expanded", "true");
      }
      await page.reload();
      await expect(childCard(page, children[0].name)).toBeVisible();
      const search = page.getByRole("searchbox", { name: "Vyhledat dítě", exact: true });
      await search.fill(marker);
      const toggles = page.locator('button[aria-controls^="child-details-"]');
      await expect(toggles).toHaveCount(3);
      await expect(toggles).toHaveText([children[1].name, children[2].name, children[0].name]);
      for (const child of children) {
        const card = childCard(page, child.name);
        await expect(card.getByRole("button", { name: child.name, exact: true })).toHaveAttribute("aria-expanded", "false");
        await expect(card.getByRole("button")).toHaveCount(2);
      }

      const sort = page.getByRole("combobox", { name: "Řadit podle", exact: true });
      await sort.selectOption("surname-desc");
      await expect(toggles).toHaveText([children[0].name, children[2].name, children[1].name]);
      await sort.selectOption("start-asc");
      await expect(toggles).toHaveText(children.map(child => child.name));
      await sort.selectOption("start-desc");
      await expect(toggles).toHaveText(children.map(child => child.name).reverse());

      await search.fill(`${marker.replace("á", "a")} zakova`);
      await expect(toggles).toHaveText([children[0].name]);
      await search.fill("nikdo-s-timto-jmenem");
      await expect(toggles).toHaveCount(0);
      await expect(page.getByText("Vyhledávání neodpovídají žádné aktivní děti.", { exact: true })).toBeVisible();
      await search.fill(marker);

      const first = childCard(page, children[0].name);
      const second = childCard(page, children[1].name);
      await expandChild(page, children[0].name);
      await expandChild(page, children[1].name);
      await expect(first.getByText("Nástup: 1. 9. 2026", { exact: true })).toBeVisible();
      await expect(second.getByText("Nástup: 1. 10. 2026", { exact: true })).toBeVisible();
      await first.getByRole("button", { name: children[0].name, exact: true }).click();
      await expect(first.getByText("Nástup: 1. 9. 2026", { exact: true })).not.toBeVisible();
      await expect(second.getByText("Nástup: 1. 10. 2026", { exact: true })).toBeVisible();
      await expandChild(page, children[0].name);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await first.getByRole("button", { name: "Deaktivovat", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Deaktivovat dítě?", exact: true });
      await expect(dialog).toContainText(children[0].name);
      await expect(dialog.getByRole("button", { name: "Zrušit", exact: true })).toBeFocused();
      await dialog.getByRole("button", { name: "Zrušit", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(first.getByRole("button", { name: "Deaktivovat", exact: true })).toBeFocused();
      await first.getByRole("button", { name: "Deaktivovat", exact: true }).click();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(first.getByText("Neaktivní", { exact: true })).toHaveCount(0);
      await first.getByRole("button", { name: "Deaktivovat", exact: true }).click();
      await dialog.getByRole("button", { name: "Deaktivovat dítě", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await page.reload();
      await expect(childCard(page, children[0].name)).toBeVisible();
      await search.fill(marker);
      await expandChild(page, children[0].name);
      await expect(first.getByText("Neaktivní", { exact: true })).toBeVisible();
      await expect(first.getByRole("button", { name: "Aktivovat", exact: true })).toBeVisible();
      await first.getByRole("button", { name: "Aktivovat", exact: true }).click();
      await expandChild(page, children[0].name);
      await expect(first.getByRole("button", { name: "Deaktivovat", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      // Remove only this run's local fixtures, so later attendance tests do not
      // receive deactivated children when saving historical school days.
      const records = await convex.query(api.db.listChildren, { secret });
      for (const record of records.filter(child => children.some(fixture => fixture.firstName === child.firstName && fixture.lastName === child.lastName))) {
        await convex.mutation(api.db.deleteById, { secret, table: "children", id: record.id });
      }
    }
  });
}
