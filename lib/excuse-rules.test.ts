import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isAutoApproved,
  getAutoApprovalDeadline,
  canStillAutoApprove,
  validateExcuseDates,
  getTimeUntilDeadline,
} from "./excuse-rules";

describe("Excuse Rules", () => {
  describe("isAutoApproved", () => {
    it("should auto-approve when submitted more than 1 day before fromDate", () => {
      const fromDate = new Date("2024-01-15");
      // Submitted on Jan 13 at 8:00 AM (before 9 AM deadline on Jan 14)
      const submittedAt = new Date("2024-01-13T08:00:00");
      expect(isAutoApproved(submittedAt, fromDate)).toBe(true);
    });

    it("should auto-approve when submitted exactly at 8:59 AM the day before", () => {
      const fromDate = new Date("2024-01-15");
      // Submitted on Jan 14 at 8:59 AM (just before 9 AM deadline)
      const submittedAt = new Date("2024-01-14T08:59:00");
      expect(isAutoApproved(submittedAt, fromDate)).toBe(true);
    });

    it("should NOT auto-approve when submitted at 9:00 AM the day before", () => {
      const fromDate = new Date("2024-01-15");
      // Submitted on Jan 14 at 9:00 AM (exactly at deadline)
      const submittedAt = new Date("2024-01-14T09:00:00");
      expect(isAutoApproved(submittedAt, fromDate)).toBe(false);
    });

    it("should NOT auto-approve when submitted after 9:00 AM the day before", () => {
      const fromDate = new Date("2024-01-15");
      // Submitted on Jan 14 at 10:00 AM (after deadline)
      const submittedAt = new Date("2024-01-14T10:00:00");
      expect(isAutoApproved(submittedAt, fromDate)).toBe(false);
    });

    it("should NOT auto-approve when submitted on the same day as fromDate", () => {
      const fromDate = new Date("2024-01-15");
      // Submitted on Jan 15
      const submittedAt = new Date("2024-01-15T08:00:00");
      expect(isAutoApproved(submittedAt, fromDate)).toBe(false);
    });

    it("should NOT auto-approve retroactive excuses", () => {
      const fromDate = new Date("2024-01-10");
      // Submitted on Jan 15 (5 days after fromDate)
      const submittedAt = new Date("2024-01-15T08:00:00");
      expect(isAutoApproved(submittedAt, fromDate)).toBe(false);
    });
  });

  describe("getAutoApprovalDeadline", () => {
    it("should return 9:00 AM the day before fromDate", () => {
      const fromDate = new Date("2024-01-15");
      const deadline = getAutoApprovalDeadline(fromDate);

      expect(deadline.getFullYear()).toBe(2024);
      expect(deadline.getMonth()).toBe(0); // January
      expect(deadline.getDate()).toBe(14);
      expect(deadline.getHours()).toBe(9);
      expect(deadline.getMinutes()).toBe(0);
    });
  });

  describe("canStillAutoApprove", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return true when current time is before deadline", () => {
      // Set current time to Jan 13, 2024 at 10:00 AM
      vi.setSystemTime(new Date("2024-01-13T10:00:00"));

      const fromDate = new Date("2024-01-15");
      expect(canStillAutoApprove(fromDate)).toBe(true);
    });

    it("should return false when current time is after deadline", () => {
      // Set current time to Jan 14, 2024 at 10:00 AM
      vi.setSystemTime(new Date("2024-01-14T10:00:00"));

      const fromDate = new Date("2024-01-15");
      expect(canStillAutoApprove(fromDate)).toBe(false);
    });
  });

  describe("validateExcuseDates", () => {
    it("should return valid for correct date range", () => {
      const fromDate = new Date("2024-01-15");
      const toDate = new Date("2024-01-17");
      const result = validateExcuseDates(fromDate, toDate);
      expect(result.valid).toBe(true);
    });

    it("should return valid for same day excuse", () => {
      const fromDate = new Date("2024-01-15");
      const toDate = new Date("2024-01-15");
      const result = validateExcuseDates(fromDate, toDate);
      expect(result.valid).toBe(true);
    });

    it("should return invalid when toDate is before fromDate", () => {
      const fromDate = new Date("2024-01-17");
      const toDate = new Date("2024-01-15");
      const result = validateExcuseDates(fromDate, toDate);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return invalid when date range exceeds 30 days", () => {
      const fromDate = new Date("2024-01-01");
      const toDate = new Date("2024-02-15"); // 45 days
      const result = validateExcuseDates(fromDate, toDate);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("30");
    });

    it("should return valid for exactly 30 days", () => {
      const fromDate = new Date("2024-01-01");
      const toDate = new Date("2024-01-31"); // 30 days
      const result = validateExcuseDates(fromDate, toDate);
      expect(result.valid).toBe(true);
    });
  });

  describe("getTimeUntilDeadline", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return remaining time when before deadline", () => {
      // Set current time to Jan 13, 2024 at 9:00 AM
      vi.setSystemTime(new Date("2024-01-13T09:00:00"));

      const fromDate = new Date("2024-01-15");
      const result = getTimeUntilDeadline(fromDate);

      expect(result).not.toBeNull();
      expect(result!.isPast).toBe(false);
      expect(result!.days).toBe(1);
    });

    it("should return isPast true when after deadline", () => {
      // Set current time to Jan 14, 2024 at 10:00 AM
      vi.setSystemTime(new Date("2024-01-14T10:00:00"));

      const fromDate = new Date("2024-01-15");
      const result = getTimeUntilDeadline(fromDate);

      expect(result).not.toBeNull();
      expect(result!.isPast).toBe(true);
    });
  });
});
