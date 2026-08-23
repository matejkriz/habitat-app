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
  autoApproved: true,
  submittedAt: new Date(2024, 0, 1),
};

describe("ParentExcuses", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
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
