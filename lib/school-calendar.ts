/**
 * Pure calendar rules, free of any data access.
 *
 * School days: Monday through Thursday.
 * Closed days: Friday, Saturday, Sunday, plus the custom closures in the
 * database, which only `school-days.ts` can resolve.
 */

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

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
