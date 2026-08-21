import { describe, expect, it } from "vitest";
import { buildParentCalendarMonth } from "./parent-calendar";

describe("buildParentCalendarMonth", () => {
  it("shows an approved excuse across its whole date range", () => {
    const days = buildParentCalendarMonth({
      month: new Date(2026, 7, 1),
      attendance: [],
      excuses: [
        {
          fromDate: new Date(2026, 7, 10),
          toDate: new Date(2026, 7, 12),
          autoApproved: true,
        },
      ],
      closedDays: [],
    });

    expect(days.find((day) => day.date === "2026-08-10")?.status).toBe("EXCUSED");
    expect(days.find((day) => day.date === "2026-08-12")?.status).toBe("EXCUSED");
  });

  it("distinguishes an excuse waiting for review from an unexcused absence", () => {
    const days = buildParentCalendarMonth({
      month: new Date(2026, 7, 1),
      attendance: [
        {
          date: new Date(2026, 7, 4),
          presence: "ABSENT",
          excuseStatus: "UNEXCUSED",
        },
      ],
      excuses: [
        {
          fromDate: new Date(2026, 7, 3),
          toDate: new Date(2026, 7, 3),
          autoApproved: false,
        },
      ],
      closedDays: [],
    });

    expect(days.find((day) => day.date === "2026-08-03")?.status).toBe("PENDING");
    expect(days.find((day) => day.date === "2026-08-04")?.status).toBe("UNEXCUSED");
  });

  it("marks regular weekends and custom closures as closed", () => {
    const days = buildParentCalendarMonth({
      month: new Date(2026, 7, 1),
      attendance: [],
      excuses: [],
      closedDays: [new Date(2026, 7, 17)],
      today: new Date(2026, 7, 18, 12),
    });

    expect(days.find((day) => day.date === "2026-08-01")?.status).toBe("CLOSED");
    expect(days.find((day) => day.date === "2026-08-17")?.status).toBe("CLOSED");
    expect(days.find((day) => day.date === "2026-08-18")?.status).toBe("EXPECTED");
  });

  it("does not describe a past day without attendance as expected", () => {
    const days = buildParentCalendarMonth({
      month: new Date(2026, 7, 1),
      attendance: [],
      excuses: [],
      closedDays: [],
      today: new Date(2026, 7, 19, 12),
    });

    expect(days.find((day) => day.date === "2026-08-18")?.status).toBe("MISSING");
    expect(days.find((day) => day.date === "2026-08-19")?.status).toBe("EXPECTED");
    expect(days.find((day) => day.date === "2026-08-20")?.status).toBe("EXPECTED");
  });
});
