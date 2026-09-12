import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TripFundOverviewSection } from "./trip-fund-overview";

vi.mock("@/app/actions/day-details", () => ({ setChildTripExpense: vi.fn(), createTripExpense: vi.fn(), getDayTripExpenses: vi.fn() }));

const mocks = vi.hoisted(() => ({ getTripFundOverview: vi.fn() }));
vi.mock("@/app/actions/director", () => ({ getTripFundOverview: mocks.getTripFundOverview, updateChild: vi.fn() }));

describe("TripFundOverviewSection", () => {
  it("shows deposits, dated trip charges and balances with absent cells distinct from zero", async () => {
    mocks.getTripFundOverview.mockResolvedValue({
      days: [{ date: new Date(2026, 8, 10).getTime(), name: "Jarmark", expense: 120 }],
      children: [
        { childId: "anna", firstName: "Anna", lastName: "Malá", fundSent: 500, amounts: [80], fundSpent: 80, fundBalance: 420 },
        { childId: "petr", firstName: "Petr", lastName: "Nový", fundSent: null, amounts: [null], fundSpent: 0, fundBalance: 0 },
        { childId: "eva", firstName: "Eva", lastName: "Volná", fundSent: 100, amounts: [0], fundSpent: 0, fundBalance: 100 },
      ],
    });
    render(await TripFundOverviewSection());
    const headings = screen.getAllByRole("columnheader").map(header => header.textContent);
    expect(headings).toEqual(["Dítě", "Příjem", "10. 9. 2026Jarmark", "Zůstatek"]);
    const anna = screen.getByRole("rowheader", { name: "Anna Malá" }).closest("tr")!;
    expect(within(anna).getByText(/500\s*Kč/)).toBeTruthy();
    expect(within(anna).getByText(/80\s*Kč/)).toBeTruthy();
    expect(within(anna).getByText(/420\s*Kč/)).toBeTruthy();
    const petr = screen.getByRole("rowheader", { name: "Petr Nový" }).closest("tr")!;
    expect(within(petr).getByLabelText("Bez účtované útraty").textContent).toBe("—");
    const eva = screen.getByRole("rowheader", { name: "Eva Volná" }).closest("tr")!;
    expect(within(eva).getByText(/^0\s*Kč$/)).toBeTruthy();
  });

  it("shows deposits and balances even before the first trip", async () => {
    mocks.getTripFundOverview.mockResolvedValue({ days: [], children: [
      { childId: "anna", firstName: "Anna", lastName: "Malá", fundSent: 500, amounts: [], fundSpent: 0, fundBalance: 500 },
    ] });
    render(await TripFundOverviewSection());
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getAllByText(/500\s*Kč/)).toHaveLength(2);
  });
});
