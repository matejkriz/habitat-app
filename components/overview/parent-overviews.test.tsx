import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ParentLunchSection, ParentTripFundSection } from "./parent-overviews";
const mocks = vi.hoisted(() => ({ lunch: vi.fn(), fund: vi.fn() }));
vi.mock("@/app/actions/parent-overviews", () => ({ getParentLunchOverview: mocks.lunch, getParentTripFundOverview: mocks.fund }));
vi.mock("@/app/actions/director", () => ({ updateLunchPrice: vi.fn() }));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

describe("parent read-only overviews", () => {
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
      { id: "anna", firstName: "Anna", lastName: "Malá", statuses: ["present"], payableLunches: 1 },
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
        { id: "anna", firstName: "Anna", lastName: "Malá", statuses: ["present"], payableLunches: 3 },
        { id: "jan", firstName: "Jan", lastName: "Malý", statuses: ["present"], payableLunches: 2 },
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
});
