import { fireEvent, render, screen, within } from "@testing-library/react";
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
    name: "Výlet do lesa",
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
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers a makeup from a regular day off", () => {
    render(<AttendanceCalendar childId="child-1" childName="Žofie" childGender="FEMALE" month="2026-08" days={[{ date: "2026-08-25", dayNumber: 25, status: "NOT_SCHEDULED", isToday: false }]} />);
    fireEvent.click(screen.getByRole("button", { name: /Nechodí, zadat náhradu/ }));
    expect(mocks.push).toHaveBeenCalledWith("/rodic/omluvenka?child=child-1&date=2026-08-25&kind=MAKEUP");
  });

  it("does not add meal controls or placeholders to days without a meal", () => {
    render(<AttendanceCalendar childId="child-1" childName="Žofie" childGender="FEMALE" month="2026-08" days={[
      { ...days[0], meal: null },
      { ...days[1], meal: "  \n " },
    ]} />);

    expect(screen.queryByRole("button", { name: /^Jídlo/ })).toBeNull();
    expect(screen.queryByLabelText("Jídlo")).toBeNull();
    expect(document.body.textContent).not.toContain("Neobjednáno");
  });

  it("opens the full meal separately and preserves the day excuse shortcut", () => {
    const meal = `Zeleninová polévka\n${"Dušená zelenina s bramborami a bylinkami. ".repeat(12)}`;
    render(<AttendanceCalendar childId="child-1" childName="Žofie" childGender="FEMALE" month="2026-08" days={[
      { ...days[0], meal },
    ]} />);

    const mealButton = screen.getByRole("button", { name: /^Jídlo · pondělí 24. srpna$/i });
    expect(mealButton.parentElement?.closest("button")).toBeNull();
    mealButton.focus();
    fireEvent.click(mealButton);

    const dialog = screen.getByRole("dialog", { name: /pondělí 24. srpna/i });
    expect(within(dialog).getByText("Výlet do lesa")).toBeTruthy();
    expect(within(dialog).getByLabelText("Jídlo").textContent).toContain(meal.trim());
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Zavřít" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(mealButton);
    fireEvent.click(screen.getByRole("button", { name: /pondělí 24. srpna.*zadat omluvenku/i }));
    expect(mocks.push).toHaveBeenCalledWith("/rodic/omluvenka?child=child-1&date=2026-08-24");
  });

  it("keeps meal details available on closed days without enabling an excuse", () => {
    render(<AttendanceCalendar childId="child-1" childName="Žofie" childGender="FEMALE" month="2026-08" days={[
      { date: "2026-08-30", dayNumber: 30, status: "CLOSED", isToday: false, meal: "Zeleninové rizoto" },
    ]} />);

    const day = screen.getByRole("button", { name: /neděle 30. srpna, volno/i });
    expect((day as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /^Jídlo ·/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Zeleninové rizoto")).toBeTruthy();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("adds a period to the day number", () => {
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

    expect(day.textContent).toContain("24.");
    expect(day.textContent).toContain("Výlet do lesa");
    expect(day.getAttribute("aria-label")).toContain("Výlet do lesa");
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

it("shows pre-start days without offering an excuse or makeup", () => {
  vi.useFakeTimers();
  mocks.push.mockReset();
  render(<AttendanceCalendar childId="child" childName="Nové dítě" childGender={null} month="2026-09" days={[
    { date: "2026-09-14", dayNumber: 14, status: "BEFORE_START", isToday: false },
  ]} />);
  const day = screen.getByRole("button", { name: /pondělí 14. září, Před nástupem/i });
  expect((day as HTMLButtonElement).disabled).toBe(true);
  expect(day.getAttribute("aria-label")).not.toContain("zadat");
  fireEvent.pointerDown(day);
  vi.advanceTimersByTime(550);
  fireEvent.pointerUp(day);
  expect(mocks.push).not.toHaveBeenCalled();
  vi.useRealTimers();
});
