import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewExcusePage from "./page";

const mocks = vi.hoisted(() => ({
  getParentChildren: vi.fn(),
  submitExcuse: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
  useSearchParams: () => new URLSearchParams("child=child-1"),
}));

vi.mock("@/app/actions/parent", () => ({
  getParentChildren: mocks.getParentChildren,
  submitExcuse: mocks.submitExcuse,
}));

const children = [
  {
    id: "child-1",
    firstName: "Anna",
    lastName: "Nováková",
    active: true,
    createdAt: new Date(2024, 0, 1),
    updatedAt: new Date(2024, 0, 1),
  },
  {
    id: "child-2",
    firstName: "Jan",
    lastName: "Novák",
    active: true,
    createdAt: new Date(2024, 0, 1),
    updatedAt: new Date(2024, 0, 1),
  },
];

describe("NewExcusePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getParentChildren.mockResolvedValue(children);
    mocks.submitExcuse.mockResolvedValue({
      success: true,
      excuses: [
        {
          id: "excuse-1",
          childId: "child-1",
          fromDate: new Date(2026, 8, 10),
          toDate: new Date(2026, 8, 10),
          autoApproved: true,
        },
      ],
    });
  });

  it("preselects the current child and lets the parent select both children", async () => {
    render(<NewExcusePage />);

    const anna = await screen.findByRole("checkbox", { name: "Anna Nováková" });
    const jan = screen.getByRole("checkbox", { name: "Jan Novák" });

    expect((anna as HTMLInputElement).checked).toBe(true);
    expect((jan as HTMLInputElement).checked).toBe(false);

    fireEvent.click(jan);

    expect((anna as HTMLInputElement).checked).toBe(true);
    expect((jan as HTMLInputElement).checked).toBe(true);
  });

  it("shows an error and does not submit when all children are cleared", async () => {
    render(<NewExcusePage />);

    const anna = await screen.findByRole("checkbox", { name: "Anna Nováková" });
    fireEvent.click(anna);
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    expect(await screen.findByText("Vyberte alespoň jedno dítě.")).toBeTruthy();
    expect(mocks.submitExcuse).not.toHaveBeenCalled();
  });

  it("can submit the excuse only for the other child", async () => {
    render(<NewExcusePage />);

    const anna = await screen.findByRole("checkbox", { name: "Anna Nováková" });
    const jan = screen.getByRole("checkbox", { name: "Jan Novák" });
    fireEvent.click(anna);
    fireEvent.click(jan);
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalled());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.getAll("childIds")).toEqual(["child-2"]);
  });

  it("can submit the excuse for both children", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna Nováková" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Jan Novák" }));
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalled());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.getAll("childIds")).toEqual(["child-1", "child-2"]);
  });
});
