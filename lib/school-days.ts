/**
 * School Days Logic for Habitat
 *
 * School days: Monday through Thursday (1-4)
 * Closed days: Friday, Saturday, Sunday (5, 6, 0) + custom closed days
 */

import { prisma } from "./db";

/**
 * Check if a date is a default closed day (Friday, Saturday, Sunday)
 */
export function isDefaultClosedDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  // Sunday = 0, Friday = 5, Saturday = 6
  return dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
}

/**
 * Check if a date is a school day (Mon-Thu)
 */
export function isSchoolDay(date: Date): boolean {
  return !isDefaultClosedDay(date);
}

/**
 * Get all custom closed days within a date range
 */
export async function getClosedDaysInRange(
  startDate: Date,
  endDate: Date
): Promise<Date[]> {
  const closedDays = await prisma.closedDay.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: { date: true },
  });

  return closedDays.map((cd) => cd.date);
}

/**
 * Check if a specific date is closed (either default or custom)
 */
export async function isClosedDay(date: Date): Promise<boolean> {
  // First check default closed days
  if (isDefaultClosedDay(date)) {
    return true;
  }

  // Then check custom closed days
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  const closedDay = await prisma.closedDay.findUnique({
    where: { date: normalizedDate },
  });

  return !!closedDay;
}

/**
 * Get school days in a date range (excluding closed days)
 */
export async function getSchoolDaysInRange(
  startDate: Date,
  endDate: Date
): Promise<Date[]> {
  const schoolDays: Date[] = [];
  const customClosedDays = await getClosedDaysInRange(startDate, endDate);
  const closedDatesSet = new Set(
    customClosedDays.map((d) => d.toISOString().split("T")[0])
  );

  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];

    if (isSchoolDay(current) && !closedDatesSet.has(dateStr)) {
      schoolDays.push(new Date(current));
    }

    current.setDate(current.getDate() + 1);
  }

  return schoolDays;
}

/**
 * Get the day name in Czech
 */
export function getDayNameCzech(date: Date): string {
  const days = [
    "Neděle",
    "Pondělí",
    "Úterý",
    "Středa",
    "Čtvrtek",
    "Pátek",
    "Sobota",
  ];
  return days[date.getDay()];
}

/**
 * Format date for display in Czech
 */
export function formatDateCzech(date: Date): string {
  return date.toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format short date for display in Czech
 */
export function formatShortDateCzech(date: Date): string {
  return date.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
  });
}

/**
 * Get today's date normalized to start of day
 */
export function getToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Get dates for the current week (Mon-Thu)
 */
export function getCurrentWeekSchoolDays(): Date[] {
  const today = new Date();
  const dayOfWeek = today.getDay();

  // Find Monday of current week
  const monday = new Date(today);
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(today.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  const schoolDays: Date[] = [];

  // Add Mon-Thu
  for (let i = 0; i < 4; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    schoolDays.push(day);
  }

  return schoolDays;
}

/**
 * Get the next school day from a given date
 */
export async function getNextSchoolDay(fromDate: Date): Promise<Date> {
  const current = new Date(fromDate);
  current.setDate(current.getDate() + 1);
  current.setHours(0, 0, 0, 0);

  // Find next non-closed day (max 30 days search)
  for (let i = 0; i < 30; i++) {
    if (!(await isClosedDay(current))) {
      return current;
    }
    current.setDate(current.getDate() + 1);
  }

  return current;
}
