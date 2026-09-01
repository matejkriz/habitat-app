import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcuseManagementPage from "./page";

const mocks = vi.hoisted(() => ({
  getExcuses: vi.fn(),
  getExcuseChildren: vi.fn(),
  createDirectorExcuse: vi.fn(),
  editExcuse: vi.fn(),
  updateExcuse: vi.fn(),
  deleteExcuse: vi.fn(),
}));

vi.mock("@/app/actions/director", () => ({
  getExcuses: mocks.getExcuses,
  getExcuseChildren: mocks.getExcuseChildren,
  createDirectorExcuse: mocks.createDirectorExcuse,
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
    mocks.getExcuseChildren.mockResolvedValue([
      { id: "child-1", firstName: "Tobiáš", lastName: "Tornádo" },
      { id: "child-2", firstName: "Anna", lastName: "Malá" },
    ]);
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

  it("lets the director create an excuse for any active child", async () => {
    mocks.getExcuses.mockResolvedValueOnce([]).mockResolvedValueOnce([lateExcuse]);
    mocks.createDirectorExcuse.mockResolvedValue(undefined);
    render(<ExcuseManagementPage />);

    await screen.findByText("Žádné omluvenky");
    fireEvent.click(screen.getByRole("button", { name: "Přidat omluvenku" }));
    fireEvent.change(screen.getByLabelText("Dítě"), {
      target: { value: "child-2" },
    });
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-08-19" },
    });
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-08-20" },
    });
    fireEvent.change(screen.getByLabelText("Důvod (volitelné)"), {
      target: { value: "Nemoc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit omluvenku" }));

    await waitFor(() => expect(mocks.createDirectorExcuse).toHaveBeenCalledOnce());
    const formData = mocks.createDirectorExcuse.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData)).toEqual({
      childId: "child-2",
      fromDate: "2026-08-19",
      toDate: "2026-08-20",
      reason: "Nemoc",
    });
    await waitFor(() => expect(mocks.getExcuses).toHaveBeenCalledTimes(2));
  });
});
