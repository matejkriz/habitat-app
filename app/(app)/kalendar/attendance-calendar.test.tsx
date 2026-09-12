import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAttendanceCalendar,
  type CalendarExcuse,
} from "@/lib/attendance-calendar";

vi.mock("@/app/actions/day-details", () => ({ saveDayDetails: vi.fn() }));

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

function calendarExcuse(
  overrides: Pick<CalendarExcuse, "id" | "childId"> & Partial<CalendarExcuse>,
): CalendarExcuse {
  return {
    fromDate: new Date(2026, 7, 4),
    toDate: new Date(2026, 7, 4),
    reason: null,
    submittedAt: new Date(2026, 7, 1, 8),
    lateApprovedAt: null,
    ...overrides,
  };
}

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
          noLunchDays: [{ date: new Date(2026, 7, 4) }],
        }),
      }}
    />,
  );
}

function renderExcuseCalendar(
  excuses: ReadonlyArray<CalendarExcuse>,
  today = new Date(2026, 7, 3),
) {
  render(
    <AttendanceCalendar
      startMonthKey={null}
      initialMonth={{
        monthKey: "2026-08",
        totalChildren: children.length,
        days: buildAttendanceCalendar({
          month: new Date(2026, 7, 1),
          today,
          children,
          attendance: [],
          excuses,
          closedDays: [],
          noLunchDays: [],
        }),
      }}
    />,
  );
}

function renderPartialDayCalendar() {
  renderExcuseCalendar([
    calendarExcuse({
      id: "excuse-afternoon",
      childId: "bo",
      dayPart: "AFTERNOON",
      reason: "Lékař",
    }),
  ]);
}

function getTodayButton(): HTMLElement {
  return screen.getAllByRole("button", { name: /pondělí 3\. srpna 2026, 2 očekáváno/i })[0];
}

function getTomorrowButton(): HTMLElement {
  return screen.getAllByRole("button", { name: /úterý 4\. srpna 2026, 2 očekáváno/i })[0];
}

afterEach(() => cleanup());

