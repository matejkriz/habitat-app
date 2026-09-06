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
  cancelLunch: true,
  dayPart: "FULL_DAY" as const,
  rangeState: "LATE" as const,
  submittedAt: new Date(2026, 7, 18, 10),
  child: {
    id: "child-1",
    firstName: "Tobiáš",
    lastName: "Tornádo",
    doesNotTakeLunch: false,
  },
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
    mocks.createDirectorExcuse.mockResolvedValue({ success: true });
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
      dayPart: "FULL_DAY",
      cancelLunch: "true",
    });
    await waitFor(() => expect(mocks.getExcuses).toHaveBeenCalledTimes(2));
  });

  it("lets the director choose an afternoon absence and choose what happens to lunch", async () => {
    mocks.getExcuses.mockResolvedValue([]);
    mocks.createDirectorExcuse.mockResolvedValue({ success: true });
    render(<ExcuseManagementPage />);

    await screen.findByText("Žádné omluvenky");
    fireEvent.click(screen.getByRole("button", { name: "Přidat omluvenku" }));
    fireEvent.change(screen.getByLabelText("Dítě"), {
      target: { value: "child-1" },
    });
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-08-19" },
    });
    fireEvent.change(screen.getByLabelText("Dítě bude chybět"), {
      target: { value: "AFTERNOON" },
    });

    const lunchToggle = screen.getByRole("switch");
    const reason = screen.getByLabelText("Důvod (volitelné)");
    expect(lunchToggle.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((lunchToggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(lunchToggle);
    fireEvent.click(screen.getByRole("button", { name: "Uložit omluvenku" }));

    await waitFor(() => expect(mocks.createDirectorExcuse).toHaveBeenCalledOnce());
    const formData = mocks.createDirectorExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("dayPart")).toBe("AFTERNOON");
    expect(formData.get("cancelLunch")).toBe("false");
  });

  it("shows the day-part choice without dates and for one day, then hides and resets it for a range", async () => {
    mocks.getExcuses.mockResolvedValue([]);
    mocks.createDirectorExcuse.mockResolvedValue({ success: true });
    render(<ExcuseManagementPage />);

    await screen.findByText("Žádné omluvenky");
    fireEvent.click(screen.getByRole("button", { name: "Přidat omluvenku" }));
    expect(screen.getByLabelText("Dítě bude chybět")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Dítě"), {
      target: { value: "child-1" },
    });
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-08-19" },
    });
    expect(screen.getByLabelText("Dítě bude chybět")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Dítě bude chybět"), {
      target: { value: "MORNING" },
    });
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-08-20" },
    });

    expect(screen.queryByLabelText("Dítě bude chybět")).toBeNull();
    expect(screen.getByRole("switch")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Uložit omluvenku" }));

    await waitFor(() => expect(mocks.createDirectorExcuse).toHaveBeenCalledOnce());
    const formData = mocks.createDirectorExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("dayPart")).toBe("FULL_DAY");
  });

  it("passes the choice to keep lunch to the server action", async () => {
    mocks.getExcuses.mockResolvedValue([]);
    mocks.createDirectorExcuse.mockResolvedValue({ success: true });
    render(<ExcuseManagementPage />);

    await screen.findByText("Žádné omluvenky");
    fireEvent.click(screen.getByRole("button", { name: "Přidat omluvenku" }));
    fireEvent.change(screen.getByLabelText("Dítě"), {
      target: { value: "child-1" },
    });
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-08-19" },
    });
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Uložit omluvenku" }));

    await waitFor(() => expect(mocks.createDirectorExcuse).toHaveBeenCalledOnce());
    const formData = mocks.createDirectorExcuse.mock.calls[0][0] as FormData;
    expect(formData.get("cancelLunch")).toBe("false");
    expect(
      await screen.findByText("Omluvenka byla uložena. Oběd nebude odhlášen."),
    ).toBeTruthy();
  });

  it("does not describe a lunch-preserving excuse as director-approved", async () => {
    mocks.getExcuses.mockResolvedValue([
      {
        ...lateExcuse,
        cancelLunch: false,
        rangeState: "LATE_APPROVED",
      },
    ]);
    render(<ExcuseManagementPage />);

    expect(await screen.findByText("Bez schválení")).toBeTruthy();
    expect(screen.getByText(/ponechat přihlášený/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Zrušit schválení" }),
    ).toBeNull();
  });

  it("copies the start date into an empty or earlier end date", async () => {
    mocks.getExcuses.mockResolvedValue([]);
    render(<ExcuseManagementPage />);

    await screen.findByText("Žádné omluvenky");
    fireEvent.click(screen.getByRole("button", { name: "Přidat omluvenku" }));

    const fromDate = screen.getByLabelText("Od");
    const toDate = screen.getByLabelText("Do");
    fireEvent.change(fromDate, { target: { value: "2026-09-10" } });

    expect((toDate as HTMLInputElement).value).toBe("2026-09-10");

    fireEvent.change(toDate, { target: { value: "2026-09-12" } });
    fireEvent.change(fromDate, { target: { value: "2026-09-11" } });
    expect((toDate as HTMLInputElement).value).toBe("2026-09-12");

    fireEvent.change(fromDate, { target: { value: "2026-09-13" } });
    expect((toDate as HTMLInputElement).value).toBe("2026-09-13");
  });

  it("shows a safe validation error returned by the server action", async () => {
    mocks.getExcuses.mockResolvedValue([]);
    mocks.createDirectorExcuse.mockResolvedValue({
      success: false,
      error: "Datum konce nesmí být před datem začátku.",
    });
    render(<ExcuseManagementPage />);

    await screen.findByText("Žádné omluvenky");
    fireEvent.click(screen.getByRole("button", { name: "Přidat omluvenku" }));
    fireEvent.change(screen.getByLabelText("Dítě"), {
      target: { value: "child-1" },
    });
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit omluvenku" }));

    expect(
      await screen.findByText("Datum konce nesmí být před datem začátku."),
    ).toBeTruthy();
    expect(mocks.getExcuses).toHaveBeenCalledOnce();
  });
});
