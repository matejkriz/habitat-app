import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcuseManagementPage from "./page";

const mocks = vi.hoisted(() => ({
  getExcuses: vi.fn(),
  editExcuse: vi.fn(),
  updateExcuse: vi.fn(),
  deleteExcuse: vi.fn(),
}));

vi.mock("@/app/actions/director", () => ({
  getExcuses: mocks.getExcuses,
  editExcuse: mocks.editExcuse,
  updateExcuse: mocks.updateExcuse,
  deleteExcuse: mocks.deleteExcuse,
}));

const lateExcuse = {
  id: "excuse-1",
  fromDate: new Date(2026, 7, 19),
  toDate: new Date(2026, 7, 20),
  reason: "Nemoc",
  rangeState: "LATE" as const,
  submittedAt: new Date(2026, 7, 18, 10),
  child: { id: "child-1", firstName: "Tobiáš", lastName: "Tornádo" },
  submittedBy: { id: "parent-1", name: "Rodič", email: null },
};

describe("ExcuseManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reloads the derived range state after narrowing an excuse", async () => {
    mocks.getExcuses
      .mockResolvedValueOnce([lateExcuse])
      .mockResolvedValueOnce([{ ...lateExcuse, fromDate: new Date(2026, 7, 20), rangeState: "ON_TIME" }]);
    mocks.editExcuse.mockResolvedValue(undefined);
    render(<ExcuseManagementPage />);

    expect(await screen.findByText("Pozdě")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upravit" }));
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-08-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit změny" }));

    await waitFor(() => expect(mocks.getExcuses).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Včas")).toBeTruthy();
    expect(screen.queryByText("Pozdě")).toBeNull();
  });
});
