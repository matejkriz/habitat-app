import { describe, expect, it } from "vitest";
import { buildExcuseNotificationBody } from "./notificationContent";

describe("buildExcuseNotificationBody", () => {
  it("includes the child, complete date range and optional reason", () => {
    expect(
      buildExcuseNotificationBody({
        childFirstName: "Eliška",
        childLastName: "Malá",
        fromTimestamp: Date.UTC(2026, 7, 24),
        toTimestamp: Date.UTC(2026, 7, 25),
        reason: "Nemoc",
      }),
    ).toBe("Eliška Malá • 24. 8. 2026–25. 8. 2026 • Nemoc");
  });

  it("does not render an empty separator when no reason was entered", () => {
    expect(
      buildExcuseNotificationBody({
        childFirstName: "Eliška",
        childLastName: "Malá",
        fromTimestamp: Date.UTC(2026, 7, 24),
        toTimestamp: Date.UTC(2026, 7, 24),
        reason: "  ",
      }),
    ).toBe("Eliška Malá • 24. 8. 2026");
  });

  it("names a partial-day absence", () => {
    expect(
      buildExcuseNotificationBody({
        childFirstName: "Eliška",
        childLastName: "Malá",
        fromTimestamp: Date.UTC(2026, 7, 24),
        toTimestamp: Date.UTC(2026, 7, 24),
        dayPart: "AFTERNOON",
      }),
    ).toBe("Eliška Malá • 24. 8. 2026 • jen odpoledne");
  });

  it("keeps an unusually long reason within a safe push payload size", () => {
    const body = buildExcuseNotificationBody({
      childFirstName: "Eliška",
      childLastName: "Malá",
      fromTimestamp: Date.UTC(2026, 7, 24),
      toTimestamp: Date.UTC(2026, 7, 24),
      reason: "x".repeat(2_000),
    });

    expect(body.length).toBeLessThanOrEqual(350);
    expect(body.endsWith("…")).toBe(true);
  });
});
