import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAllChildren: vi.fn(),
  getAttendanceForDate: vi.fn(),
  saveAttendance: vi.fn(),
}));

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

  it("shows whether each excused child was excused on time", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Žofie", lastName: "Žížalka" },
      { id: "child-2", firstName: "Oskar", lastName: "Okurka" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [
        { childId: "child-1", isOnTime: true },
        { childId: "child-2", isOnTime: false },
      ],
    });

    render(<TeacherAttendancePage />);

    await waitFor(() => {
      expect(screen.getByText("Žofie Žížalka")).toBeTruthy();
    });
    expect(screen.getByText("Omluveno včas")).toBeTruthy();
    expect(screen.getByText("Omluveno pozdě")).toBeTruthy();
  });

  it("prefills excused children as absent unless attendance was already saved", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Žofie", lastName: "Žížalka" },
      { id: "child-2", firstName: "Oskar", lastName: "Okurka" },
      { id: "child-3", firstName: "Božena", lastName: "Bublina" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [{ childId: "child-2", presence: "PRESENT" }],
      excuses: [
        { childId: "child-1", isOnTime: true },
        { childId: "child-2", isOnTime: false },
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
      { id: "child-1", firstName: "Ada", lastName: "Lovelace" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [],
    });

    render(<TeacherAttendancePage />);

    expect(await screen.findByRole("checkbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Uložit docházku" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Následující den" }));

    expect(await screen.findByText("Budoucí datum")).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Všichni přítomni" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Uložit docházku" })).toBeNull();
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
      { id: "child-1", firstName: "Ada", lastName: "Lovelace" },
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
      { id: "child-1", firstName: "Ada", lastName: "Lovelace" },
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

    expect(await screen.findByText("Přítomen/a")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Následující den" }));
    expect(await screen.findByText("Nepřítomen/a")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Předchozí den" }));

    expect(
      screen.queryByRole("status", { name: "Načítání docházky" }),
    ).toBeNull();
    expect(screen.getByText("Přítomen/a")).toBeTruthy();
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

    expect(await screen.findByText("Nepřítomen/a")).toBeTruthy();
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
      { id: "child-1", firstName: "Ada", lastName: "Lovelace" },
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

    fireEvent.click(screen.getByRole("button", { name: "Uložit docházku" }));
    expect(await screen.findByText("Docházka uložena (1 záznamů)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Následující den" }));
    await waitFor(() => {
      expect(mocks.getAttendanceForDate).toHaveBeenCalledTimes(2);
    });
    fireEvent.click(screen.getByRole("button", { name: "Předchozí den" }));

    expect(
      screen.queryByRole("status", { name: "Načítání docházky" }),
    ).toBeNull();
    expect(screen.getByText("Nepřítomen/a")).toBeTruthy();
  });
});
