import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAttendanceCalendar } from "@/lib/attendance-calendar";

vi.mock("@/app/actions/calendar", () => ({
  getAttendanceCalendarMonth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { AttendanceCalendar } from "./attendance-calendar";

const children = [
  { id: "ada", firstName: "Ada", lastName: "Nováková" },
  { id: "bo", firstName: "Bo", lastName: "Svoboda" },
];

function renderCalendar(startMonthKey: string | null = null) {
  render(
    <AttendanceCalendar
      startMonthKey={startMonthKey}
      initialMonth={{
        monthKey: "2026-08",
        totalChildren: children.length,
        days: buildAttendanceCalendar({
          month: new Date(2026, 7, 1),
          today: new Date(2026, 7, 3),
          children,
          attendance: [
            {
              childId: "ada",
              date: new Date(2026, 7, 3),
              presence: "PRESENT",
            },
          ],
          excuses: [],
          closedDays: [],
        }),
      }}
    />,
  );
}

function getTodayButton(): HTMLElement {
  return screen.getAllByRole("button", { name: /pondělí 3\. srpna 2026, 2 očekáváno/i })[0];
}

function getTomorrowButton(): HTMLElement {
  return screen.getAllByRole("button", { name: /úterý 4\. srpna 2026, 2 očekáváno/i })[0];
}

afterEach(() => cleanup());

describe("AttendanceCalendar day preview", () => {
  it("shows a lightweight preview on mouse hover and hides it on leave", () => {
    renderCalendar();
    const day = getTodayButton();

    fireEvent.pointerEnter(day, { pointerType: "mouse", clientX: 180, clientY: 220 });

    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.pointerLeave(day);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("updates the preview immediately when the pointer moves to another day", () => {
    renderCalendar();

    fireEvent.pointerEnter(getTodayButton(), { pointerType: "mouse", clientX: 180, clientY: 220 });
    expect(screen.getByRole("tooltip").textContent).toContain("pondělí 3. srpna 2026");

    fireEvent.pointerLeave(getTodayButton());
    fireEvent.pointerEnter(getTomorrowButton(), { pointerType: "mouse", clientX: 300, clientY: 220 });

    expect(screen.getByRole("tooltip").textContent).toContain("úterý 4. srpna 2026");
  });

  it("opens the full modal on click", () => {
    renderCalendar();

    fireEvent.click(getTodayButton());

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not show the hover preview for touch pointers", () => {
    renderCalendar();

    fireEvent.pointerEnter(getTodayButton(), { pointerType: "touch", clientX: 180, clientY: 220 });

    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

describe("AttendanceCalendar supporting copy", () => {
  it("keeps the calendar header free of explanatory copy and status legend", () => {
    renderCalendar();

    const title = screen.getByRole("heading", { name: "Kalendář docházky" });
    const header = title.closest("header");

    expect(header).not.toBeNull();
    expect(header?.textContent).not.toContain(
      "Rychlý přehled očekávané účasti pro plánování programu a obědů.",
    );
    expect(header?.textContent).not.toContain("chybí zápis");
    expect(header?.textContent).not.toContain("očekáváme");
    expect(header?.querySelector(".bg-sage")).toBeNull();
    expect(header?.querySelector(".bg-coral")).toBeNull();
  });

  it("does not show interaction instructions below the calendar", () => {
    renderCalendar();

    expect(document.body.textContent).not.toContain(
      "Na počítači přejeďte přes den pro rychlý náhled, kliknutím otevřete detail.",
    );
  });
});

describe("AttendanceCalendar month limit", () => {
  it("hides previous-month navigation in the configured first month", () => {
    renderCalendar("2026-08");

    expect(screen.queryByRole("button", { name: "Předchozí měsíc" })).toBeNull();
    expect(screen.getByRole("button", { name: "Další měsíc" })).toBeTruthy();
  });

  it("shows previous-month navigation after the configured first month", () => {
    renderCalendar("2026-07");

    expect(screen.getByRole("button", { name: "Předchozí měsíc" })).toBeTruthy();
  });
});
