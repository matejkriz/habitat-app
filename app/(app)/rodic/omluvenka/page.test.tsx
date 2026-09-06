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
          isOnTime: true,
        },
      ],
      summary: {
        cancelLunch: true,
        schoolDayCount: 1,
        lateDayCount: 0,
        onTimeDayCount: 1,
        automaticallyApprovedDayCount: 0,
      },
    });
  });

  it("preselects the current child and lets the parent select both children", async () => {
    render(<NewExcusePage />);

    const anna = await screen.findByRole("checkbox", { name: "Anna" });
    const jan = screen.getByRole("checkbox", { name: "Jan" });

    expect((anna as HTMLInputElement).checked).toBe(true);
    expect((jan as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText(/Novák/)).toBeNull();

    fireEvent.click(jan);

    expect((anna as HTMLInputElement).checked).toBe(true);
    expect((jan as HTMLInputElement).checked).toBe(true);
  });

  it("shows an error and does not submit when all children are cleared", async () => {
    render(<NewExcusePage />);

    const anna = await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.click(anna);
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    expect(await screen.findByText("Vyberte alespoň jedno dítě.")).toBeTruthy();
    expect(mocks.submitExcuse).not.toHaveBeenCalled();
  });

  it("can submit the excuse only for the other child", async () => {
    render(<NewExcusePage />);

    const anna = await screen.findByRole("checkbox", { name: "Anna" });
    const jan = screen.getByRole("checkbox", { name: "Jan" });
    fireEvent.click(anna);
    fireEvent.click(jan);
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalled());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.getAll("childIds")).toEqual(["child-2"]);
    expect(formData.get("dayPart")).toBe("FULL_DAY");
    expect(formData.get("cancelLunch")).toBe("true");
  });

  it("shows whole day by default and keeps lunch choice visible for an afternoon absence", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    const dayPart = screen.getByLabelText<HTMLSelectElement>("Dítě bude chybět");
    expect(dayPart.value).toBe("FULL_DAY");
    const lunchToggle = screen.getByRole("switch");
    const reason = screen.getByLabelText("Důvod (volitelné)");
    expect(lunchToggle.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(dayPart, { target: { value: "AFTERNOON" } });

    expect(
      screen.getByText(
        "Dítě bude ve škole dopoledne, odpoledne bude chybět.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("switch")).toBe(lunchToggle);
    expect((lunchToggle as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText("Oběd zůstává přihlášený.")).toBeNull();
  });

  it("submits an afternoon absence with the parent's lunch choice", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.change(screen.getByLabelText("Dítě bude chybět"), {
      target: { value: "AFTERNOON" },
    });
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalledOnce());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("dayPart")).toBe("AFTERNOON");
    expect(formData.get("cancelLunch")).toBe("false");
  });

  it("shows the day-part choice for no date and one day, then hides and resets it for a range", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    expect(screen.getByLabelText("Dítě bude chybět")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-09-10" },
    });
    expect(screen.getByLabelText("Dítě bude chybět")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Dítě bude chybět"), {
      target: { value: "AFTERNOON" },
    });

    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-09-11" },
    });

    expect(screen.queryByLabelText("Dítě bude chybět")).toBeNull();
    expect(screen.getByRole("switch")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalledOnce());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("dayPart")).toBe("FULL_DAY");
  });

  it("can submit the excuse for both children", async () => {
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Jan" }));
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-09-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalled());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.getAll("childIds")).toEqual(["child-1", "child-2"]);
  });

  it("explains a mixed range without claiming that no lunches were canceled", async () => {
    mocks.submitExcuse.mockResolvedValueOnce({
      success: true,
      excuses: [{ id: "excuse-1", childId: "child-1" }],
      summary: {
        cancelLunch: true,
        schoolDayCount: 2,
        lateDayCount: 1,
        onTimeDayCount: 1,
        automaticallyApprovedDayCount: 0,
      },
    });
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-08-19" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-08-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    expect(
      await screen.findByText(/1 oběd bude odhlášen.*1 pozdně omluvený den/i),
    ).toBeTruthy();
    expect(screen.queryByText(/oběd nebude automaticky odhlášen/i)).toBeNull();
  });

  it("confirms automatic approval for a child without lunches", async () => {
    mocks.getParentChildren.mockResolvedValueOnce([
      { ...children[0], doesNotTakeLunch: true },
    ]);
    mocks.submitExcuse.mockResolvedValueOnce({
      success: true,
      excuses: [{ id: "excuse-1", childId: "child-1" }],
      summary: {
        cancelLunch: true,
        schoolDayCount: 1,
        lateDayCount: 0,
        onTimeDayCount: 0,
        automaticallyApprovedDayCount: 1,
      },
    });
    render(<NewExcusePage />);

    await screen.findByText("Nová omluvenka");
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-08-19" },
    });
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-08-19" },
    });
    expect(screen.getByRole("switch")).toBeTruthy();
    expect(await screen.findByText("Dítě neodebírá obědy.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    expect(
      await screen.findByText(/1 den omluvenky byl automaticky schválen/),
    ).toBeTruthy();
  });

  it("lets the parent keep lunch without sending the excuse for review", async () => {
    mocks.submitExcuse.mockResolvedValueOnce({
      success: true,
      excuses: [{ id: "excuse-1", childId: "child-1" }],
      summary: {
        cancelLunch: false,
        schoolDayCount: 1,
        lateDayCount: 0,
        onTimeDayCount: 0,
        automaticallyApprovedDayCount: 1,
      },
    });
    render(<NewExcusePage />);

    await screen.findByRole("checkbox", { name: "Anna" });
    const lunchToggle = screen.getByRole("switch");
    expect((lunchToggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(lunchToggle);
    expect(
      screen.getByText(
        "Oběd zůstane přihlášený a omluvenku není potřeba schvalovat.",
      ),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Odeslat omluvenku" }));

    await waitFor(() => expect(mocks.submitExcuse).toHaveBeenCalledOnce());
    const formData = mocks.submitExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("cancelLunch")).toBe("false");
    expect(
      await screen.findByText(
        "Omluvenku není potřeba schvalovat. Oběd nebude odhlášen.",
      ),
    ).toBeTruthy();
  });
});
