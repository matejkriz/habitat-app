import { afterEach, describe, expect, it, vi } from "vitest";
import { sendExcuseNotification } from "./slack";

const data = {
  childName: "Anna Malá",
  parentName: "Petr Malý",
  fromDate: new Date(2026, 8, 8),
  toDate: new Date(2026, 8, 8),
  reason: "Kontrola",
  dayPart: "MORNING" as const,
  isOnTime: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Slack excuse notifications", () => {
  it.each([
    [undefined, "Nová omluvenka"],
    ["UPDATED" as const, "Změna omluvenky"],
  ])("labels %s messages and includes the current details", async (change, title) => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.test/excuses");
    const fetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetch);

    expect(await sendExcuseNotification({ ...data, change })).toBe(true);

    const message = JSON.parse(fetch.mock.calls[0][1].body);
    expect(message.text).toContain(`${title}: Anna Malá`);
    expect(message.blocks[0].text.text).toContain(title);
    expect(JSON.stringify(message.blocks)).toContain("Kontrola");
    expect(JSON.stringify(message.blocks)).toContain("Jen dopoledne");
  });
});
