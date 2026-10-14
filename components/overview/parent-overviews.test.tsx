import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParentLunchSection, ParentTripFundSection } from "./parent-overviews";
const mocks = vi.hoisted(() => ({ lunch: vi.fn(), fund: vi.fn() }));
vi.mock("@/app/actions/parent-overviews", () => ({ getParentLunchOverview: mocks.lunch, getParentTripFundOverview: mocks.fund }));
vi.mock("@/app/actions/director", () => ({ updateLunchPrice: vi.fn() }));

beforeEach(() => {
  mocks.lunch.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T10:00:00Z"));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => vi.useRealTimers());

function billingOverview(month: string, paid = false, payableLunches = 2) {
  return { month, monthLabel: month === "2026-09" ? "září 2026" : "říjen 2026", lastOpenDay: month === "2026-09" ? "2026-09-30" : "2026-10-29", priceCents: 6550,
    days: [{ key: `${month}-01`, day: 1, weekday: "Čt" }], children: [
      { id: "anna", firstName: "Anna", lastName: "Malá", statuses: ["present"], payableLunches, paid },
    ], childrenWithoutLunch: [] };
}

describe("parent read-only overviews", () => {
  it("shows only the retrospective payment explanation for an unfinished month", async () => {
    mocks.lunch.mockImplementation(async month => ({ ...billingOverview(month), priceCents: month === "2026-09" ? 6550 : 5500 }));
    render(await ParentLunchSection({ month: "2026-10", childId: "anna", calendarMonth: "2026-10" }));
    expect(screen.getByRole("table", { name: "Obědy – Říjen 2026" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Platba/ })).toBeNull();
    expect(screen.getByText("Obědy se platí za předchozí měsíc zpětně.")).toBeTruthy();
    expect(mocks.lunch).toHaveBeenCalledExactlyOnceWith("2026-10");
  });

  it("keeps the unfinished month explanation independent of manual paid marks", async () => {
    mocks.lunch.mockImplementation(async month => billingOverview(month, true));
    render(await ParentLunchSection({ month: "2026-10", childId: "anna", calendarMonth: "2026-10" }));
    expect(screen.queryByRole("button", { name: /^Platba/ })).toBeNull();
    expect(screen.getByText("Obědy se platí za předchozí měsíc zpětně.")).toBeTruthy();
    expect(screen.queryByText(/máte zaplacené/)).toBeNull();
    expect(mocks.lunch).toHaveBeenCalledExactlyOnceWith("2026-10");
  });

  it("does not offer payment or load another month when browsing a future overview", async () => {
    mocks.lunch.mockImplementation(async month => month === "2026-11"
      ? { ...billingOverview(month), monthLabel: "listopad 2026", lastOpenDay: "2026-11-30" }
      : billingOverview(month));
    render(await ParentLunchSection({ month: "2026-11", childId: "anna", calendarMonth: "2026-10" }));
    expect(screen.queryByRole("button", { name: /^Platba/ })).toBeNull();
    expect(screen.getByText("Obědy se platí za předchozí měsíc zpětně.")).toBeTruthy();
    expect(mocks.lunch).toHaveBeenCalledExactlyOnceWith("2026-11");
  });

  it("keeps a zero amount payment disabled for the selected closed month", async () => {
    mocks.lunch.mockResolvedValue(billingOverview("2026-09", false, 0));
    render(await ParentLunchSection({ month: "2026-09", childId: "anna", calendarMonth: "2026-10" }));
    expect(screen.getByRole("button", { name: "Platba září" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("V tomto měsíci nemáte žádné obědy k úhradě.")).toBeTruthy();
  });

  it("offers the full selected month payment even when all children are marked paid", async () => {
    mocks.lunch.mockResolvedValue({ month: "2026-09", monthLabel: "září 2026", priceCents: 5500,
      days: [{ key: "2026-09-10", day: 10, weekday: "Čt" }], children: [
        { id: "anna", firstName: "Anna", lastName: "Malá", statuses: ["present"], payableLunches: 1, paid: true },
        { id: "jan", firstName: "Jan", lastName: "Malý", statuses: ["present"], payableLunches: 2, paid: true },
      ], childrenWithoutLunch: [],
    });
    render(await ParentLunchSection({ month: "2026-09", childId: "anna", calendarMonth: "2026-09" }));
    expect(screen.queryByText(/máte zaplacené/)).toBeNull();
    expect(screen.queryByText("Obědy se platí za předchozí měsíc zpětně.")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Zaplaceno" })).toBeNull();
    expect(within(screen.getByRole("table")).getByText(/165\s*Kč/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Platba září" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/165\s*Kč/)).toBeTruthy();
    expect(within(dialog).getByText("Obědy září: Anna Malá, Jan Malý")).toBeTruthy();
    expect(mocks.lunch).toHaveBeenCalledExactlyOnceWith("2026-09");
  });

  it("includes all siblings in the selected month payment regardless of partial paid marks", async () => {
    mocks.lunch.mockResolvedValue({ month: "2026-09", monthLabel: "září 2026", priceCents: 5500,
      days: [{ key: "2026-09-10", day: 10, weekday: "Čt" }], children: [
        { id: "anna", firstName: "Anna", lastName: "Malá", statuses: ["present"], payableLunches: 1, paid: true },
        { id: "jan", firstName: "Jan", lastName: "Malý", statuses: ["present"], payableLunches: 2, paid: false },
      ], childrenWithoutLunch: [],
    });
    render(await ParentLunchSection({ month: "2026-09", childId: "anna", calendarMonth: "2026-09" }));
    fireEvent.click(screen.getByRole("button", { name: "Platba září" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/165\s*Kč/)).toBeTruthy();
    expect(within(dialog).getByText("Obědy září: Anna Malá, Jan Malý")).toBeTruthy();
    expect(screen.queryByText(/Zaplaceno za:/)).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("shows fund values without edit buttons, inputs, or staff-only day links", async () => {
    mocks.fund.mockResolvedValue({ days: [{ date: new Date(2026, 8, 10).getTime(), name: "Jarmark", expense: null }], children: [
      { childId: "anna", firstName: "Anna", lastName: "Malá", fundSent: 500, fundSpent: 80, fundBalance: 420, amounts: [80] },
    ] });
    render(await ParentTripFundSection());
    expect(screen.getByRole("table", { name: "Výletní fond" })).toBeTruthy();
    expect(screen.getByText(/420\s*Kč/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/Částky upravíte kliknutím/)).toBeNull();
  });

  it("shows lunches with month navigation that stays on the parent overview and retains the selected child", async () => {
    mocks.lunch.mockResolvedValue({ month: "2026-08", monthLabel: "srpen 2026", priceCents: 5500, days: [{ key: "2026-08-19", day: 19, weekday: "St" }], children: [
      { id: "anna", firstName: "Anna", lastName: "Malá", statuses: ["present"], payableLunches: 1, paid: false },
    ], childrenWithoutLunch: [] });
    render(await ParentLunchSection({ month: "2026-08", childId: "anna", calendarMonth: "2026-09" }));
    const url = new URL(screen.getByRole("link", { name: "Následující měsíc" }).getAttribute("href")!, "https://example.com");
    expect(url.pathname).toBe("/rodic");
    expect(url.searchParams.get("child")).toBe("anna");
    expect(url.searchParams.get("month")).toBe("2026-09");
    expect(url.searchParams.get("lunchMonth")).toBe("2026-09");
    expect(url.hash).toBe("#obedy");
    expect(mocks.lunch).toHaveBeenCalledWith("2026-08");
    expect(within(screen.getByRole("table")).queryByRole("button")).toBeNull();
    expect(within(screen.getByRole("table")).getByRole("cell", { name: /55\s*Kč/ })).toBeTruthy();
    expect(screen.queryByRole("rowheader", { name: "Součet" })).toBeNull();
    expect(screen.queryByLabelText("Cena jednoho obědu (Kč)")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("opens the month payment below the lunch table with a combined sibling amount", async () => {
    mocks.lunch.mockResolvedValue({ month: "2026-09", monthLabel: "září 2026", priceCents: 6550,
      days: [{ key: "2026-09-10", day: 10, weekday: "Čt" }], children: [
        { id: "anna", firstName: "Anna", lastName: "Malá", statuses: ["present"], payableLunches: 3, paid: false },
        { id: "jan", firstName: "Jan", lastName: "Malý", statuses: ["present"], payableLunches: 2, paid: false },
      ], childrenWithoutLunch: [{ id: "petr", firstName: "Petr", lastName: "Malý" }],
    });
    render(await ParentLunchSection({ month: "2026-09", childId: "anna", calendarMonth: "2026-08" }));
    const button = screen.getByRole("button", { name: "Platba září" });
    expect(screen.getByRole("table").compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button);
    const dialog = screen.getByRole("dialog", { name: "Platba září" });
    expect(within(dialog).getByText("2802518214 / 2010")).toBeTruthy();
    expect(within(dialog).getByText(/327,50\s*Kč/)).toBeTruthy();
    expect(within(dialog).getByText("Obědy září: Anna Malá, Jan Malý")).toBeTruthy();
    expect(within(dialog).queryByText(/Petr/)).toBeNull();
    expect(within(dialog).getByRole("img", { name: "QR kód pro platbu obědů" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Zavřít" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows daily, monthly and money totals for a parent with multiple children", async () => {
    mocks.lunch.mockResolvedValue({ month: "2026-09", monthLabel: "září 2026", priceCents: 6550,
      days: [{ key: "2026-09-10", day: 10, weekday: "Čt" }, { key: "2026-09-11", day: 11, weekday: "Pá" }], children: [
        { id: "anna", firstName: "Anna", lastName: "Malá", statuses: ["present", "excused"], payableLunches: 1, paid: false },
        { id: "jan", firstName: "Jan", lastName: "Malý", statuses: ["kept", "late"], payableLunches: 2, paid: false },
      ], childrenWithoutLunch: [],
    });
    render(await ParentLunchSection({ month: "2026-09", childId: "anna", calendarMonth: "2026-08" }));
    const row = screen.getByRole("rowheader", { name: "Součet" }).closest("tr")!;
    expect(within(row).getAllByRole("cell").map(cell => cell.textContent?.replaceAll(/\s/g, " "))).toEqual(["2", "1", "3", "196,50 Kč"]);
    expect(screen.queryByLabelText("Cena jednoho obědu (Kč)")).toBeNull();
  });

  it("keeps the family total when one of the parent's children does not take lunches", async () => {
    mocks.lunch.mockResolvedValue({ month: "2026-09", monthLabel: "září 2026", priceCents: 5500,
      days: [{ key: "2026-09-10", day: 10, weekday: "Čt" }], children: [
        { id: "anna", firstName: "Anna", lastName: "Malá", statuses: ["present"], payableLunches: 1, paid: false },
      ], childrenWithoutLunch: [{ id: "jan", firstName: "Jan", lastName: "Malý" }],
    });
    render(await ParentLunchSection({ month: "2026-09", childId: "anna", calendarMonth: "2026-09" }));
    const row = screen.getByRole("rowheader", { name: "Součet" }).closest("tr")!;
    expect(within(row).getAllByRole("cell").map(cell => cell.textContent?.replaceAll(/\s/g, " "))).toEqual(["1", "1", "55 Kč"]);
  });
});
