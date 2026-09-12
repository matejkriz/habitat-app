import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChildrenManagementPage from "./page";

const mocks = vi.hoisted(() => ({
  getAllChildrenWithParents: vi.fn(),
  getAllParents: vi.fn(),
  createChild: vi.fn(),
  updateChild: vi.fn(),
  toggleChildActive: vi.fn(),
  assignParentToChild: vi.fn(),
  removeParentFromChild: vi.fn(),
}));

vi.mock("@/app/actions/director", () => mocks);

describe("ChildrenManagementPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllChildrenWithParents.mockResolvedValue([
      {
        id: "anna",
        firstName: "Anna",
        lastName: "Malá",
        gender: "FEMALE",
        doesNotTakeLunch: false,
        active: true,
        createdAt: new Date(2026, 0, 1),
        parents: [],
      },
    ]);
    mocks.getAllParents.mockResolvedValue([]);
    mocks.updateChild.mockResolvedValue(undefined);
  });

  it("saves the no-lunch setting from child editing", async () => {
    render(<ChildrenManagementPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Upravit Anna Malá" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Neodebírá obědy/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));

    await waitFor(() =>
      expect(mocks.updateChild).toHaveBeenCalledWith("anna", {
        firstName: "Anna",
        lastName: "Malá",
        gender: "FEMALE",
        doesNotTakeLunch: true,
      }),
    );
    expect(await screen.findByText("Bez obědů")).toBeTruthy();
  });
  it("edits a child's fund contribution", async () => {
    render(<ChildrenManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Upravit fond Anna Malá" }));
    fireEvent.change(screen.getByLabelText("Posláno do fondu (Kč)"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit fond" }));
    await waitFor(() => expect(mocks.updateChild).toHaveBeenCalledWith("anna", { fundSent: 1500 }));
    expect(await screen.findByText(/Zůstatek:.*1\s*500/)).toBeTruthy();
  });

});
