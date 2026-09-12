import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const save = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/day-details", () => ({ saveDayDetails: save }));
import { DayDetailsForm } from "./day-details-form";
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("day details editor", () => {
  it("saves a name, whole crown amount and multiline report", async () => {
    const onSaved = vi.fn();
    render(<DayDetailsForm dateKey="2026-09-10" initialDetails={{ name: null, expense: null, report: null }} showReport onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Jméno dne"), { target: { value: "Jarmark" } });
    fireEvent.change(screen.getByLabelText("Útrata na dítě (Kč)"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Report"), { target: { value: "První řádek\nDruhý řádek" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit podrobnosti" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("2026-09-10", { name: "Jarmark", expense: 120, report: "První řádek\nDruhý řádek" }));
    expect(onSaved).toHaveBeenCalled();
  });
  it("does not submit a report from the calendar and preserves input after failure", async () => {
    save.mockRejectedValue(new Error("Uložení selhalo"));
    render(<DayDetailsForm dateKey="2026-09-10" initialDetails={{ name: "Zoo", expense: 100 }} onSaved={vi.fn()} />);
    expect(screen.queryByLabelText("Report")).toBeNull();
    fireEvent.change(screen.getByLabelText("Jméno dne"), { target: { value: "Hrad" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit podrobnosti" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Uložení selhalo");
    expect(screen.getByLabelText("Jméno dne")).toHaveProperty("value", "Hrad");
    expect(save).toHaveBeenCalledWith("2026-09-10", { name: "Hrad" });
  });
});
