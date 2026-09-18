import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TripFundTable } from "./trip-fund-table";
import type { TripFundOverview } from "@/lib/day-details";

const mocks = vi.hoisted(() => ({ createExtraFundPerson: vi.fn(), updateExtraFundPerson: vi.fn(), setExtraFundExpense: vi.fn(), updateChild: vi.fn(), setChildTripExpense: vi.fn(), createTripExpense: vi.fn(), getDayTripExpenses: vi.fn(), getTripFundOverview: vi.fn() }));
vi.mock("@/app/actions/director", () => ({ createExtraFundPerson: mocks.createExtraFundPerson, updateExtraFundPerson: mocks.updateExtraFundPerson, setExtraFundExpense: mocks.setExtraFundExpense, updateChild: mocks.updateChild, getTripFundOverview: mocks.getTripFundOverview }));
vi.mock("@/app/actions/day-details", () => ({ setChildTripExpense: mocks.setChildTripExpense, createTripExpense: mocks.createTripExpense, getDayTripExpenses: mocks.getDayTripExpenses }));

const initial: TripFundOverview = {
  days: [{ date: new Date(2026, 8, 10).getTime(), name: "Jarmark", expense: 120 }],
  children: [
    { childId: "anna", firstName: "Anna", lastName: "Malá", fundSent: 500, amounts: [80], fundSpent: 80, fundBalance: 420 },
    { childId: "petr", firstName: "Petr", lastName: "Nový", fundSent: null, amounts: [null], fundSpent: 0, fundBalance: 0 },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  mocks.getTripFundOverview.mockResolvedValue(initial);
  mocks.getDayTripExpenses.mockResolvedValue([{ childId: "anna", name: "Anna Malá", amount: 0, override: null }, { childId: "petr", name: "Petr Nový", amount: 0, override: null }]);
});

