import { describe, expect, it } from "vitest";
import { DEFAULT_ATTENDANCE_START_DATE, getAttendanceStartDate, hasStartedAttendance, parseAttendanceStartDate } from "./attendance-start";

describe("child attendance start date", () => {
  it("uses September 1, 2026 for legacy children", () => {
    expect(DEFAULT_ATTENDANCE_START_DATE).toBe("2026-09-01");
    expect(getAttendanceStartDate({})).toBe("2026-09-01");
  });
  it("includes the first attendance day and excludes earlier days using local dates", () => {
    const child = { attendanceStartDate: "2026-10-13" };
    expect(hasStartedAttendance(child, new Date(2026, 9, 12, 23, 59))).toBe(false);
    expect(hasStartedAttendance(child, new Date(2026, 9, 13))).toBe(true);
  });
  it("accepts a real calendar date", () => {
    expect(parseAttendanceStartDate("2028-02-29")).toBe("2028-02-29");
  });
  it.each([undefined, null, "", "2026-02-29", "2026-13-01", "2026-01-32", "2026-1-01", "2026-10-01T00:00:00Z", 123])("rejects invalid date %s", value => {
    expect(() => parseAttendanceStartDate(value)).toThrow("Neplatné datum nástupu");
  });
});
