import { describe, expect, it } from "vitest";
import { getLunchPayment, getPreviousLunchPaymentMonth, isLunchMonthClosed } from "./lunch-payment";
import type { LunchOverview } from "./lunch-overview";

const overview: LunchOverview = {
  month: "2026-09", monthLabel: "září 2026", lastOpenDay: "2026-09-30", priceCents: 6550, days: [], children: [
    { id: "anna", firstName: "Anna", lastName: "Malá", statuses: [], payableLunches: 3, paid: false },
    { id: "jan", firstName: "Jan", lastName: "Malý", statuses: [], payableLunches: 2, paid: false },
  ], childrenWithoutLunch: [{ id: "petr", firstName: "Petr", lastName: "Malý" }],
};

function fields(payload: string) {
  return Object.fromEntries(payload.split("*").slice(2).map(field => {
    const colon = field.indexOf(":");
    return [field.slice(0, colon), decodeURIComponent(field.slice(colon + 1))];
  }));
}

describe("lunch payment details", () => {
  it("waits until the last open day has ended in Prague, even when that day has no lunch", () => {
    const month = { month: "2026-10", lastOpenDay: "2026-10-29" };
    expect(isLunchMonthClosed(month, new Date("2026-10-14T12:00:00Z"))).toBe(false);
    expect(isLunchMonthClosed(month, new Date("2026-10-29T22:59:59Z"))).toBe(false);
    expect(isLunchMonthClosed(month, new Date("2026-10-29T23:00:00Z"))).toBe(true);
    expect(isLunchMonthClosed({ month: "2026-09", lastOpenDay: "2026-09-30" }, new Date("2026-09-30T22:00:00Z"))).toBe(true);
  });

  it("allows payment after an early last open day and never offers a future month", () => {
    const now = new Date("2026-10-16T12:00:00Z");
    expect(isLunchMonthClosed({ month: "2026-10", lastOpenDay: "2026-10-15" }, now)).toBe(true);
    expect(isLunchMonthClosed({ month: "2026-10", lastOpenDay: null }, now)).toBe(true);
    expect(isLunchMonthClosed({ month: "2026-11", lastOpenDay: null }, now)).toBe(false);
  });

  it("offers the previous calendar month using Prague time across year boundaries", () => {
    expect(getPreviousLunchPaymentMonth(new Date("2026-10-14T12:00:00Z"))).toBe("2026-09");
    expect(getPreviousLunchPaymentMonth(new Date("2026-12-31T23:00:00Z"))).toBe("2026-12");
    expect(getPreviousLunchPaymentMonth(new Date("2026-12-31T22:59:59Z"))).toBe("2026-11");
  });

  it.each([false, true])("includes all siblings regardless of manual paid marks (all paid: %s)", allPaid => {
    const payment = getLunchPayment({ ...overview, children: overview.children.map((child, index) => ({ ...child, paid: allPaid || index === 0 })) });
    expect(payment.amountCents).toBe(32750);
    expect(payment.note).toBe("Obědy září: Anna Malá, Jan Malý");
    expect(fields(payment.payload!).AM).toBe("327.50");
  });

  it("encodes the correct account, exact sibling total, currency and Czech note", () => {
    const payment = getLunchPayment(overview);
    expect(payment).toMatchObject({ monthName: "září", account: "2802518214 / 2010", amountCents: 32750, note: "Obědy září: Anna Malá, Jan Malý" });
    expect(payment.payload?.startsWith("SPD*1.0*")).toBe(true);
    expect(fields(payment.payload!)).toEqual({ ACC: "CZ3020100000002802518214", AM: "327.50", CC: "CZK", MSG: payment.note });
    expect(payment.clipboardText.replaceAll(/\u00a0/g, " ")).toBe("Číslo účtu: 2802518214 / 2010\nČástka: 327,50 Kč\nPoznámka: Obědy září: Anna Malá, Jan Malý");
    const iban = fields(payment.payload!).ACC;
    expect(iban.slice(4, 8)).toBe("2010");
    expect(iban.slice(8)).toBe("0000002802518214");
    expect(BigInt(iban.slice(4) + "1235" + iban.slice(2, 4)) % BigInt(97)).toBe(BigInt(1));
  });

  it("uses the selected billing month without taking the calendar month or server timezone", () => {
    const payment = getLunchPayment({ ...overview, month: "2026-12" });
    expect(payment.monthName).toBe("prosinec");
    expect(payment.note).toBe("Obědy prosinec: Anna Malá, Jan Malý");
  });

  it("escapes field separators, literal percent sequences and Unicode names", () => {
    const payment = getLunchPayment({ ...overview, children: [
      { ...overview.children[0], firstName: "Žofie*AM:1", lastName: "%2A*CC:EUR" },
    ] });
    expect(fields(payment.payload!)).toEqual({ ACC: "CZ3020100000002802518214", AM: "196.50", CC: "CZK", MSG: payment.note });
    expect(payment.payload).not.toContain("*CC:EUR");
  });

  it("uses first names when full sibling names exceed the bank note limit", () => {
    const payment = getLunchPayment({ ...overview, children: overview.children.map(child => ({ ...child, lastName: "VelmidlouhépříjmeníVelmidlouhépříjmení" })) });
    expect(payment.note).toBe("Obědy září: Anna, Jan");
    expect(fields(payment.payload!).MSG).toBe(payment.note);
  });

  it("keeps manual data available when the note or amount cannot fit QR Platba", () => {
    const longNote = getLunchPayment({ ...overview, children: [{ ...overview.children[0], firstName: "A".repeat(70) }] });
    expect(longNote.payload).toBeNull();
    expect(longNote.clipboardText).toContain("A".repeat(70));
    const hugeAmount = getLunchPayment({ ...overview, priceCents: 1_000_000_000 });
    expect(hugeAmount.payload).toBeNull();
    expect(hugeAmount.clipboardText).toContain("Částka:");
  });

  it.each([0, 1])("does not create a payable QR when no lunches or a zero price are due (%s)", zeroPrice => {
    const payment = getLunchPayment({ ...overview,
      priceCents: zeroPrice ? 0 : overview.priceCents,
      children: zeroPrice ? overview.children : [],
    });
    expect(payment.amountCents).toBe(0);
    expect(payment.payload).toBeNull();
  });
});
