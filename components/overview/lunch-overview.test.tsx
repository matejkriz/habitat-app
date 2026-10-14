import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LunchOverviewSection } from "./lunch-overview";
import { LunchOverviewView } from "./lunch-overview-view";
import type { LunchOverview } from "@/lib/lunch-overview";

const mocks = vi.hoisted(() => ({
  getLunchOverview: vi.fn(),
  updateLunchPrice: vi.fn(),
}));

vi.mock("@/app/actions/director", () => ({
  getLunchOverview: mocks.getLunchOverview,
  updateLunchPrice: mocks.updateLunchPrice,
}));

function lunchOverview(): LunchOverview {
  return {
    month: "2026-08",
    monthLabel: "srpen 2026",
    priceCents: 5500,
    days: [{ key: "2026-08-19", day: 19, weekday: "St" }],
    children: [
      {
        id: "tobias",
        firstName: "Tobiáš",
        lastName: "Tornádo",
        statuses: ["present"],
        payableLunches: 1,
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

describe("LunchOverviewSection", () => {
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
    expect(amountHeading.className).toContain("right-0");
    expect(amountCell?.className).toContain("right-0");
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
        { ...overview.children[0], statuses: ["present", "excused"], payableLunches: 1 },
        { id: "eva", firstName: "Eva", lastName: "Nová", statuses: ["kept", "late"], payableLunches: 2 },
        { id: "adam", firstName: "Adam", lastName: "Nový", statuses: [null, "makeup"], payableLunches: 1 },
        { id: "jan", firstName: "Jan", lastName: "Nový", statuses: ["not-scheduled", "makeup-no-lunch"], payableLunches: 0 },
      ],
    }} showDirectorControls />);
    const footer = screen.getByRole("rowheader", { name: "Součet" }).closest("tr")!;
    expect(within(footer).getAllByRole("cell").map(cell => cell.textContent?.replaceAll(/\s/g, " "))).toEqual(["2", "2", "4", "262 Kč"]);
    const eva = screen.getByRole("rowheader", { name: "Eva Nová" }).closest("tr")!;
    expect(within(eva).getByText(/131\s*Kč/)).toBeTruthy();
  });

  it("shows amounts to parents without a price editor or totals row", () => {
    render(<LunchOverviewView overview={lunchOverview()} basePath="/rodic" />);
    expect(screen.getByRole("columnheader", { name: "K úhradě" })).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText(/55\s*KČ/i)).toBeTruthy();
    expect(screen.queryByLabelText("Cena jednoho obědu (Kč)")).toBeNull();
    expect(screen.queryByRole("rowheader", { name: "Součet" })).toBeNull();
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
