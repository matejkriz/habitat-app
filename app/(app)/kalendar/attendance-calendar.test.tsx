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

function renderCalendar() {
  render(
    <AttendanceCalendar
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
              excuseStatus: "NONE",
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
