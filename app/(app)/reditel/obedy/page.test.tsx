import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LunchesPage from "./page";

const mocks = vi.hoisted(() => ({
  getLunchOverview: vi.fn(),
}));

vi.mock("@/app/actions/director", () => ({
  getLunchOverview: mocks.getLunchOverview,
}));

describe("LunchesPage", () => {
  it("lists children without lunches below the table instead of rendering a row", async () => {
    mocks.getLunchOverview.mockResolvedValue({
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
    });

    render(
      await LunchesPage({
        searchParams: Promise.resolve({ month: "2026-08" }),
      }),
    );

    expect(screen.getByRole("rowheader", { name: "Tobiáš Tornádo" })).toBeTruthy();
    expect(screen.queryByRole("rowheader", { name: "Anna Malá" })).toBeNull();
    expect(screen.getByText("Děti bez obědů:")).toBeTruthy();
    expect(screen.getByText("Anna Malá")).toBeTruthy();
  });
});
