import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDayTripExpenses: vi.fn(), setChildTripExpense: vi.fn() }));
vi.mock("@/app/actions/day-details", () => mocks);
import { TripExpenses } from "./trip-expenses";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("prefills individual amounts and restores the default after a zero override", async () => {
  mocks.getDayTripExpenses.mockResolvedValue([{ childId: "anna", name: "Anna Malá", amount: 120, override: null }]);
  render(<TripExpenses dateKey="2026-09-10" defaultExpense={120} />);
  const amount = await screen.findByLabelText("Útrata Anna Malá (Kč)");
  expect(amount).toHaveProperty("value", "120");
  fireEvent.change(amount, { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Uložit útratu Anna Malá" }));
  await waitFor(() => expect(mocks.setChildTripExpense).toHaveBeenCalledWith("2026-09-10", "anna", 0));
  fireEvent.click(await screen.findByRole("button", { name: "Obnovit výchozí částku Anna Malá" }));
  await waitFor(() => expect(mocks.setChildTripExpense).toHaveBeenLastCalledWith("2026-09-10", "anna", null));
  await waitFor(() => expect(amount).toHaveProperty("value", "120"));
});
