import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAllChildren: vi.fn(),
  getAttendanceForDate: vi.fn(),
  saveAttendance: vi.fn(),
  setNoLunchForDate: vi.fn(),
}));

vi.mock("@/app/actions/day-details", () => ({ saveDayDetails: vi.fn(), getDayTripExpenses: async () => [], setChildTripExpense: vi.fn() }));

vi.mock("@/app/actions/teacher", () => mocks);

import TeacherAttendancePage from "./page";

function shiftDate(date: string, days: number) {
  const shiftedDate = new Date(`${date}T00:00:00Z`);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
  return shiftedDate.toISOString().slice(0, 10);
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("TeacherAttendancePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("uses each child's gender in attendance labels", async () => {
    mocks.getAllChildren.mockResolvedValue([
      {
        id: "child-1",
        firstName: "Jana",
        lastName: "Nováková",
        gender: "FEMALE",
      },
      {
        id: "child-2",
        firstName: "Jan",
        lastName: "Novák",
        gender: "MALE",
      },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [
        { childId: "child-1", presence: "PRESENT" },
        { childId: "child-2", presence: "ABSENT" },
      ],
      excuses: [],
    });

    render(<TeacherAttendancePage />);

    expect(
      await screen.findByText("Přítomna", { selector: "span" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Nepřítomen", { selector: "span" }),
    ).toBeTruthy();
  });

  it("lets the director mark the selected day as a day without lunch", async () => {
    mocks.getAllChildren.mockResolvedValue([]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [],
      noLunch: false,
      canManageLunch: true,
    });
    mocks.setNoLunchForDate.mockResolvedValue({ noLunch: true });

    render(<TeacherAttendancePage />);

    const summary = await screen.findByText("Podrobnosti", { selector: "summary" });
    expect(summary.closest("details")!.open).toBe(false);
    fireEvent.click(summary);
    const checkbox = await screen.findByRole<HTMLInputElement>("checkbox", {
      name: "Tento den nebyl oběd",
    });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mocks.setNoLunchForDate).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        true,
      );
    });
    expect(await screen.findByText("Tento den byl označený jako den bez oběda.")).toBeTruthy();
  });

  it("does not show excuse timeliness in attendance", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Žofie", lastName: "Žížalka", gender: "FEMALE" },
      { id: "child-2", firstName: "Oskar", lastName: "Okurka", gender: "MALE" },
      { id: "child-3", firstName: "Pavel", lastName: "Pampeliška", gender: "MALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [
        { childId: "child-1", state: "ON_TIME" },
        { childId: "child-2", state: "LATE" },
        { childId: "child-3", state: "LATE_APPROVED", lunchCancelled: false },
      ],
    });

    render(<TeacherAttendancePage />);

    await waitFor(() => {
      expect(screen.getByText("Žofie Žížalka")).toBeTruthy();
    });
    expect(screen.queryByText("Omluveno včas")).toBeNull();
    expect(screen.queryByText("Omluveno pozdě")).toBeNull();
    expect(screen.queryByText("Pozdě – schváleno")).toBeNull();
    expect(screen.queryByText("Pozdě – oběd ponechán")).toBeNull();
  });

  it("keeps child details and attendance controls separated on narrow screens", async () => {
    mocks.getAllChildren.mockResolvedValue([
      {
        id: "child-1",
        firstName: "Amália",
        lastName: "Procházková",
        gender: "FEMALE",
      },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [{ childId: "child-1", state: "LATE" }],
    });

    render(<TeacherAttendancePage />);

    const attendanceToggle = await screen.findByRole<HTMLInputElement>(
      "checkbox",
      { name: "Docházka: Amália Procházková" },
    );
    const row = attendanceToggle.closest("label");
    const controls = attendanceToggle.parentElement?.parentElement;

    expect(row?.className).toContain("grid");
    expect(row?.className).toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(controls?.className).toContain("shrink-0");
    expect(controls?.className).toContain("flex-col");
    expect(controls?.className).toContain("sm:flex-row");
  });

  it("keeps partial-day information without showing excuse timeliness", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Žofie", lastName: "Žížalka", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [{ childId: "child-1", state: "ON_TIME", dayPart: "MORNING" }],
    });

    render(<TeacherAttendancePage />);

    expect(await screen.findByText("Jen odpoledne")).toBeTruthy();
    expect(screen.queryByText("Omluveno včas")).toBeNull();
  });

  it("prefills excused children as absent unless attendance was already saved", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Žofie", lastName: "Žížalka", gender: "FEMALE" },
      { id: "child-2", firstName: "Oskar", lastName: "Okurka", gender: "MALE" },
      { id: "child-3", firstName: "Božena", lastName: "Bublina", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [{ childId: "child-2", presence: "PRESENT" }],
      excuses: [
        { childId: "child-1", state: "ON_TIME" },
        { childId: "child-2", state: "LATE" },
      ],
    });

    render(<TeacherAttendancePage />);

    await waitFor(() => {
      expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    });
    const toggles = screen.getAllByRole<HTMLInputElement>("checkbox");
    expect(toggles[0].checked).toBe(false);
    expect(toggles[1].checked).toBe(true);
    expect(toggles[2].checked).toBe(true);
  });

  it("keeps an afternoon-only child present by default and lowers the afternoon plan", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Žofie", lastName: "Žížalka", gender: "FEMALE" },
      { id: "child-2", firstName: "Oskar", lastName: "Okurka", gender: "MALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [
        { childId: "child-1", state: "ON_TIME", dayPart: "AFTERNOON" },
      ],
    });

    render(<TeacherAttendancePage />);

    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(2));
    expect(screen.getAllByRole<HTMLInputElement>("checkbox")[0].checked).toBe(true);
    expect(screen.getByText("Jen dopoledne")).toBeTruthy();
    const plan = screen.getByRole("region", { name: "Plánovaná účast" });
    expect(within(plan).getByText("2", { selector: "p" })).toBeTruthy();
    expect(within(plan).getByText("1", { selector: "p" })).toBeTruthy();
  });

  it("confirms attendance, disables the saved button and saves subsequent changes", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Ada", lastName: "Lovelace", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false, attendance: [], excuses: [], noLunch: false, canManageLunch: false,
    });
    mocks.saveAttendance.mockResolvedValue({ success: true, recordCount: 1 });

    render(<TeacherAttendancePage />);

    const confirm = await screen.findByRole<HTMLButtonElement>("button", { name: "Potvrdit docházku" });
    expect(confirm.disabled).toBe(false);
    expect(screen.queryByText("Všechny děti přítomné")).toBeNull();
    expect(screen.queryByText("Přítomné děti")).toBeNull();
    expect(screen.queryByText("Nepřítomné děti")).toBeNull();
    fireEvent.click(confirm);

    expect((await screen.findByRole<HTMLButtonElement>("button", { name: "Uloženo" })).disabled).toBe(true);
    expect(mocks.saveAttendance.mock.calls[0][0].get("child-child-1")).toBe("present");
    fireEvent.click(screen.getByRole("checkbox"));
    const saveChanges = screen.getByRole<HTMLButtonElement>("button", { name: "Uložit změny" });
    expect(saveChanges.disabled).toBe(false);
    fireEvent.click(saveChanges);

    expect((await screen.findByRole<HTMLButtonElement>("button", { name: "Uloženo" })).disabled).toBe(true);
    expect(mocks.saveAttendance.mock.calls[1][0].get("child-child-1")).toBe("absent");
  });

  it("recognizes stored attendance and returning toggles to their saved values", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Ada", lastName: "Lovelace", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false, attendance: [{ childId: "child-1", presence: "PRESENT" }],
      excuses: [], noLunch: false, canManageLunch: false,
    });
    render(<TeacherAttendancePage />);

    expect((await screen.findByRole<HTMLButtonElement>("button", { name: "Uloženo" })).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Uložit změny" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Uloženo" }).disabled).toBe(true);
  });

  it("keeps failed confirmation available for retry", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Ada", lastName: "Lovelace", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false, attendance: [], excuses: [], noLunch: false, canManageLunch: false,
    });
    mocks.saveAttendance.mockRejectedValue(new Error("Uložení selhalo"));
    render(<TeacherAttendancePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Potvrdit docházku" }));
    expect(await screen.findByText("Uložení selhalo")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Potvrdit docházku" }).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Uloženo" })).toBeNull();
  });

  it("keeps edits made during saving unsaved", async () => {
    const saving = createDeferred<{ success: true; recordCount: number }>();
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Ada", lastName: "Lovelace", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false, attendance: [], excuses: [], noLunch: false, canManageLunch: false,
    });
    mocks.saveAttendance.mockReturnValue(saving.promise);
    render(<TeacherAttendancePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Potvrdit docházku" }));
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => saving.resolve({ success: true, recordCount: 1 }));

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Uložit změny" }).disabled).toBe(false);
    expect(screen.getByRole<HTMLInputElement>("checkbox").checked).toBe(false);
  });

  it("does not mark another day saved when a pending save completes", async () => {
    const saving = createDeferred<{ success: true; recordCount: number }>();
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Ada", lastName: "Lovelace", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false, attendance: [], excuses: [], noLunch: false, canManageLunch: false,
    });
    mocks.saveAttendance.mockReturnValue(saving.promise);
    render(<TeacherAttendancePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Potvrdit docházku" }));
    fireEvent.click(screen.getByRole("button", { name: "Předchozí den" }));
    await screen.findByRole("checkbox");
    await act(async () => saving.resolve({ success: true, recordCount: 1 }));

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Potvrdit docházku" }).disabled).toBe(false);
    expect(screen.queryByText("Docházka uložena (1 záznamů)")).toBeNull();
  });

  it("moves to the previous calendar day", () => {
    mocks.getAllChildren.mockImplementation(() => new Promise(() => {}));
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [],
    });
    render(<TeacherAttendancePage />);

    const dateInput = screen.getByLabelText<HTMLInputElement>("Datum docházky");
    const initialDate = dateInput.value;

    fireEvent.click(screen.getByRole("button", { name: "Předchozí den" }));

    expect(dateInput.value).toBe(shiftDate(initialDate, -1));
  });

  it("lets the date input shrink between day controls on narrow screens", () => {
    mocks.getAllChildren.mockImplementation(() => new Promise(() => {}));
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [],
    });

    render(<TeacherAttendancePage />);

    const dateInput = screen.getByLabelText<HTMLInputElement>("Datum docházky");
    const dateInputSlot = dateInput.parentElement?.parentElement;
    const previousDayButton = screen.getByRole("button", {
      name: "Předchozí den",
    });
    const nextDayButton = screen.getByRole("button", {
      name: "Následující den",
    });

    expect(dateInputSlot?.className).toContain("min-w-0");
    expect(dateInputSlot?.className).toContain("flex-1");
    expect(dateInput.className).toContain("min-w-0");
    expect(previousDayButton.className).toContain("h-11");
    expect(previousDayButton.className).toContain("w-11");
    expect(nextDayButton.className).toContain("h-11");
    expect(nextDayButton.className).toContain("w-11");
  });

  it("moves to future calendar days", () => {
    mocks.getAllChildren.mockImplementation(() => new Promise(() => {}));
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [],
    });
    render(<TeacherAttendancePage />);

    const dateInput = screen.getByLabelText<HTMLInputElement>("Datum docházky");
    const nextDayButton = screen.getByRole<HTMLButtonElement>("button", {
      name: "Následující den",
    });
    const today = new Date().toISOString().slice(0, 10);

    expect(dateInput.max).toBe("");
    expect(nextDayButton.disabled).toBe(false);

    fireEvent.click(nextDayButton);
    expect(dateInput.value).toBe(shiftDate(today, 1));

    fireEvent.click(nextDayButton);
    expect(dateInput.value).toBe(shiftDate(today, 2));
  });

  it("keeps future attendance read-only", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Ada", lastName: "Lovelace", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [],
    });

    render(<TeacherAttendancePage />);

    expect(await screen.findByRole("checkbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Potvrdit docházku" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Následující den" }));

    expect(await screen.findByText("Budoucí datum")).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Všechny děti přítomné" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Potvrdit docházku" })).toBeNull();
  });

  it("keeps showing a skeleton when an older date finishes loading", async () => {
    const olderDate = createDeferred<{
      isClosed: boolean;
      attendance: never[];
      excuses: never[];
    }>();
    const selectedDate = createDeferred<{
      isClosed: boolean;
      attendance: never[];
      excuses: never[];
    }>();

    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Ada", lastName: "Lovelace", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate
      .mockResolvedValueOnce({
        isClosed: false,
        attendance: [],
        excuses: [],
      })
      .mockReturnValueOnce(olderDate.promise)
      .mockReturnValueOnce(selectedDate.promise);

    render(<TeacherAttendancePage />);

    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();

    const nextDayButton = screen.getByRole("button", {
      name: "Následující den",
    });
    fireEvent.click(nextDayButton);
    await waitFor(() => {
      expect(mocks.getAttendanceForDate).toHaveBeenCalledTimes(2);
    });
    fireEvent.click(nextDayButton);
    await waitFor(() => {
      expect(mocks.getAttendanceForDate).toHaveBeenCalledTimes(3);
    });

    await act(async () => {
      olderDate.resolve({ isClosed: true, attendance: [], excuses: [] });
      await olderDate.promise;
    });

    expect(
      screen.getByRole("status", { name: "Načítání docházky" }),
    ).toBeTruthy();
    expect(screen.queryByText("Habitat má zavřeno")).toBeNull();

    await act(async () => {
      selectedDate.resolve({ isClosed: false, attendance: [], excuses: [] });
      await selectedDate.promise;
    });

    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(
      screen.queryByRole("status", { name: "Načítání docházky" }),
    ).toBeNull();
  });

  it("shows a previously loaded day immediately and refreshes it in the background", async () => {
    const refreshedDate = createDeferred<{
      isClosed: boolean;
      attendance: Array<{ childId: string; presence: "ABSENT" }>;
      excuses: never[];
    }>();

    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Ada", lastName: "Lovelace", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate
      .mockResolvedValueOnce({
        isClosed: false,
        attendance: [],
        excuses: [],
      })
      .mockResolvedValueOnce({
        isClosed: false,
        attendance: [{ childId: "child-1", presence: "ABSENT" }],
        excuses: [],
      })
      .mockReturnValueOnce(refreshedDate.promise);

    render(<TeacherAttendancePage />);

    expect(
      await screen.findByText("Přítomna", { selector: "span" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Následující den" }));
    expect(
      await screen.findByText("Nepřítomna", { selector: "span" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Předchozí den" }));

    expect(
      screen.queryByRole("status", { name: "Načítání docházky" }),
    ).toBeNull();
    expect(screen.getByText("Přítomna", { selector: "span" })).toBeTruthy();
    await waitFor(() => {
      expect(mocks.getAttendanceForDate).toHaveBeenCalledTimes(3);
    });

    await act(async () => {
      refreshedDate.resolve({
        isClosed: false,
        attendance: [{ childId: "child-1", presence: "ABSENT" }],
        excuses: [],
      });
      await refreshedDate.promise;
    });

    expect(
      await screen.findByText("Nepřítomna", { selector: "span" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("status", { name: "Načítání docházky" }),
    ).toBeNull();
  });

  it("keeps the saved attendance in the cached day", async () => {
    const backgroundRefresh = createDeferred<{
      isClosed: boolean;
      attendance: never[];
      excuses: never[];
    }>();

    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Ada", lastName: "Lovelace", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate
      .mockResolvedValueOnce({
        isClosed: false,
        attendance: [],
        excuses: [],
      })
      .mockResolvedValueOnce({
        isClosed: false,
        attendance: [],
        excuses: [],
      })
      .mockReturnValueOnce(backgroundRefresh.promise);
    mocks.saveAttendance.mockResolvedValue({ success: true, recordCount: 1 });

    render(<TeacherAttendancePage />);

    const toggle = await screen.findByRole<HTMLInputElement>("checkbox");
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Potvrdit docházku" }));
    expect(await screen.findByText("Docházka uložena (1 záznamů)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Následující den" }));
    await waitFor(() => {
      expect(mocks.getAttendanceForDate).toHaveBeenCalledTimes(2);
    });
    fireEvent.click(screen.getByRole("button", { name: "Předchozí den" }));

    expect(
      screen.queryByRole("status", { name: "Načítání docházky" }),
    ).toBeNull();
    expect(screen.getByText("Nepřítomna", { selector: "span" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Uloženo" }).disabled).toBe(true);
  });

  it("toggles a child's attendance and gives haptic feedback when the card is tapped", async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Jana", lastName: "Nováková", gender: "FEMALE" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [{ childId: "child-1", presence: "PRESENT" }],
      excuses: [],
    });

    render(<TeacherAttendancePage />);

    const childName = await screen.findByText("Jana Nováková");
    const toggle = screen.getByRole("checkbox", {
      name: "Docházka: Jana Nováková",
    });
    expect(screen.getByText("Přítomna", { selector: "span" })).toBeTruthy();
    expect(toggle.hasAttribute("switch")).toBe(true);

    fireEvent.click(childName);

    await waitFor(() => {
      expect(
        screen.getByText("Nepřítomna", { selector: "span" }),
      ).toBeTruthy();
    });
    expect(vibrate).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith(10);
  });
});

it("shows the event name even when details are collapsed", async () => {
  mocks.getAllChildren.mockResolvedValue([]);
  mocks.getAttendanceForDate.mockResolvedValue({ isClosed: false, attendance: [], excuses: [], canManageLunch: true, noLunch: false, details: { name: "Výlet na Karlštejn", expense: 150, report: "Poznámky" } });
  render(<TeacherAttendancePage />);
  expect(await screen.findByText("Výlet na Karlštejn", { selector: "p" })).toBeTruthy();
  expect(screen.getByText("Podrobnosti", { selector: "summary" }).closest("details")!.open).toBe(false);
  expect(screen.getByRole("heading", { name: "Den" })).toBeTruthy();
  cleanup();
});
