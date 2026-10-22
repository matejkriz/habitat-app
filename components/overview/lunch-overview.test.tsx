import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LunchOverviewSection } from "./lunch-overview";
import { LunchOverviewView } from "./lunch-overview-view";
import { LunchPriceEditor } from "./lunch-price-editor";
import type { LunchOverview } from "@/lib/lunch-overview";

const mocks = vi.hoisted(() => ({
  getLunchOverview: vi.fn(),
  updateLunchPrice: vi.fn(),
  updateLunchPaid: vi.fn(),
}));

vi.mock("@/app/actions/director", () => ({
  getLunchOverview: mocks.getLunchOverview,
  updateLunchPrice: mocks.updateLunchPrice,
  updateLunchPaid: mocks.updateLunchPaid,
}));

function lunchOverview(): LunchOverview {
  return {
    month: "2026-08",
    monthLabel: "srpen 2026",
    lastOpenDay: "2026-08-31",
    priceCents: 5500,
    days: [{ key: "2026-08-19", day: 19, weekday: "St" }],
    children: [
      {
        id: "tobias",
        firstName: "Tobiáš",
        lastName: "Tornádo",
        statuses: ["present"],
        payableLunches: 1, paid: false,
      },
    ],
    childrenWithoutLunch: [
      {
        id: "anna",
        firstName: "Anna",
        lastName: "Malá",
      },
    ],
  };
}

async function renderLunchesPage() {
  mocks.getLunchOverview.mockResolvedValue(lunchOverview());

  render(
    await LunchOverviewSection({ month: "2026-08" }),
  );
}

