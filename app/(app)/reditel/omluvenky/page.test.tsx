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
  getExcuseCalendarMonth: vi.fn(),
}));

vi.mock("@/app/actions/director", () => ({
  getExcuses: mocks.getExcuses,
  getExcuseChildren: mocks.getExcuseChildren,
  createDirectorExcuse: mocks.createDirectorExcuse,
  editExcuse: mocks.editExcuse,
  updateExcuse: mocks.updateExcuse,
  deleteExcuse: mocks.deleteExcuse,
}));

vi.mock("@/app/actions/calendar", () => ({
  getExcuseCalendarMonth: mocks.getExcuseCalendarMonth,
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
    mocks.getExcuseCalendarMonth.mockResolvedValue({
      monthKey: "2026-08",
      closedDateKeys: [],
    });
    mocks.getExcuseChildren.mockResolvedValue([
      { id: "child-1", firstName: "Tobiáš", lastName: "Tornádo" },
      { id: "child-2", firstName: "Anna", lastName: "Malá" },
    ]);
  });

  it("filters director-created absence dates and clears dates after selecting another child", async () => {
    mocks.getExcuses.mockResolvedValue([]);
    mocks.getExcuseChildren.mockResolvedValue([
      { id: "child-1", firstName: "Tobiáš", lastName: "Tornádo", attendanceStartDate: "2026-01-01", attendanceDays: [1, 3] },
      { id: "child-2", firstName: "Anna", lastName: "Malá", attendanceStartDate: "2026-01-01", attendanceDays: [1, 2] },
    ]);
    render(<ExcuseManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Přidat omluvenku" }));
    fireEvent.change(screen.getByLabelText("Dítě"), { target: { value: "child-1" } });
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-08-19" } });
    fireEvent.click(screen.getByLabelText("Od"));
    expect(await screen.findByRole("button", { name: /čtvrtek 20\. srpna 2026/i })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /středa 19\. srpna 2026/i })).toHaveProperty("disabled", false);
    fireEvent.change(screen.getByLabelText("Dítě"), { target: { value: "child-2" } });
    expect(screen.getByLabelText("Od")).toHaveProperty("value", "");
    expect(screen.getByLabelText("Do")).toHaveProperty("value", "");
  });

  it("identifies a makeup and lets the director approve the lunch registration", async () => {
    mocks.getExcuses.mockResolvedValue([{ ...lateExcuse, kind: "MAKEUP", cancelLunch: false }]);
    render(<ExcuseManagementPage />);
    expect(await screen.findByText("Náhrada")).toBeTruthy();
    expect(screen.getByText("Pozdě - oběd nepřihlášen")).toBeTruthy();
    expect(screen.getByText("přihlásit")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Přihlásit oběd" }));
    await waitFor(() => expect(mocks.updateExcuse).toHaveBeenCalledWith("excuse-1", true));
  });

  it("shows a makeup without a lunch request", async () => {
    mocks.getExcuses.mockResolvedValue([{ ...lateExcuse, kind: "MAKEUP", cancelLunch: true, rangeState: "ON_TIME" }]);
    render(<ExcuseManagementPage />);
    expect(await screen.findByText("Náhrada")).toBeTruthy();
    expect(screen.getByText("nepřihlašovat")).toBeTruthy();
    expect(screen.getByText("Bez oběda")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Přihlásit oběd" })).toBeNull();
  });

  it("lets the director forgive a charged lunch on a late excuse", async () => {
    mocks.getExcuses.mockResolvedValue([lateExcuse]);
    render(<ExcuseManagementPage />);

    expect(await screen.findByText("Pozdě - oběd započítán")).toBeTruthy();
    expect(screen.getByRole("option", { name: "K vyřízení" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Prominout oběd" }));

    await waitFor(() => expect(mocks.updateExcuse).toHaveBeenCalledWith("excuse-1", true));
  });

  it("lets the director charge a previously forgiven lunch", async () => {
    mocks.getExcuses.mockResolvedValue([{ ...lateExcuse, rangeState: "LATE_APPROVED" }]);
    render(<ExcuseManagementPage />);

    expect(await screen.findByText("Pozdě - oběd prominut")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Započítat oběd" }));

    await waitFor(() => expect(mocks.updateExcuse).toHaveBeenCalledWith("excuse-1", false));
  });

  it("lets the director cancel a previously registered makeup lunch", async () => {
    mocks.getExcuses.mockResolvedValue([
      { ...lateExcuse, kind: "MAKEUP", cancelLunch: false, rangeState: "LATE_APPROVED" },
    ]);
    render(<ExcuseManagementPage />);

    expect(await screen.findByText("Pozdě - oběd přihlášen")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Odhlásit oběd" }));
    await waitFor(() => expect(mocks.updateExcuse).toHaveBeenCalledWith("excuse-1", false));
    expect(screen.queryByRole("button", { name: "Započítat oběd" })).toBeNull();
  });

  it.each([
    { dayPart: "AFTERNOON", doesNotTakeLunch: false },
    { dayPart: "FULL_DAY", doesNotTakeLunch: true },
  ])("does not offer lunch actions for a makeup without lunch (%s)", async ({ dayPart, doesNotTakeLunch }) => {
    mocks.getExcuses.mockResolvedValue([
      {
        ...lateExcuse,
        kind: "MAKEUP",
        cancelLunch: false,
        rangeState: "LATE_APPROVED",
        dayPart,
        child: { ...lateExcuse.child, doesNotTakeLunch },
      },
    ]);
    render(<ExcuseManagementPage />);

    expect(await screen.findByText("Bez oběda")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Odhlásit oběd" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Přihlásit oběd" })).toBeNull();
  });

  it.each(["ON_TIME", "LATE", "LATE_APPROVED"])(
    "keeps lunch on an afternoon-only absence (%s)",
    async (rangeState) => {
      mocks.getExcuses.mockResolvedValue([
        { ...lateExcuse, dayPart: "AFTERNOON", rangeState },
      ]);
      render(<ExcuseManagementPage />);

      expect(await screen.findByText("Oběd ponechán")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Prominout oběd" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Započítat oběd" })).toBeNull();
    },
  );

  it("describes the shared pending filter without implying excuse approval", async () => {
    mocks.getExcuses.mockResolvedValue([]);
    render(<ExcuseManagementPage />);

    await screen.findByText("Žádné omluvenky");
    fireEvent.change(screen.getByRole("combobox", { name: "Filtr omluvenek" }), {
      target: { value: "pending" },
    });

    expect(await screen.findByText("Žádné omluvenky k vyřízení")).toBeTruthy();
    await waitFor(() => expect(mocks.getExcuses).toHaveBeenLastCalledWith({ pendingOnly: true }));
  });

  it("reloads the derived range state after narrowing an excuse", async () => {
    mocks.getExcuses
      .mockResolvedValueOnce([lateExcuse])
      .mockResolvedValueOnce([{ ...lateExcuse, fromDate: new Date(2026, 7, 20), rangeState: "ON_TIME" }]);
    mocks.editExcuse.mockResolvedValue({ success: true, excuse: lateExcuse });
    render(<ExcuseManagementPage />);

    expect(await screen.findByText("Pozdě - oběd započítán")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upravit" }));
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2026-08-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit změny" }));

    await waitFor(() => expect(mocks.getExcuses).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Včas")).toBeTruthy();
    expect(screen.queryByText("Pozdě - oběd započítán")).toBeNull();
  });

  it("lets the director create an excuse for any active child", async () => {
    mocks.getExcuses.mockResolvedValueOnce([]).mockResolvedValueOnce([lateExcuse]);
    mocks.createDirectorExcuse.mockResolvedValue({ success: true });
    render(<ExcuseManagementPage />);

    await screen.findByText("Žádné omluvenky");
    fireEvent.click(screen.getByRole("button", { name: "Přidat omluvenku" }));
    expect(screen.getByText("Oběd lze odhlásit i po termínu.")).toBeTruthy();
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
    expect(await screen.findByText("Omluvenka byla uložena.")).toBeTruthy();
  });

  it("shows an edit validation error without discarding the form or reloading", async () => {
    const error = "Rozsah omluvenky nelze rozšířit. Na další dny podejte novou omluvenku.";
    mocks.getExcuses.mockResolvedValue([lateExcuse]);
    mocks.editExcuse.mockResolvedValue({ success: false, error });
    render(<ExcuseManagementPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Upravit" }));
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2026-08-21" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit změny" }));
    expect((await screen.findByRole("alert")).textContent).toBe(error);
    expect((screen.getByLabelText("Do") as HTMLInputElement).value).toBe("21. 8. 2026");
    expect(mocks.getExcuses).toHaveBeenCalledOnce();
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
    fireEvent.click(screen.getByRole("radio", { name: "Odpoledne" }));

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
    expect(screen.getByRole("group", { name: "Dítě bude chybět" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Dítě"), {
      target: { value: "child-1" },
    });
    fireEvent.change(screen.getByLabelText("Od"), {
      target: { value: "2026-08-19" },
    });
    expect(screen.getByRole("group", { name: "Dítě bude chybět" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Dopoledne" }));
    fireEvent.change(screen.getByLabelText("Do"), {
      target: { value: "2026-08-20" },
    });

    expect(screen.queryByRole("group", { name: "Dítě bude chybět" })).toBeNull();
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
      await screen.findByText("Omluvenka byla uložena."),
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

    expect(await screen.findByText("Oběd ponechán")).toBeTruthy();
    expect(screen.getByText(/ponechat přihlášený/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Započítat oběd" }),
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

    expect((toDate as HTMLInputElement).value).toBe("10. 9. 2026");

    fireEvent.change(toDate, { target: { value: "2026-09-12" } });
    fireEvent.change(fromDate, { target: { value: "2026-09-11" } });
    expect((toDate as HTMLInputElement).value).toBe("12. 9. 2026");

    fireEvent.change(fromDate, { target: { value: "2026-09-13" } });
    expect((toDate as HTMLInputElement).value).toBe("13. 9. 2026");
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

it("shows a failed load and can retry without claiming the list is empty", async () => {
  mocks.getExcuseChildren.mockResolvedValue([]);
  mocks.getExcuses.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([lateExcuse]);
  render(<ExcuseManagementPage />);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("načíst"));
  expect(screen.queryByText("Žádné omluvenky")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
  expect(await screen.findByText("Tobiáš Tornádo")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("reports a failed lunch update and allows another attempt", async () => {
  mocks.getExcuseChildren.mockResolvedValue([]);
  mocks.getExcuses.mockResolvedValue([lateExcuse]);
  mocks.updateExcuse.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
  render(<ExcuseManagementPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Prominout oběd" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Nepodařilo se změnit započítání oběda. Zkuste to znovu.");
  fireEvent.click(screen.getByRole("button", { name: "Prominout oběd" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