describe("editable trip fund", () => {
  it("saves an income with Enter and refreshes the balance", async () => {
    render(<TripFundTable initialOverview={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Upravit příjem: Anna Malá" }));
    const input = screen.getByRole("spinbutton", { name: "Částka (Kč)" });
    fireEvent.change(input, { target: { value: "700" } });
    mocks.getTripFundOverview.mockResolvedValue({ ...initial, children: [{ ...initial.children[0], fundSent: 700, fundBalance: 620 }, initial.children[1]] });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mocks.updateChild).toHaveBeenCalledWith("anna", { fundSent: 700 }));
    await within(screen.getByRole("row", { name: /Anna Malá/ })).findByText(/620\s*Kč/);
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("cancels with Escape, validates amounts and preserves a failed edit", async () => {
    render(<TripFundTable initialOverview={initial} />);
    const cell = screen.getByRole("button", { name: "Upravit útratu: Anna Malá, 10. 9. 2026" });
    fireEvent.click(cell);
    let input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "50" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(mocks.setChildTripExpense).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Upravit útratu: Anna Malá, 10. 9. 2026" }));
    input = screen.getByRole("spinbutton");
    expect((input as HTMLInputElement).value).toBe("80");
    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.setChildTripExpense).not.toHaveBeenCalled();
    mocks.setChildTripExpense.mockRejectedValue(new Error("Uložení selhalo"));
    fireEvent.change(input, { target: { value: "50" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("Uložení selhalo");
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("50");
  });

  it("opens a contextual modal on mobile and saves an individual zero", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    render(<TripFundTable initialOverview={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Upravit útratu: Anna Malá, 10. 9. 2026" }));
    const modal = screen.getByRole("dialog", { name: "Upravit útratu" });
    expect(within(modal).getByText("Anna Malá")).toBeTruthy();
    expect(within(modal).getByText(/10\. 9\. 2026/)).toBeTruthy();
    fireEvent.change(within(modal).getByRole("spinbutton"), { target: { value: "0" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Uložit" }));
    await waitFor(() => expect(mocks.setChildTripExpense).toHaveBeenCalledWith("2026-09-10", "anna", 0));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps absent cells and balances read-only and shortens the income header", () => {
    render(<TripFundTable initialOverview={initial} />);
    expect(screen.getByRole("columnheader", { name: "Příjem" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Upravit útratu: Petr/ })).toBeNull();
    expect(screen.getByLabelText("Bez účtované útraty").closest("button")).toBeNull();
  });

  it("adds a date with a default and individual amounts in one save", async () => {
    render(<TripFundTable initialOverview={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Přidat útratu" }));
    const dialog = screen.getByRole("dialog", { name: "Přidat útratu" });
    fireEvent.change(within(dialog).getByLabelText("Datum výletu"), { target: { value: "2026-09-15" } });
    fireEvent.change(within(dialog).getByLabelText("Výchozí částka (Kč)"), { target: { value: "120" } });
    const anna = await within(dialog).findByRole("spinbutton", { name: "Útrata Anna Malá (Kč)" });
    expect((anna as HTMLInputElement).value).toBe("120");
    fireEvent.change(anna, { target: { value: "80" } });
    fireEvent.change(within(dialog).getByLabelText("Výchozí částka (Kč)"), { target: { value: "150" } });
    expect((within(dialog).getByRole("spinbutton", { name: "Útrata Petr Nový (Kč)" }) as HTMLInputElement).value).toBe("150");
    mocks.getTripFundOverview.mockResolvedValue({ ...initial, days: [...initial.days, { date: new Date(2026, 8, 15).getTime(), name: null, expense: 150 }], children: initial.children.map(child => ({ ...child, amounts: [...child.amounts, child.childId === "anna" ? 80 : 150] })) });
    fireEvent.click(within(dialog).getByRole("button", { name: "Uložit útratu" }));
    await waitFor(() => expect(mocks.createTripExpense).toHaveBeenCalledWith("2026-09-15", 150, [{ childId: "anna", amount: 80 }]));
    await screen.findByRole("columnheader", { name: "15. 9. 2026" });
  });

  it("prevents duplicate columns and supports a trip before attendance is entered", async () => {
    mocks.getDayTripExpenses.mockResolvedValue([]);
    render(<TripFundTable initialOverview={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Přidat útratu" }));
    const dialog = screen.getByRole("dialog", { name: "Přidat útratu" });
    fireEvent.change(within(dialog).getByLabelText("Datum výletu"), { target: { value: "2026-09-10" } });
    expect((within(dialog).getByRole("button", { name: "Uložit útratu" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Datum výletu"), { target: { value: "2026-09-20" } });
    fireEvent.change(within(dialog).getByLabelText("Výchozí částka (Kč)"), { target: { value: "100" } });
    await within(dialog).findByText(/Pro tento den zatím není zapsané žádné přítomné dítě/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Uložit útratu" }));
    await waitFor(() => expect(mocks.createTripExpense).toHaveBeenCalledWith("2026-09-20", 100, []));
  });
  it("ignores stale attendance responses after choosing another date", async () => {
    let resolveOld!: (rows: { childId: string; name: string; amount: number; override: null }[]) => void;
    const old = new Promise<{ childId: string; name: string; amount: number; override: null }[]>(resolve => { resolveOld = resolve; });
    mocks.getDayTripExpenses.mockImplementation((date: string) => date === "2026-09-14" ? old : Promise.resolve([{ childId: "eva", name: "Eva Nová", amount: 0, override: null }]));
    render(<TripFundTable initialOverview={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Přidat útratu" }));
    const dialog = screen.getByRole("dialog");
    const date = within(dialog).getByLabelText("Datum výletu");
    fireEvent.change(date, { target: { value: "2026-09-14" } });
    fireEvent.change(date, { target: { value: "2026-09-16" } });
    await within(dialog).findByRole("spinbutton", { name: "Útrata Eva Nová (Kč)" });
    await act(async () => { resolveOld([{ childId: "anna", name: "Anna Malá", amount: 0, override: null }]); });
    expect(within(dialog).queryByRole("spinbutton", { name: "Útrata Anna Malá (Kč)" })).toBeNull();
    expect(within(dialog).getByRole("spinbutton", { name: "Útrata Eva Nová (Kč)" })).toBeTruthy();
  });

  it("reports a failed refresh as already saved and can retry reading without another write", async () => {
    mocks.getTripFundOverview.mockRejectedValueOnce(new Error("Offline"));
    render(<TripFundTable initialOverview={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Upravit příjem: Anna Malá" }));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "900" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText(/Změna je uložená, ale přehled se nepodařilo obnovit/);
    fireEvent.click(screen.getByRole("button", { name: "Obnovit přehled" }));
    await waitFor(() => expect(mocks.getTripFundOverview).toHaveBeenCalledTimes(2));
    expect(mocks.updateChild).toHaveBeenCalledTimes(1);
  });

});

const extraPerson = { personId: "extra", name: "Eva Nová", fundSent: 300, fundSpent: 40, fundBalance: 260, amounts: [40] };

it("adds an extra person even when there are no children, then edits their name", async () => {
  render(<TripFundTable initialOverview={{ days: [], children: [] }} />);
  fireEvent.click(screen.getByRole("button", { name: "Přidat extra osobu" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Jméno osoby" }), { target: { value: "Eva Nová" } });
  mocks.getTripFundOverview.mockResolvedValue({ ...initial, extraPeople: [extraPerson] });
  fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
  await waitFor(() => expect(mocks.createExtraFundPerson).toHaveBeenCalledWith("Eva Nová"));
  fireEvent.click(await screen.findByRole("button", { name: "Upravit jméno: Eva Nová" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Jméno osoby" }), { target: { value: "Eva Malá" } });
  fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
  await waitFor(() => expect(mocks.updateExtraFundPerson).toHaveBeenCalledWith("extra", { name: "Eva Malá" }));
});

it("sums children and extra people by column and edits extra amounts", async () => {
  const overview = { ...initial, extraPeople: [extraPerson] };
  mocks.getTripFundOverview.mockResolvedValue(overview);
  render(<TripFundTable initialOverview={overview} />);
  const total = screen.getByRole("row", { name: /Celkem/ });
  expect(within(total).getAllByRole("cell").map(cell => cell.textContent?.replace(/\s/g, ""))).toEqual(["800Kč", "120Kč", "680Kč"]);
  const rows = screen.getAllByRole("row");
  expect(rows.findIndex(row => row.textContent?.includes("Eva Nová"))).toBeGreaterThan(rows.findIndex(row => row.textContent?.includes("Petr Nový")));
  fireEvent.click(screen.getByRole("button", { name: "Upravit příjem: Eva Nová" }));
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "400" } });
  fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "Enter" });
  await waitFor(() => expect(mocks.updateExtraFundPerson).toHaveBeenCalledWith("extra", { fundSent: 400 }));
  await waitFor(() => expect(screen.queryByRole("spinbutton")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Upravit útratu: Eva Nová, 10. 9. 2026" }));
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "60" } });
  fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "Enter" });
  await waitFor(() => expect(mocks.setExtraFundExpense).toHaveBeenCalledWith("extra", "2026-09-10", 60));
});

it("preserves a failed name edit and lets the director retry", async () => {
  render(<TripFundTable initialOverview={{ ...initial, extraPeople: [extraPerson] }} />);
  fireEvent.click(screen.getByRole("button", { name: "Upravit jméno: Eva Nová" }));
  const name = screen.getByRole("textbox", { name: "Jméno osoby" });
  fireEvent.change(name, { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
  expect(mocks.updateExtraFundPerson).not.toHaveBeenCalled();
  mocks.updateExtraFundPerson.mockRejectedValueOnce(new Error("Uložení selhalo"));
  fireEvent.change(name, { target: { value: "Eva Malá" } });
  fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
  await screen.findByText("Uložení selhalo");
  expect((name as HTMLInputElement).value).toBe("Eva Malá");
  fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(mocks.updateExtraFundPerson).toHaveBeenCalledTimes(2);
});