beforeEach(() => {
  vi.setSystemTime(new Date("2026-10-22T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("LunchOverviewSection", () => {
  it("saves a child's paid status for the displayed month and disables it while saving", async () => {
    let finish!: () => void;
    mocks.updateLunchPaid.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    await renderLunchesPage();
    const checkbox = screen.getByRole("checkbox", { name: "Zaplaceno: Tobiáš Tornádo" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(mocks.updateLunchPaid).toHaveBeenCalledWith("tobias", "2026-08", true);
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(true);
    await act(async () => finish());
    await waitFor(() => expect(checkbox.disabled).toBe(false));
    expect(checkbox.checked).toBe(true);
    await act(async () => fireEvent.click(checkbox));
    expect(mocks.updateLunchPaid).toHaveBeenLastCalledWith("tobias", "2026-08", false);
  });

  it("keeps the previous paid state and allows retry after a failed save", async () => {
    mocks.updateLunchPaid.mockRejectedValueOnce(new Error("Failed"));
    await renderLunchesPage();
    const checkbox = screen.getByRole("checkbox", { name: "Zaplaceno: Tobiáš Tornádo" }) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Platbu se nepodařilo uložit.");
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(false);
  });

  it("keeps month navigation on the overview tab", async () => {
    await renderLunchesPage();
    expect(screen.getByRole("link", { name: "Předchozí měsíc" }).getAttribute("href")).toBe("/reditel?month=2026-07#obedy");
    expect(screen.getByRole("link", { name: "Následující měsíc" }).getAttribute("href")).toBe("/reditel?month=2026-09#obedy");
    expect(screen.getByRole("heading", { name: "Obědy", level: 2 })).toBeTruthy();
  });

  it("lists children without lunches below the table instead of rendering a row", async () => {
    await renderLunchesPage();

    expect(screen.getByRole("rowheader", { name: "Tobiáš Tornádo" })).toBeTruthy();
    expect(screen.queryByRole("rowheader", { name: "Anna Malá" })).toBeNull();
    expect(screen.getByText("Děti bez obědů:")).toBeTruthy();
    expect(screen.getByText("Anna Malá")).toBeTruthy();
  });

  it("keeps the table headings visible while the mobile table scrolls", async () => {
    await renderLunchesPage();

    const table = screen.getByRole("table");
    const dayHeading = screen.getByRole("columnheader", { name: "St 19." });

    expect(table.parentElement?.className).toContain("max-md:max-h-[calc(100dvh-8rem)]");
    expect(table.parentElement?.className).toContain("max-md:overflow-y-auto");
    expect(dayHeading.className).toContain("sticky");
    expect(dayHeading.className).toContain("top-0");
  });

  it("fixes the amount column horizontally without overlapping the count column", async () => {
    await renderLunchesPage();

    const childHeading = screen.getByRole("columnheader", { name: "Dítě" });
    const childRow = screen.getByRole("rowheader", { name: "Tobiáš Tornádo" });
    const totalHeading = screen.getByRole("columnheader", { name: "Celkem" });
    const childRowCells = within(childRow.closest("tr")!);
    const payableCell = childRowCells.getByText("1").closest("td");
    const amountHeading = screen.getByRole("columnheader", { name: "K úhradě" });
    const amountCell = childRowCells.getByText(/55\s*Kč/).closest("td");

    expect(childHeading.className).toContain("md:left-0");
    expect(childRow.className).toContain("md:sticky");
    expect(childRow.className).toContain("md:left-0");
    expect(totalHeading.className).not.toContain("right-0");
    expect(payableCell?.className).not.toContain("sticky");
    expect(amountHeading.className).toContain("right-[var(--lunch-paid-width)]");
    expect(amountCell?.className).toContain("right-[var(--lunch-paid-width)]");
    expect(screen.getByRole("columnheader", { name: "Zaplaceno" }).className).toContain("right-0");
  });

  it("uses a narrower total column only on mobile", async () => {
    await renderLunchesPage();

    const totalHeading = screen.getByRole("columnheader", { name: "Celkem" });
    const childRow = screen.getByRole("rowheader", { name: "Tobiáš Tornádo" }).closest("tr")!;
    const totalBadge = within(childRow).getByText("1");
    const totalCell = totalBadge.closest("td");

    expect(totalHeading.className).toContain("min-w-16");
    expect(totalHeading.className).toContain("px-1.5");
    expect(totalHeading.className).toContain("md:min-w-24");
    expect(totalHeading.className).toContain("md:px-3");
    expect(totalCell?.className).toContain("px-1.5");
    expect(totalCell?.className).toContain("md:px-3");
    expect(totalBadge.className).toContain("min-w-8");
    expect(totalBadge.className).toContain("md:min-w-10");
  });

  it("totals only payable lunches for each day, month, and amount", () => {
    const overview = lunchOverview();
    render(<LunchOverviewView overview={{ ...overview, priceCents: 6550,
      days: [overview.days[0], { key: "2026-08-20", day: 20, weekday: "Čt" }],
      children: [
        { ...overview.children[0], statuses: ["present", "excused"], payableLunches: 1, paid: false },
        { id: "eva", firstName: "Eva", lastName: "Nová", statuses: ["kept", "late"], payableLunches: 2, paid: false },
        { id: "adam", firstName: "Adam", lastName: "Nový", statuses: [null, "makeup"], payableLunches: 1, paid: false },
        { id: "jan", firstName: "Jan", lastName: "Nový", statuses: ["not-scheduled", "makeup-no-lunch"], payableLunches: 0, paid: false },
      ],
    }} showDirectorControls />);
    const footer = screen.getByRole("rowheader", { name: "Součet" }).closest("tr")!;
    expect(within(footer).getAllByRole("cell").map(cell => cell.textContent?.replaceAll(/\s/g, " "))).toEqual(["2", "2", "4", "262 Kč", ""]);
    const eva = screen.getByRole("rowheader", { name: "Eva Nová" }).closest("tr")!;
    expect(within(eva).getByText(/131\s*Kč/)).toBeTruthy();
  });

  it("shows amounts to a parent with one child without a price editor or totals row", () => {
    render(<LunchOverviewView overview={{ ...lunchOverview(), childrenWithoutLunch: [] }} basePath="/rodic" />);
    expect(screen.getByRole("columnheader", { name: "K úhradě" })).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText(/55\s*KČ/i)).toBeTruthy();
    expect(screen.queryByLabelText("Cena jednoho obědu (Kč)")).toBeNull();
    expect(screen.queryByRole("rowheader", { name: "Součet" })).toBeNull();
  });

  it("shows inferred parent statuses and includes assumed presence in billing totals", () => {
    const overview = lunchOverview();
    render(<LunchOverviewView overview={{
      ...overview,
      days: [overview.days[0], { key: "2026-08-20", day: 20, weekday: "Čt" }, { key: "2026-08-24", day: 24, weekday: "Po" }],
      children: [
        { ...overview.children[0], statuses: ["excused", "late", "present"], payableLunches: 2 },
        { id: "eva", firstName: "Eva", lastName: "Malá", statuses: ["present", "kept", "present"], payableLunches: 3, paid: false },
      ],
    }} basePath="/rodic" />);

    const child = within(screen.getByRole("rowheader", { name: "Tobiáš Tornádo" }).closest("tr")!);
    expect(child.getByRole("img", { name: "19.: Včas omluven/a" })).toBeTruthy();
    expect(child.getByRole("img", { name: "20.: Pozdě omluven/a" })).toBeTruthy();
    expect(child.getByRole("img", { name: "24.: Přišel/a" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Docházka nezapsána/ })).toBeNull();
    const footer = within(screen.getByRole("rowheader", { name: "Součet" }).closest("tr")!);
    expect(footer.getAllByRole("cell").map(cell => cell.textContent?.replaceAll(/\s/g, " "))).toEqual(["1", "2", "2", "5", "275 Kč"]);
  });

  it.each([
    { gender: "MALE" as const, labels: ["Přišel", "Včas omluven", "Omluven, oběd neodhlášen", "Pozdě omluven", "Neomluven"] },
    { gender: "FEMALE" as const, labels: ["Přišla", "Včas omluvena", "Omluvena, oběd neodhlášen", "Pozdě omluvena", "Neomluvena"] },
  ])("uses the child's $gender gender for lunch status labels", ({ gender, labels }) => {
    const overview = lunchOverview();
    render(<LunchOverviewView overview={{
      ...overview,
      days: [19, 20, 24, 25, 26].map(day => ({ key: `2026-08-${day}`, day, weekday: "" })),
      children: [{ ...overview.children[0], gender, statuses: ["present", "excused", "kept", "late", "unexcused"], payableLunches: 4 }],
    }} basePath="/rodic" />);

    const child = within(screen.getByRole("rowheader", { name: "Tobiáš Tornádo" }).closest("tr")!);
    expect(child.getAllByRole("img").map(cell => cell.title)).toEqual(labels);
    expect(child.getAllByRole("img").map(cell => cell.getAttribute("aria-label"))).toEqual(
      [19, 20, 24, 25, 26].map((day, index) => `${day}.: ${labels[index]}`),
    );
  });

  it("uses future arrival labels and lighter green for planned attendance", () => {
    const overview = lunchOverview();
    render(<LunchOverviewView overview={{
      ...overview,
      month: "2026-11",
      monthLabel: "listopad 2026",
      days: [2, 3, 4, 5, 9, 10].map(day => ({ key: `2026-11-${String(day).padStart(2, "0")}`, day, weekday: "" })),
      children: [{ ...overview.children[0], gender: "FEMALE", statuses: ["present", "excused", "kept", "late", "unexcused", "makeup"], payableLunches: 5 }],
    }} basePath="/rodic" />);

    const child = within(screen.getByRole("rowheader", { name: "Tobiáš Tornádo" }).closest("tr")!);
    const plannedArrival = child.getByRole("img", { name: "2.: Přijde" });
    const plannedMakeup = child.getByRole("img", { name: "10.: Náhrada, oběd přihlášen" });
    expect(plannedArrival.className).toContain("bg-[#b9d0ae]");
    expect(plannedMakeup.className).toContain("bg-[#b9d0ae]");
    expect(child.getByRole("img", { name: "9.: Nepřijde, neomluvena" })).toBeTruthy();
    expect(child.getByRole("img", { name: "3.: Včas omluvena" })).toBeTruthy();
    expect(child.getByRole("img", { name: "4.: Omluvena, oběd neodhlášen" })).toBeTruthy();
    expect(child.getByRole("img", { name: "5.: Pozdě omluvena" })).toBeTruthy();
  });

  it("marks today's complete column using Prague's date across UTC midnight", () => {
    vi.stubEnv("TZ", "UTC");
    vi.setSystemTime(new Date("2026-10-21T22:30:00Z"));
    const overview = lunchOverview();
    render(<LunchOverviewView overview={{
      ...overview,
      month: "2026-10",
      monthLabel: "říjen 2026",
      days: [21, 22, 26].map(day => ({ key: `2026-10-${day}`, day, weekday: "" })),
      children: [{ ...overview.children[0], gender: "FEMALE", statuses: ["present", "present", "present"], payableLunches: 3 }],
    }} showDirectorControls />);

    const table = screen.getByRole("table");
    const todayHeading = table.querySelector('th[aria-current="date"]')!;
    expect(todayHeading).not.toBeNull();
    expect(within(todayHeading as HTMLElement).getByText("22.").className).toContain("bg-gold");
    expect(within(todayHeading as HTMLElement).getByText("Dnes")).toBeTruthy();
    const childRow = within(screen.getByRole("rowheader", { name: "Tobiáš Tornádo" }).closest("tr")!);
    const todayCell = childRow.getByRole("img", { name: "22.: Přišla" }).closest("td")!;
    expect(childRow.getByRole("img", { name: "21.: Přišla" }).className).toContain("bg-[#7fa173]");
    expect(childRow.getByRole("img", { name: "26.: Přijde" })).toBeTruthy();
    const totalRow = within(screen.getByRole("rowheader", { name: "Součet" }).closest("tr")!);
    for (const cell of [todayHeading, todayCell, totalRow.getAllByRole("cell")[1]]) {
      expect(cell.className).toContain("border-l-2");
      expect(cell.className).toContain("border-l-gold");
      expect(cell.className).toContain("border-r-2");
      expect(cell.className).toContain("border-r-gold");
    }
  });

  it.each([
    { now: "2026-10-23T10:00:00Z", days: [22, 26], markedDay: 26, edge: "l", label: "Dnes před tímto dnem" },
    { now: "2026-10-31T10:00:00Z", days: [28, 29], markedDay: 29, edge: "r", label: "Dnes po tomto dni" },
  ])("marks an omitted today at the $edge boundary of day $markedDay", ({ now, days, markedDay, edge, label }) => {
    vi.setSystemTime(new Date(now));
    const overview = lunchOverview();
    render(<LunchOverviewView overview={{
      ...overview,
      month: "2026-10",
      monthLabel: "říjen 2026",
      days: days.map(day => ({ key: `2026-10-${day}`, day, weekday: "" })),
      children: [{ ...overview.children[0], statuses: ["present", "present"], payableLunches: 2 }],
    }} showDirectorControls />);

    const marker = screen.getByText(label);
    const heading = marker.closest("th")!;
    expect(within(heading).getByText(`${markedDay}.`)).toBeTruthy();
    expect(screen.getByRole("table").querySelector('[aria-current="date"]')).toBeNull();
    const index = days.indexOf(markedDay);
    const childRow = within(screen.getByRole("rowheader", { name: "Tobiáš Tornádo" }).closest("tr")!);
    const totalRow = within(screen.getByRole("rowheader", { name: "Součet" }).closest("tr")!);
    for (const cell of [heading, childRow.getAllByRole("cell")[index], totalRow.getAllByRole("cell")[index]]) {
      expect(cell.className).toContain(`border-${edge}-2`);
      expect(cell.className).toContain(`border-${edge}-gold`);
      expect(cell.className).not.toContain(`border-${edge === "l" ? "r" : "l"}-gold`);
    }
  });

  it.each(["2026-08", "2026-11"])("does not mark today in another displayed month (%s)", month => {
    const overview = lunchOverview();
    render(<LunchOverviewView overview={{
      ...overview,
      month,
      days: [{ key: `${month}-22`, day: 22, weekday: "" }],
    }} showDirectorControls />);

    const table = screen.getByRole("table");
    expect(table.querySelector('[aria-current="date"]')).toBeNull();
    expect(within(table).queryByText(/Dnes/)).toBeNull();
    for (const cell of table.querySelectorAll("th, td")) {
      expect(cell.className).not.toMatch(/border-[lr]-gold/);
    }
  });

  it("keeps the director total visible even with only one child", () => {
    render(<LunchOverviewView overview={{ ...lunchOverview(), childrenWithoutLunch: [] }} showDirectorControls />);
    expect(screen.getByRole("rowheader", { name: "Součet" })).toBeTruthy();
  });

  it("saves the selected month's price with pending and success feedback", async () => {
    let finish!: () => void;
    mocks.updateLunchPrice.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    await renderLunchesPage();
    const input = screen.getByLabelText("Cena jednoho obědu (Kč)") as HTMLInputElement;
    expect(input.value).toBe("55");
    fireEvent.change(input, { target: { value: "65,50" } });
    fireEvent.submit(input.closest("form")!);
    expect(mocks.updateLunchPrice).toHaveBeenCalledWith("2026-08", "65,50");
    expect((screen.getByRole("button", { name: "Uložit cenu" }) as HTMLButtonElement).disabled).toBe(true);
    finish();
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Cena byla uložena.");
  });

  it("hides save for an unchanged price, including equivalent formatting and a reverted edit", () => {
    mocks.updateLunchPrice.mockClear();
    render(<LunchPriceEditor month="2026-08" priceCents={5500} />);
    const input = screen.getByLabelText("Cena jednoho obědu (Kč)");
    expect(screen.queryByRole("button", { name: "Uložit cenu" })).toBeNull();
    fireEvent.change(input, { target: { value: "55,00" } });
    expect(screen.queryByRole("button", { name: "Uložit cenu" })).toBeNull();
    fireEvent.change(input, { target: { value: "60" } });
    expect(screen.getByRole("button", { name: "Uložit cenu" })).toBeTruthy();
    fireEvent.change(input, { target: { value: "55" } });
    expect(screen.queryByRole("button", { name: "Uložit cenu" })).toBeNull();
    fireEvent.submit(input.closest("form")!);
    expect(mocks.updateLunchPrice).not.toHaveBeenCalled();
  });

  it("keeps save visible while pending, then hides it when the updated saved price arrives", async () => {
    let finish!: () => void;
    mocks.updateLunchPrice.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
    const { rerender } = render(<LunchPriceEditor month="2026-08" priceCents={5500} />);
    const input = screen.getByLabelText("Cena jednoho obědu (Kč)");
    fireEvent.change(input, { target: { value: "65,50" } });
    fireEvent.submit(input.closest("form")!);
    rerender(<LunchPriceEditor month="2026-08" priceCents={6550} />);
    expect(screen.getByRole("button", { name: "Uložit cenu" })).toHaveProperty("disabled", true);
    await act(async () => finish());
    expect(screen.queryByRole("button", { name: "Uložit cenu" })).toBeNull();
    fireEvent.change(input, { target: { value: "65.5" } });
    expect(screen.queryByRole("button", { name: "Uložit cenu" })).toBeNull();
  });

  it("shows a save error and keeps the entered price available for retry", async () => {
    mocks.updateLunchPrice.mockRejectedValueOnce(new Error("Cenu se nepodařilo uložit."));
    await renderLunchesPage();
    const input = screen.getByLabelText("Cena jednoho obědu (Kč)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "60" } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Cenu se nepodařilo uložit.");
    expect(input.value).toBe("60");
    expect((screen.getByRole("button", { name: "Uložit cenu" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
