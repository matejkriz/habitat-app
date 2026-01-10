/**
 * Excuse Rules for Habitat Attendance System
 *
 * Core rule: If the excuse is submitted before 9:00 AM the day before fromDate,
 * the absence is automatically EXCUSED. Otherwise, it's UNEXCUSED (late excuse).
 */

/**
 * Check if an excuse qualifies for auto-approval
 *
 * @param submittedAt - When the excuse was submitted
 * @param fromDate - Start date of the absence
 * @returns true if the excuse should be auto-approved
 */
export function isAutoApproved(submittedAt: Date, fromDate: Date): boolean {
  // Calculate deadline: 9:00 AM the day before fromDate
  const deadline = new Date(fromDate);
  deadline.setDate(deadline.getDate() - 1);
  deadline.setHours(9, 0, 0, 0);

  return submittedAt < deadline;
}

/**
 * Get the deadline for auto-approval given a start date
 *
 * @param fromDate - Start date of the absence
 * @returns The deadline for auto-approval
 */
export function getAutoApprovalDeadline(fromDate: Date): Date {
  const deadline = new Date(fromDate);
  deadline.setDate(deadline.getDate() - 1);
  deadline.setHours(9, 0, 0, 0);
  return deadline;
}

/**
 * Format deadline for display
 *
 * @param fromDate - Start date of the absence
 * @returns Human-readable deadline string in Czech
 */
export function formatDeadline(fromDate: Date): string {
  const deadline = getAutoApprovalDeadline(fromDate);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  };
  return deadline.toLocaleDateString("cs-CZ", options);
}

/**
 * Check if the current time is still within the auto-approval window
 *
 * @param fromDate - Start date of the absence
 * @returns true if auto-approval is still possible
 */
export function canStillAutoApprove(fromDate: Date): boolean {
  const now = new Date();
  return isAutoApproved(now, fromDate);
}

/**
 * Get remaining time until the deadline
 *
 * @param fromDate - Start date of the absence
 * @returns Object with remaining days, hours, and minutes, or null if past deadline
 */
export function getTimeUntilDeadline(fromDate: Date): {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
} | null {
  const now = new Date();
  const deadline = getAutoApprovalDeadline(fromDate);
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, isPast: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, isPast: false };
}

/**
 * Validate excuse date range
 *
 * @param fromDate - Start date of the absence
 * @param toDate - End date of the absence
 * @returns Object with validation result and error message
 */
export function validateExcuseDates(
  fromDate: Date,
  toDate: Date
): { valid: boolean; error?: string } {
  // Normalize dates to start of day for comparison
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);

  const to = new Date(toDate);
  to.setHours(0, 0, 0, 0);

  if (to < from) {
    return {
      valid: false,
      error: "Datum konce nesmí být před datem začátku.",
    };
  }

  // Check if range is reasonable (max 30 days)
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 30) {
    return {
      valid: false,
      error: "Omluvenka může být maximálně na 30 dní.",
    };
  }

  return { valid: true };
}
