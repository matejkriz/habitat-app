import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LunchPayment } from "./lunch-payment";
import { getLunchPayment } from "@/lib/lunch-payment";

const payment = getLunchPayment({ month: "2026-09", monthLabel: "září 2026", lastOpenDay: "2026-09-30", priceCents: 6550, days: [], childrenWithoutLunch: [], children: [
  { id: "anna", firstName: "Anna", lastName: "Malá", payableLunches: 3, paid: false, statuses: [] },
  { id: "jan", firstName: "Jan", lastName: "Malý", payableLunches: 2, paid: false, statuses: [] },
] });
const writeText = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => vi.unstubAllGlobals());

function openPayment() {
  render(<LunchPayment payment={payment} />);
  fireEvent.click(screen.getByRole("button", { name: "Platba září" }));
  return screen.getByRole("dialog", { name: "Platba září" });
}

describe("parent lunch payment", () => {
  it("copies all displayed payment data with confirmation", async () => {
    const dialog = openPayment();
    fireEvent.click(within(dialog).getByRole("button", { name: "Zkopírovat údaje" }));
    await screen.findByText("Platební údaje zkopírovány.");
    expect(writeText).toHaveBeenCalledWith(payment.clipboardText);
  });

  it.each([
    ["Zkopírovat číslo účtu", "2802518214/2010", "Číslo účtu zkopírováno."],
    ["Zkopírovat částku", "327,50", "Částka zkopírována."],
    ["Zkopírovat poznámku", "Obědy září: Anna Malá, Jan Malý", "Poznámka zkopírována."],
  ])("copies a value suitable for its bank field (%s)", async (name, value, message) => {
    const dialog = openPayment();
    fireEvent.click(within(dialog).getByRole("button", { name }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", message);
    expect(writeText).toHaveBeenCalledWith(value);
  });

  it("offers selectable manual data when clipboard access is denied", async () => {
    writeText.mockRejectedValue(new Error("NotAllowedError"));
    const dialog = openPayment();
    fireEvent.click(within(dialog).getByRole("button", { name: "Zkopírovat údaje" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox", { name: "Platební údaje pro ruční kopírování" })).toHaveProperty("value", payment.clipboardText);
    expect(within(dialog).getByRole("img", { name: "QR kód pro platbu obědů" })).toBeTruthy();
  });

  it("disables payment when no money is due", () => {
    render(<LunchPayment payment={{ ...payment, amountCents: 0, payload: null }} />);
    const button = screen.getByRole("button", { name: "Platba září" });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("V tomto měsíci nemáte žádné obědy k úhradě.")).toBeTruthy();
  });

  it("closes on Escape and restores focus to the payment button", async () => {
    const dialog = openPayment();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Platba září" })));
  });

  it("retains all manual payment details when a QR cannot be generated", () => {
    render(<LunchPayment payment={{ ...payment, payload: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Platba září" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("img")).toBeNull();
    expect(within(dialog).getByText("2802518214 / 2010")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Zkopírovat údaje" })).toBeTruthy();
  });
});
