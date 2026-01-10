import { describe, it, expect } from "vitest";

// These are pure functions that don't require database connection
// Re-implementing them here for testing purposes

/**
 * Check if a date is a default closed day (Friday, Saturday, Sunday)
 */
function isDefaultClosedDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  // Sunday = 0, Friday = 5, Saturday = 6
  return dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
}

/**
 * Check if a date is a school day (Mon-Thu)
 */
function isSchoolDay(date: Date): boolean {
  return !isDefaultClosedDay(date);
}

/**
 * Get the day name in Czech
 */
function getDayNameCzech(date: Date): string {
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
 * Get dates for the current week (Mon-Thu)
 */
function getCurrentWeekSchoolDays(): Date[] {
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

describe("School Days Logic", () => {
  describe("isDefaultClosedDay", () => {
    it("should return true for Friday", () => {
      // Friday, January 12, 2024
      const friday = new Date("2024-01-12");
      expect(isDefaultClosedDay(friday)).toBe(true);
    });

    it("should return true for Saturday", () => {
      // Saturday, January 13, 2024
      const saturday = new Date("2024-01-13");
      expect(isDefaultClosedDay(saturday)).toBe(true);
    });

    it("should return true for Sunday", () => {
      // Sunday, January 14, 2024
      const sunday = new Date("2024-01-14");
      expect(isDefaultClosedDay(sunday)).toBe(true);
    });

    it("should return false for Monday", () => {
      // Monday, January 15, 2024
      const monday = new Date("2024-01-15");
      expect(isDefaultClosedDay(monday)).toBe(false);
    });

    it("should return false for Tuesday", () => {
      // Tuesday, January 16, 2024
      const tuesday = new Date("2024-01-16");
      expect(isDefaultClosedDay(tuesday)).toBe(false);
    });

    it("should return false for Wednesday", () => {
      // Wednesday, January 17, 2024
      const wednesday = new Date("2024-01-17");
      expect(isDefaultClosedDay(wednesday)).toBe(false);
    });

    it("should return false for Thursday", () => {
      // Thursday, January 18, 2024
      const thursday = new Date("2024-01-18");
      expect(isDefaultClosedDay(thursday)).toBe(false);
    });
  });

  describe("isSchoolDay", () => {
    it("should return true for Monday through Thursday", () => {
      // Monday Jan 15 to Thursday Jan 18, 2024
      expect(isSchoolDay(new Date("2024-01-15"))).toBe(true); // Monday
      expect(isSchoolDay(new Date("2024-01-16"))).toBe(true); // Tuesday
      expect(isSchoolDay(new Date("2024-01-17"))).toBe(true); // Wednesday
      expect(isSchoolDay(new Date("2024-01-18"))).toBe(true); // Thursday
    });

    it("should return false for Friday through Sunday", () => {
      // Friday Jan 19 to Sunday Jan 21, 2024
      expect(isSchoolDay(new Date("2024-01-19"))).toBe(false); // Friday
      expect(isSchoolDay(new Date("2024-01-20"))).toBe(false); // Saturday
      expect(isSchoolDay(new Date("2024-01-21"))).toBe(false); // Sunday
    });
  });

  describe("getDayNameCzech", () => {
    it("should return correct Czech day names", () => {
      expect(getDayNameCzech(new Date("2024-01-15"))).toBe("Pondělí");
      expect(getDayNameCzech(new Date("2024-01-16"))).toBe("Úterý");
      expect(getDayNameCzech(new Date("2024-01-17"))).toBe("Středa");
      expect(getDayNameCzech(new Date("2024-01-18"))).toBe("Čtvrtek");
      expect(getDayNameCzech(new Date("2024-01-19"))).toBe("Pátek");
      expect(getDayNameCzech(new Date("2024-01-20"))).toBe("Sobota");
      expect(getDayNameCzech(new Date("2024-01-21"))).toBe("Neděle");
    });
  });

  describe("getCurrentWeekSchoolDays", () => {
    it("should return exactly 4 days (Mon-Thu)", () => {
      const schoolDays = getCurrentWeekSchoolDays();
      expect(schoolDays).toHaveLength(4);
    });

    it("should only include Monday through Thursday", () => {
      const schoolDays = getCurrentWeekSchoolDays();
      for (const day of schoolDays) {
        const dayOfWeek = day.getDay();
        expect(dayOfWeek).toBeGreaterThanOrEqual(1); // Monday
        expect(dayOfWeek).toBeLessThanOrEqual(4); // Thursday
      }
    });
  });
});
