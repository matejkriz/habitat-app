import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LunchOverviewSection } from "./lunch-overview";

const mocks = vi.hoisted(() => ({
  getLunchOverview: vi.fn(),
}));

vi.mock("@/app/actions/director", () => ({
  getLunchOverview: mocks.getLunchOverview,
}));

function lunchOverview() {
  return {
    month: "2026-08",
    monthLabel: "srpen 2026",
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

  it("only fixes the total column horizontally on mobile", async () => {
    await renderLunchesPage();

    const childHeading = screen.getByRole("columnheader", { name: "Dítě" });
    const childRow = screen.getByRole("rowheader", { name: "Tobiáš Tornádo" });
    const totalHeading = screen.getByRole("columnheader", { name: "Celkem" });
    const payableCell = screen.getByText("1").closest("td");

    expect(screen.queryByRole("columnheader", { name: "K úhradě" })).toBeNull();
    expect(childHeading.className).toContain("md:left-0");
    expect(childRow.className).toContain("md:sticky");
    expect(childRow.className).toContain("md:left-0");
    expect(totalHeading.className).toContain("right-0");
    expect(payableCell?.className).toContain("sticky");
    expect(payableCell?.className).toContain("right-0");
  });

  it("uses a narrower total column only on mobile", async () => {
    await renderLunchesPage();

    const totalHeading = screen.getByRole("columnheader", { name: "Celkem" });
    const totalBadge = screen.getByText("1");
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
});
