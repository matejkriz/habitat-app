import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LunchesPage from "./page";

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
    await LunchesPage({
      searchParams: Promise.resolve({ month: "2026-08" }),
    }),
  );
}

describe("LunchesPage", () => {
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

  it("only fixes the payable column horizontally on mobile", async () => {
    await renderLunchesPage();

    const childHeading = screen.getByRole("columnheader", { name: "Dítě" });
    const childRow = screen.getByRole("rowheader", { name: "Tobiáš Tornádo" });
    const payableHeading = screen.getByRole("columnheader", { name: "K úhradě" });
    const payableCell = screen.getByText("1").closest("td");

    expect(childHeading.className).toContain("md:left-0");
    expect(childRow.className).toContain("md:sticky");
    expect(childRow.className).toContain("md:left-0");
    expect(payableHeading.className).toContain("right-0");
    expect(payableCell?.className).toContain("sticky");
    expect(payableCell?.className).toContain("right-0");
  });
});
