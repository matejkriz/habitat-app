import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    gender: "FEMALE",
    doesNotTakeLunch: false,
  },
  {
    id: "child-2",
    firstName: "Jan",
    gender: "MALE",
    doesNotTakeLunch: false,
  },
];

describe("day-part choice in the parent excuse form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getParentChildren.mockResolvedValue(children);
    mocks.submitExcuse.mockResolvedValue({
      success: true,
      excuses: [{ id: "excuse-1", childId: "child-1" }],
      summary: {
        cancelLunch: true,
        schoolDayCount: 1,
        lateDayCount: 0,
        onTimeDayCount: 1,
        automaticallyApprovedDayCount: 0,
      },
    });
  });

  it("shows three one-click choices before a date is selected and defaults to the whole day", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    const group = screen.getByRole("group", { name: "Dítě bude chybět" });
    const choices = within(group).getAllByRole("radio");

    expect(choices).toHaveLength(3);
    expect(within(group).getByRole("radio", { name: "Celý den" })).toHaveProperty(
      "checked",
      true,
    );
    expect(within(group).getByRole("radio", { name: "Dopoledne" })).toBeTruthy();
    expect(within(group).getByRole("radio", { name: "Odpoledne" })).toBeTruthy();
  });

  it("switches to the afternoon with one click and submits that choice", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.click(screen.getByText("Odpoledne"));
    expect(screen.getByRole("radio", { name: "Odpoledne" })).toHaveProperty(
      "checked",
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalledOnce());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("dayPart")).toBe("AFTERNOON");
  });

  it("hides the choice for a multi-day range and submits the whole day", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Dopoledne" }));
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-09-11" },
    });

    expect(screen.queryByRole("group", { name: "Dítě bude chybět" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalledOnce());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("dayPart")).toBe("FULL_DAY");
  });
});
