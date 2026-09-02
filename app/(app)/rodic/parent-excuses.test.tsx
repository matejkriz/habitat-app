import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParentExcuses } from "./parent-excuses";

const actions = vi.hoisted(() => ({
  editParentExcuse: vi.fn(),
  deleteParentExcuse: vi.fn(),
}));

vi.mock("@/app/actions/parent", () => actions);

const excuse = {
  id: "excuse-1",
  fromDate: new Date(2024, 0, 2),
  toDate: new Date(2024, 0, 3),
  reason: "Nemoc",
  cancelLunch: true,
  submittedAt: new Date(2024, 0, 1),
};

describe("ParentExcuses", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a single-day excuse as one date, not a range", () => {
    render(
      <ParentExcuses
        excuses={[{ ...excuse, fromDate: new Date(2026, 7, 20), toDate: new Date(2026, 7, 20) }]}
      />,
    );

    expect(screen.getByText("20. 8.")).toBeTruthy();
  });

  it("shows a multi-day excuse as a range", () => {
    render(<ParentExcuses excuses={[excuse]} />);

    expect(screen.getByText("2. 1. – 3. 1.")).toBeTruthy();
  });

  // Whether a given day was on time is shown per day in the calendar; the card
  // covers a whole range and would have to flatten that into one label.
  it("does not label the range as on time or late", () => {
    render(<ParentExcuses excuses={[excuse]} />);

    expect(screen.queryByText("Včas")).toBeNull();
    expect(screen.queryByText("Pozdě")).toBeNull();
  });

  it("shows when the lunch remains ordered", () => {
    render(<ParentExcuses excuses={[{ ...excuse, cancelLunch: false }]} />);

    expect(screen.getByText("Oběd zůstává přihlášený")).toBeTruthy();
  });

  it("saves changes through the parent action", async () => {
    actions.editParentExcuse.mockResolvedValue({
      ...excuse,
      reason: "Rodinné důvody",
    });

    render(<ParentExcuses excuses={[excuse]} />);
    fireEvent.click(screen.getByRole("button", { name: "Upravit" }));
    fireEvent.change(screen.getByLabelText("Důvod"), {
      target: { value: "Rodinné důvody" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit změny" }));

    await waitFor(() => {
      expect(actions.editParentExcuse).toHaveBeenCalledWith("excuse-1", {
        fromDate: "2024-01-02",
        toDate: "2024-01-03",
        reason: "Rodinné důvody",
      });
    });
    expect(await screen.findByText("Rodinné důvody")).toBeTruthy();
  });

  it("removes a deleted excuse from the list", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    actions.deleteParentExcuse.mockResolvedValue(undefined);

    render(<ParentExcuses excuses={[excuse]} />);
    fireEvent.click(screen.getByRole("button", { name: "Smazat" }));

    await waitFor(() => expect(actions.deleteParentExcuse).toHaveBeenCalledWith("excuse-1"));
    expect(screen.getByText("Zatím nemáte žádné omluvenky.")).toBeTruthy();
  });
});
