import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/rodic",
  useSearchParams: () => new URLSearchParams("child=child-1"),
}));

import { AttendanceCalendar } from "./attendance-calendar";

const days = [
  {
    date: "2026-08-24",
    dayNumber: 24,
    status: "EXPECTED" as const,
    isToday: false,
  },
  {
    date: "2026-08-26",
    dayNumber: 26,
    status: "PARTIAL" as const,
    absencePart: "AFTERNOON" as const,
    isToday: false,
  },
  {
    date: "2026-08-25",
    dayNumber: 25,
    status: "PENDING" as const,
    isToday: false,
  },
];

describe("AttendanceCalendar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens a prefilled excuse from a day click", () => {
    render(
      <AttendanceCalendar
        childId="child-1"
        childName="Žofie"
        childGender="FEMALE"
        month="2026-08"
        days={days}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /pondělí 24. srpna/i }));

    expect(mocks.push).toHaveBeenCalledWith(
      "/rodic/omluvenka?child=child-1&date=2026-08-24",
    );
  });

  it("uses a short vibration and opens the excuse after a long press", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });

    render(
      <AttendanceCalendar
        childId="child-1"
        childName="Žofie"
        childGender="FEMALE"
        month="2026-08"
        days={days}
      />,
    );

    const day = screen.getByRole("button", { name: /pondělí 24. srpna/i });
    fireEvent.pointerDown(day);
    vi.advanceTimersByTime(550);
    fireEvent.pointerUp(day);
    fireEvent.click(day);

    expect(vibrate).toHaveBeenCalledWith(12);
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });

  it("uses a feminine late-excuse label for a girl", () => {
    render(
      <AttendanceCalendar
        childId="child-1"
        childName="Žofie"
        childGender="FEMALE"
        month="2026-08"
        days={days}
      />,
    );

    expect(screen.getAllByText("Omluvena pozdě").length).toBeGreaterThan(0);
  });

  it("names the excused part of the day", () => {
    render(
      <AttendanceCalendar
        childId="child-1"
        childName="Žofie"
        childGender="FEMALE"
        month="2026-08"
        days={days}
      />,
    );

    expect(screen.getAllByText("Chybí odpoledne").length).toBeGreaterThan(0);
  });

  it("uses feminine attendance labels for a girl", () => {
    render(
      <AttendanceCalendar
        childId="child-1"
        childName="Žofie"
        childGender="FEMALE"
        month="2026-08"
        days={days}
      />,
    );

    expect(screen.getByText("Přišla")).toBeTruthy();
    expect(screen.getByText("Omluvena")).toBeTruthy();
  });

  it("uses masculine attendance labels for a boy", () => {
    render(
      <AttendanceCalendar
        childId="child-2"
        childName="Oskar"
        childGender="MALE"
        month="2026-08"
        days={days}
      />,
    );

    expect(screen.getByText("Přišel")).toBeTruthy();
    expect(screen.getByText("Omluven")).toBeTruthy();
    expect(screen.getAllByText("Omluven pozdě").length).toBeGreaterThan(0);
  });

  it("never shows slash labels when legacy data has no gender", () => {
    render(
      <AttendanceCalendar
        childId="legacy-child"
        childName="Dítě"
        childGender={null}
        month="2026-08"
        days={days}
      />,
    );

    expect(document.body.textContent).not.toContain("/");
  });

  it("labels closed days as Volno and visually de-emphasizes them", () => {
    render(
      <AttendanceCalendar
        childId="child-1"
        childName="Žofie"
        childGender="FEMALE"
        month="2026-08"
        days={[
          { date: "2026-08-18", dayNumber: 18, status: "MISSING", isToday: false },
          { date: "2026-08-30", dayNumber: 30, status: "CLOSED", isToday: false },
        ]}
      />,
    );

    const closedDay = screen.getByRole("button", { name: /neděle 30. srpna, volno/i });
    const missingDay = screen.getByRole("button", { name: /úterý 18. srpna, docházka nezapsána/i });

    expect(closedDay.className).toContain("bg-[#f3f3f1]");
    expect(closedDay.className).toContain("opacity-65");
    expect(missingDay.className).not.toContain("opacity-65");
  });

  it("does not show interaction instructions below the calendar", () => {
    render(
      <AttendanceCalendar
        childId="child-1"
        childName="Žofie"
        childGender="FEMALE"
        month="2026-08"
        days={days}
      />,
    );

    expect(document.body.textContent).not.toContain(
      "Klepněte na den pro rychlou omluvenku. Na mobilu můžete den také podržet.",
    );
  });
});
