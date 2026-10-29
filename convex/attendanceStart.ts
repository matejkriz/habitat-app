import { hasStartedAttendance } from "../lib/attendance-start";

type ChildWithAttendanceStart = { readonly attendanceStartDate?: string };

export function hasChildStartedAttendance(child: ChildWithAttendanceStart, timestamp: number): boolean {
  if (!Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) {
    throw new Error("Neplatné datum.");
  }
  return hasStartedAttendance(child, new Date(timestamp));
}

export function requireChildAttendanceStarted(child: ChildWithAttendanceStart, timestamp: number): void {
  if (!hasChildStartedAttendance(child, timestamp)) {
    throw new Error("Datum je před nástupem dítěte do Habitatu.");
  }
}