describe("AttendanceCalendar planning count", () => {
  it("adds a period to the day number but not to the child count", () => {
    renderCalendar();

    const day = getTodayButton();

    expect(within(day).getByText("3.", { exact: true })).toBeTruthy();
    expect(within(day).getByText("2", { exact: true })).toBeTruthy();
    expect(within(day).queryByText("2.", { exact: true })).toBeNull();
  });

  it("shows one count when every excuse covers the whole day", () => {
    renderExcuseCalendar([
      calendarExcuse({
        id: "excuse-full-day",
        childId: "bo",
        dayPart: "FULL_DAY",
      }),
    ]);

    const day = screen.getAllByRole("button", {
      name: /úterý 4\. srpna 2026/i,
    })[0];

    expect(day.textContent).not.toMatch(/dop\.|odp\.|\//i);
    expect(within(day).getByText("1", { exact: true })).toBeTruthy();
    expect(day.getAttribute("aria-label")).toBe(
      "úterý 4. srpna 2026, 1 očekáváno",
    );
  });

  it("shows a compact morning/afternoon pair for a partial-day excuse", () => {
    renderPartialDayCalendar();

    const day = screen.getAllByRole("button", {
      name: /úterý 4\. srpna 2026/i,
    })[0];

    expect(day.textContent).toContain("2/1");
    expect(day.textContent).toContain("dop. / odp.");
    expect(day.textContent).not.toContain("Dop. 2");
    expect(day.textContent).not.toContain("Odp. 1");
    expect(day.textContent).not.toContain("očekáváno");
  });

  it("keeps the pair when opposite partial-day excuses have equal counts", () => {
    renderExcuseCalendar([
      calendarExcuse({
        id: "excuse-morning",
        childId: "ada",
        dayPart: "MORNING",
      }),
      calendarExcuse({
        id: "excuse-afternoon",
        childId: "bo",
        dayPart: "AFTERNOON",
      }),
    ]);

    const day = screen.getAllByRole("button", {
      name: /úterý 4\. srpna 2026/i,
    })[0];

    expect(day.textContent).toContain("1/1");
    expect(day.textContent).toContain("dop. / odp.");
    expect(day.getAttribute("aria-label")).toMatch(
      /dopoledne 1.*odpoledne 1/i,
    );
  });

  it("keeps one actual attendance count for a past partial-day excuse", () => {
    renderExcuseCalendar(
      [
        calendarExcuse({
          id: "excuse-afternoon",
          childId: "bo",
          dayPart: "AFTERNOON",
        }),
      ],
      new Date(2026, 7, 5),
    );

    const day = screen.getAllByRole("button", {
      name: /úterý 4\. srpna 2026/i,
    })[0];

    expect(day.textContent).not.toMatch(/dop\.|odp\.|\//i);
    expect(within(day).getByText("0", { exact: true })).toBeTruthy();
    expect(day.getAttribute("aria-label")).toBe(
      "úterý 4. srpna 2026, 0 přítomno",
    );
  });
});

describe("AttendanceCalendar day preview", () => {
  it("shows separate morning and afternoon planning counts", () => {
    renderPartialDayCalendar();

    const day = screen.getAllByRole("button", {
      name: /úterý 4\. srpna 2026.*dopoledne 2.*odpoledne 1/i,
    })[0];
    fireEvent.click(day);

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Dopoledne");
    expect(dialog.textContent).toContain("Odpoledne");
    expect(dialog.textContent).toContain("Jen odpoledne nepřijde");
    expect(dialog.textContent).toContain("Bo Svoboda");
  });

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

  it("marks a day without lunch with the crossed utensils icon", () => {
    renderCalendar();

    expect(getTomorrowButton().getAttribute("aria-label")).toContain("bez oběda");
    expect(getTomorrowButton().querySelector('[title="Bez oběda"]')).toBeTruthy();
  });

  it("does not show the hover preview for touch pointers", () => {
    renderCalendar();

    fireEvent.pointerEnter(getTodayButton(), { pointerType: "touch", clientX: 180, clientY: 220 });

    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows a late excuse that is waiting for approval", () => {
    render(
      <AttendanceCalendar
        startMonthKey={null}
        initialMonth={{
          monthKey: "2026-09",
          totalChildren: children.length,
          days: buildAttendanceCalendar({
            month: new Date(2026, 8, 1),
            today: new Date(2026, 8, 9, 20),
            children,
            attendance: [],
            excuses: [
              {
                id: "excuse-bo",
                childId: "bo",
                fromDate: new Date(2026, 8, 10),
                toDate: new Date(2026, 8, 10),
                reason: "Nemoc",
                submittedAt: new Date(2026, 8, 9, 20),
                lateApprovedAt: null,
              },
            ],
            closedDays: [],
            noLunchDays: [],
          }),
        }}
      />,
    );

    const day = screen.getAllByRole("button", {
      name: /čtvrtek 10\. září 2026/i,
    })[0];
    expect(day.textContent).toContain("1 omluveno pozdě");

    fireEvent.click(day);

    expect(screen.getByText("Pozdní omluvenky")).toBeTruthy();
    expect(screen.getByText("Bo Svoboda")).toBeTruthy();
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

 it("shows a truncated event name in the grid and its full text in the detail", () => {
  const name = "Jarmark a výlet na velmi vzdálený hrad s dlouhým názvem";
  const days = buildAttendanceCalendar({ month: new Date(2026, 7, 1), today: new Date(2026, 7, 3), children, attendance: [], excuses: [], closedDays: [], noLunchDays: [] });
  render(<AttendanceCalendar startMonthKey={null} initialMonth={{ monthKey: "2026-08", totalChildren: 2, days: days.map(day => ({ ...day, name: day.dateKey === "2026-08-04" ? name : null })) }} />);
  const event = screen.getAllByText(name).find(element => element.className.includes("truncate"));
  expect(event).toBeTruthy();
  fireEvent.click(event!.closest("button")!);
  expect(within(screen.getByRole("dialog")).getByText(name)).toBeTruthy();
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Otevřít den" })).toBeTruthy();
  expect(screen.queryByLabelText("Útrata na dítě (Kč)")).toBeNull();
});
