import { expect, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { persona } from "./helpers";

const workosHeaders = { Authorization: "Bearer sk_test_default" };

test("director invites a new parent, resends the invitation and links their first sign-in to only their child", async ({
  page, browser, request,
}, testInfo) => {
  test.skip(process.env.E2E_LOCAL !== "true", "Uses only the isolated local database and WorkOS emulator.");
  const baseUrl = new URL(process.env.E2E_BASE_URL!);
  const convexUrl = new URL(process.env.CONVEX_URL!);
  const workosUrl = new URL(`http://${process.env.WORKOS_API_HOSTNAME}:${process.env.WORKOS_API_PORT}`);
  for (const url of [baseUrl, convexUrl, workosUrl]) {
    expect(["127.0.0.1", "localhost", "[::1]"]).toContain(url.hostname);
    expect(url.protocol).toBe("http:");
  }
  const secret = process.env.PUSH_INTERNAL_SECRET!;
  expect(secret).toBeTruthy();
  const convex = new ConvexHttpClient(convexUrl.origin);
  const marker = Date.now();
  const firstName = `E2EPozvánka${marker}`;
  const lastName = "Testovací";
  const email = `invite-${marker}@example.test`;

  await persona(page, "director-bohumil");
  await page.goto("/reditel/deti");
  await page.getByRole("button", { name: "Přidat dítě", exact: true }).click();
  await page.getByLabel("Jméno", { exact: true }).fill(firstName);
  await page.getByLabel("Příjmení", { exact: true }).fill(lastName);
  await page.getByLabel("Pohlaví", { exact: true }).selectOption("FEMALE");
  await page.getByLabel("Datum nástupu", { exact: true }).fill(process.env.E2E_DATE!);
  await page.getByRole("button", { name: "Ulož dítě", exact: true }).click();
  const childCard = page.locator("div.rounded-lg").filter({
    has: page.getByRole("button", { name: `Upravit ${firstName} ${lastName}`, exact: true }),
  }).last();
  const inviteButton = childCard.getByRole("button", { name: `Pozvat rodiče ${firstName} ${lastName}`, exact: true });
  await inviteButton.click();
  await childCard.getByLabel("E-mail rodiče", { exact: true }).fill(email.toUpperCase());
  await childCard.screenshot({ path: testInfo.outputPath("invitation-desktop.png") });
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await childCard.screenshot({ path: testInfo.outputPath("invitation-mobile.png") });
  await page.setViewportSize(viewport);
  await childCard.getByRole("button", { name: "Odeslat pozvánku", exact: true }).click();
  await expect(childCard.getByRole("status")).toContainText(`Pozvánka byla odeslána na ${email}.`);
  await expect(childCard.getByText(email, { exact: true })).toHaveCount(1);

  const firstInvitationResponse = await request.get(new URL("/user_management/invitations", workosUrl).toString(), {
    headers: workosHeaders, params: { email },
  });
  expect(firstInvitationResponse.ok()).toBe(true);
  const firstInvitations = (await firstInvitationResponse.json()).data;
  expect(firstInvitations).toHaveLength(1);
  expect(firstInvitations[0]).toMatchObject({ email, state: "pending", organization_id: null });

  const beforeSignIn = await convex.query(api.db.findUser, { secret, email });
  if (!beforeSignIn) throw new Error("The invited parent was not stored.");
  expect(beforeSignIn).toMatchObject({ email, role: "PARENT" });
  expect(beforeSignIn.workosId).toBeUndefined();
  const children = await convex.query(api.db.listChildren, { secret });
  const child = children.find(record => record.firstName === firstName);
  if (!child) throw new Error("The new child was not stored.");
  const links = await convex.query(api.db.listParentChildren, { secret, parentId: beforeSignIn.id });
  expect(links).toHaveLength(1);
  expect(links[0]).toMatchObject({ parentId: beforeSignIn.id, childId: child.id });

  await inviteButton.click();
  await childCard.getByLabel("E-mail rodiče", { exact: true }).fill(email);
  await childCard.getByRole("button", { name: "Odeslat pozvánku", exact: true }).click();
  await expect(childCard.getByRole("status")).toContainText(`Pozvánka byla odeslána na ${email}.`);
  await expect(childCard.getByText(email, { exact: true })).toHaveCount(1);
  const resendResponse = await request.get(new URL("/user_management/invitations", workosUrl).toString(), {
    headers: workosHeaders, params: { email },
  });
  expect(resendResponse.ok()).toBe(true);
  const resentInvitations = (await resendResponse.json()).data;
  expect(resentInvitations).toHaveLength(1);
  expect(resentInvitations[0].id).toBe(firstInvitations[0].id);
  expect(resentInvitations[0].token).not.toBe(firstInvitations[0].token);

  // The emulator's hosted page only signs in existing accounts. Its Magic Auth
  // endpoints perform sign-up and invitation acceptance before browser sign-in.
  const magicResponse = await request.post(new URL("/user_management/magic_auth", workosUrl).toString(), {
    headers: workosHeaders, data: { email: email.toUpperCase() },
  });
  expect(magicResponse.ok()).toBe(true);
  const magic = await magicResponse.json();
  const acceptanceResponse = await request.post(new URL("/user_management/authenticate", workosUrl).toString(), {
    headers: workosHeaders,
    data: {
      client_id: process.env.WORKOS_CLIENT_ID,
      grant_type: "urn:workos:oauth:grant-type:magic-auth:code",
      email: email.toUpperCase(), code: magic.code,
      invitation_token: resentInvitations[0].token,
    },
  });
  expect(acceptanceResponse.ok()).toBe(true);
  const { user: workosUser } = await acceptanceResponse.json();
  expect(workosUser.email_verified).toBe(true);

  const parentContext = await browser.newContext({
    baseURL: baseUrl.origin,
    storageState: { cookies: [], origins: [] },
    timezoneId: "Europe/Prague",
  });
  try {
    const parentPage = await parentContext.newPage();
    await parentPage.goto("/login");
    await parentPage.getByLabel("Email", { exact: true }).fill(email.toUpperCase());
    await parentPage.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(parentPage).toHaveURL(new URL("/", baseUrl).toString());
    await expect(parentPage.getByRole("heading", { level: 1, name: firstName, exact: true })).toBeVisible();
    await expect(parentPage.getByRole("combobox", { name: "Testovací identita" })).toHaveCount(0);
    const lunchTable = parentPage.getByRole("table", { name: /^Obědy/ });
    await expect(lunchTable.getByRole("rowheader", { name: `${firstName} ${lastName}`, exact: true })).toBeVisible();
    await expect(lunchTable.getByRole("rowheader")).toHaveCount(1);
    const afterSignIn = await convex.query(api.db.findUser, { secret, email });
    if (!afterSignIn) throw new Error("The invited parent disappeared after sign-in.");
    expect(afterSignIn).toMatchObject({ id: beforeSignIn.id, workosId: workosUser.id, email, role: "PARENT" });
    const users = await convex.query(api.db.list, { secret, table: "users" });
    expect(users.filter(user => "role" in user && user.email?.toLowerCase() === email)).toHaveLength(1);
    expect(await convex.query(api.db.listParentChildren, { secret, parentId: afterSignIn.id })).toHaveLength(1);
  } finally {
    await parentContext.close();
  }

  await persona(page, "parent-bedrich");
  await page.goto("/rodic/omluvenka");
  await expect(page.getByRole("checkbox", { name: "Božena", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: firstName, exact: true })).toHaveCount(0);
});
