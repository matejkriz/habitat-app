import { describe, expect, it, vi } from "vitest";
import LunchesPage from "./page";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

describe("former lunches page", () => {
  it("redirects saved links to the overview while preserving the month", async () => {
    await LunchesPage({ searchParams: Promise.resolve({ month: "2026-08" }) });
    expect(redirect).toHaveBeenCalledWith("/reditel?month=2026-08#obedy");
  });

  it("redirects an unfiltered link to the current overview", async () => {
    await LunchesPage({ searchParams: Promise.resolve({}) });
    expect(redirect).toHaveBeenCalledWith("/reditel#obedy");
  });
});
