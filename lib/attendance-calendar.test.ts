import { describe, expect, it } from "vitest";
import {
  buildAttendanceCalendar,
  getAttendanceCalendarStartMonthKey,
} from "./attendance-calendar";

const children = [
  { id: "ada", firstName: "Ada", lastName: "Nováková" },
  { id: "bo", firstName: "Bo", lastName: "Svoboda" },
  { id: "cyril", firstName: "Cyril", lastName: "Dvořák" },
];

const excuse = (overrides: {
  readonly id: string;
  readonly childId: string;
  readonly fromDate: Date;
  readonly toDate: Date;
  readonly reason?: string | null;
  readonly submittedAt: Date;
  readonly lateApprovedAt?: Date | null;
}) => ({ reason: null, lateApprovedAt: null, ...overrides });

describe("buildAttendanceCalendar", () => {
  it("počítá budoucí očekávanou účast z aktivních dětí a omluvenek", () => {
    const [day] = buildAttendanceCalendar({
      month: new Date(2026, 7, 1),
      today: new Date(2026, 7, 3),
      children,
      attendance: [],
      excuses: [
        excuse({
          id: "excuse-bo",
          childId: "bo",
          fromDate: new Date(2026, 7, 4),
          toDate: new Date(2026, 7, 5),
          reason: "Rodinná cesta",
          submittedAt: new Date(2026, 7, 1, 8),
        }),
      ],
      closedDays: [],
      noLunchDays: [],
    }).filter((item) => item.dateKey === "2026-08-04");

    expect(day.counts).toEqual({
      expected: 2,
      present: 0,
      excused: 1,
      unexcused: 0,
      waiting: 0,
      unknown: 0,
    });
    expect(day.children.excused[0]).toMatchObject({ childId: "bo", reason: "Rodinná cesta" });
  });

  it("u dneška rozlišuje dorazivší, omluvené, nepřítomné a děti, na které se čeká", () => {
    const [day] = buildAttendanceCalendar({
      month: new Date(2026, 7, 1),
      today: new Date(2026, 7, 3),
      children,
      attendance: [
        { childId: "ada", date: new Date(2026, 7, 3), presence: "PRESENT" },
        { childId: "bo", date: new Date(2026, 7, 3), presence: "ABSENT" },
      ],
      excuses: [
        excuse({
          id: "excuse-bo",
          childId: "bo",
          fromDate: new Date(2026, 7, 3),
          toDate: new Date(2026, 7, 3),
          submittedAt: new Date(2026, 7, 1, 8),
        }),
      ],
      closedDays: [],
      noLunchDays: [],
    }).filter((item) => item.dateKey === "2026-08-03");

    expect(day.counts).toEqual({
      expected: 2,
      present: 1,
      excused: 1,
      unexcused: 0,
      waiting: 1,
      unknown: 0,
    });
    expect(day.children.waiting[0].childId).toBe("cyril");
    expect(day.isResolved).toBe(false);
  });

  it("u minulého dne ukazuje skutečnou účast a chybějící záznam", () => {
    const [day] = buildAttendanceCalendar({
      month: new Date(2026, 6, 1),
      today: new Date(2026, 7, 3),
      children,
      attendance: [
        { childId: "ada", date: new Date(2026, 6, 30), presence: "PRESENT" },
        { childId: "bo", date: new Date(2026, 6, 30), presence: "ABSENT" },
      ],
      excuses: [],
      closedDays: [],
      noLunchDays: [],
    }).filter((item) => item.dateKey === "2026-07-30");

    expect(day.counts).toMatchObject({ present: 1, unexcused: 1, unknown: 1, expected: 1 });
    expect(day.isResolved).toBe(false);
  });

  it("označí víkend i vlastní volný den jako zavřeno", () => {
    const calendar = buildAttendanceCalendar({
      month: new Date(2026, 7, 1),
      today: new Date(2026, 7, 3),
      children,
      attendance: [],
      excuses: [],
      closedDays: [{ date: new Date(2026, 7, 6), description: "Prázdniny" }],
      noLunchDays: [],
    });

    expect(calendar.find((day) => day.dateKey === "2026-08-01")).toMatchObject({ isClosed: true });
    expect(calendar.find((day) => day.dateKey === "2026-08-06")).toMatchObject({
      isClosed: true,
      closedReason: "Prázdniny",
    });
  });

  it("označí otevřený den bez oběda", () => {
    const day = buildAttendanceCalendar({
      month: new Date(2026, 7, 1),
      today: new Date(2026, 7, 3),
      children,
      attendance: [],
      excuses: [],
      closedDays: [],
      noLunchDays: [{ date: new Date(2026, 7, 4) }],
    }).find((item) => item.dateKey === "2026-08-04");

    expect(day).toMatchObject({ isClosed: false, isLunchCancelled: true });
  });
});

describe("getAttendanceCalendarStartMonthKey", () => {
  it("returns the configured month for a valid date", () => {
    expect(getAttendanceCalendarStartMonthKey("2026-07-01")).toBe("2026-07");
  });

  it("ignores missing and invalid dates", () => {
    expect(getAttendanceCalendarStartMonthKey(undefined)).toBeNull();
    expect(getAttendanceCalendarStartMonthKey("2026-13-01")).toBeNull();
    expect(getAttendanceCalendarStartMonthKey("2026-02-30")).toBeNull();
  });
});
