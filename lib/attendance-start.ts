const pragueDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
});

export const DEFAULT_ATTENDANCE_START_DATE = "2026-09-01";
export type AttendanceStart = { readonly attendanceStartDate?: string };

export function parseAttendanceStartDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Neplatné datum nástupu.");
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Neplatné datum nástupu.");
  }
  return value;
}

export function getAttendanceStartDate(child: AttendanceStart): string {
  return child.attendanceStartDate ?? DEFAULT_ATTENDANCE_START_DATE;
}

export function hasStartedAttendance(child: AttendanceStart, day: Date): boolean {
  return Number.isFinite(day.getTime()) && pragueDate.format(day) >= getAttendanceStartDate(child);
}
