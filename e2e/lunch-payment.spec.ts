import { expect, test } from "@playwright/test";
import sharp from "sharp";
import jsQR from "jsqr";
import { persona } from "./helpers";

const date = process.env.E2E_DATE ?? "2026-09-17";
const month = date.slice(0, 7);
const monthName = new Intl.DateTimeFormat("cs-CZ", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const money = (amount: number) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(amount);

test("parent payment totals siblings and its branded QR and clipboard contain the same payment", async ({ page, context }) => {
  await persona(page, "director-bohumil");
  await page.goto(`/reditel?month=${month}#obedy`);
  for (const name of ["Božena Bublina", "Max Mlsoun"]) {
    const paid = page.getByRole("checkbox", { name: `Zaplaceno: ${name}` });
    await paid.uncheck();
    await expect(paid).toBeEnabled();
  }
  await persona(page, "teacher-kveta");
  await page.getByLabel("Datum docházky").fill(date);
  let changed = false;
  for (const name of ["Božena Bublina", "Max Mlsoun"]) {
    const present = page.getByRole("checkbox", { name: `Docházka: ${name}` });
    await expect(present).toBeAttached();
    if (!(await present.isChecked())) { await present.check({ force: true }); changed = true; }
  }
  if (changed) {
    await page.getByRole("button", { name: /Potvrdit docházku|Uložit změny/ }).click();
    await expect(page.getByText(/Docházka uložena/)).toBeVisible();
  }
  await persona(page, "parent-bedrich");
  await page.goto(`/rodic?child=seed-child-bozena&lunchMonth=${month}#obedy`);
  const table = page.getByRole("table", { name: /^Obědy/ });
  await expect(table.locator("tbody tr")).toHaveCount(2);
  const counts = await table.locator("tbody tr").evaluateAll(rows => rows.map(row => Number(row.querySelector("td:nth-last-child(2)")?.textContent)));
  expect(counts).toHaveLength(2);
  expect(counts.every(count => count > 0)).toBe(true);
  const amount = counts.reduce((total, count) => total + count, 0) * 55;
  const totalRow = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Součet", exact: true }) });
  await expect(totalRow.getByRole("cell").nth(-2)).toHaveText(String(counts.reduce((total, count) => total + count, 0)));
  await expect(totalRow.getByRole("cell").last()).toHaveText(money(amount));
  const trigger = page.getByRole("button", { name: `Platba ${monthName}` });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: `Platba ${monthName}` });
  await expect(dialog.getByText(money(amount), { exact: true })).toBeVisible();
  const note = `Obědy ${monthName}: Božena Bublina, Max Mlsoun`;
  await expect(dialog.getByText(note, { exact: true })).toBeVisible();
  const qr = dialog.getByRole("img", { name: "QR kód pro platbu obědů" });
  await expect(qr.locator("image")).toHaveAttribute("href", "/habitat-logo.webp");
  await page.evaluate(async () => {
    const logo = new Image();
    logo.src = "/habitat-logo.webp";
    await logo.decode();
  });
  const screenshot = await qr.screenshot({ path: "/tmp/habitat-payment-qr.png" });
  const { data, info } = await sharp(screenshot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  expect(decoded).not.toBeNull();
  const fields = Object.fromEntries(decoded!.data.split("*").slice(2).map(field => {
    const colon = field.indexOf(":");
    return [field.slice(0, colon), decodeURIComponent(field.slice(colon + 1))];
  }));
  expect(fields).toEqual({ ACC: "CZ3020100000002802518214", AM: amount.toFixed(2), CC: "CZK", MSG: note });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog.getByRole("button", { name: "Zkopírovat údaje" }).click();
  await expect(dialog.getByText("Platební údaje zkopírovány.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`Číslo účtu: 2802518214 / 2010\nČástka: ${money(amount)}\nPoznámka: ${note}`);
  await dialog.screenshot({ path: "/tmp/habitat-payment-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.screenshot({ path: "/tmp/habitat-payment-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
