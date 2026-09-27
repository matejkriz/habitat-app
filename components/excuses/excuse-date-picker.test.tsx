import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExcuseDatePicker } from "./excuse-date-picker";

const getCalendarMonth = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/calendar", () => ({ getExcuseCalendarMonth: getCalendarMonth }));

const props = { label: "Od", name: "fromDate", value: "2026-09-10", onChange: vi.fn() };

describe("attendance date selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCalendarMonth.mockResolvedValue({ monthKey: "2026-09", closedDateKeys: ["2026-09-15"] });
  });

  it("disables a regular off day with a readable reason and the closed-day style", async () => {
    render(<ExcuseDatePicker {...props} getDisabledReason={date => date.getDay() === 2 ? "Dítě tento den běžně nechodí." : null} />);
    fireEvent.click(screen.getByLabelText("Od"));
    const tuesday = await screen.findByRole("button", { name: "úterý 8. září 2026, Dítě tento den běžně nechodí." });
    expect(tuesday).toHaveProperty("disabled", true);
    expect(tuesday.className).toContain("line-through");
    fireEvent.click(tuesday);
    expect(props.onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "středa 9. září 2026" })).toHaveProperty("disabled", false);
  });

  it("allows makeup off days while retaining school closures and minimum date", async () => {
    render(<ExcuseDatePicker {...props} min="2026-09-10" getDisabledReason={date => date.getDay() !== 2 ? "Dítě tento den běžně chodí." : null} />);
    fireEvent.click(screen.getByLabelText("Od"));
    const tuesday = await screen.findByRole("button", { name: "úterý 22. září 2026" });
    expect(tuesday).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: /úterý 8\. září 2026, mimo povolený rozsah/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /úterý 15\. září 2026, Habitat je zavřený/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /pátek 11\. září 2026, Habitat je zavřený/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /středa 16\. září 2026, Dítě tento den běžně chodí/ })).toHaveProperty("disabled", true);
    fireEvent.click(tuesday);
    expect(props.onChange).toHaveBeenCalledWith("2026-09-22");
  });

  it("updates availability when the selected child's attendance changes", async () => {
    const { rerender } = render(<ExcuseDatePicker {...props} getDisabledReason={date => date.getDay() === 2 ? "Dítě tento den běžně nechodí." : null} />);
    fireEvent.click(screen.getByLabelText("Od"));
    expect(await screen.findByRole("button", { name: /úterý 8\. září 2026, Dítě tento den běžně nechodí/ })).toHaveProperty("disabled", true);
    rerender(<ExcuseDatePicker {...props} getDisabledReason={() => null} />);
    expect(screen.getByRole("button", { name: "úterý 8. září 2026" })).toHaveProperty("disabled", false);
  });
});
