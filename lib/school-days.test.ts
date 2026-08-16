import { describe, it, expect } from "vitest";
import {
  getCurrentWeekSchoolDays,
  getDayNameCzech,
  isDefaultClosedDay,
  isSchoolDay,
} from "./school-days";

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
