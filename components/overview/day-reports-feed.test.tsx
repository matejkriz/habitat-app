import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDayReports: vi.fn() }));
vi.mock("@/app/actions/day-details", () => ({ getDayReports: mocks.getDayReports }));
import { DayReportsFeed } from "./day-reports-feed";

let intersect: IntersectionObserverCallback;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {}
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const initialPage = {
  reports: [{ date: new Date(2026, 8, 10).getTime(), name: "Jarmark", report: "První odstavec\nDruhý odstavec" }],
  nextBefore: new Date(2026, 8, 10).getTime(),
};

it("loads older days while scrolling and retains the full report text", async () => {
  mocks.getDayReports.mockResolvedValue({
    reports: [{ date: new Date(2026, 8, 9).getTime(), name: null, report: "Starší report" }],
    nextBefore: null,
  });
  render(<DayReportsFeed initialPage={initialPage} />);
  expect(screen.getByText("Jarmark")).toBeTruthy();
  expect(screen.getByText(/První odstavec/).textContent).toBe(initialPage.reports[0].report);
  await act(async () => intersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver));
  expect(await screen.findByText("Starší report")).toBeTruthy();
  expect(mocks.getDayReports).toHaveBeenCalledWith(initialPage.nextBefore);
  expect(screen.queryByRole("button", { name: "Načíst starší reporty" })).toBeNull();
});

it("keeps existing reports on failure and allows retrying", async () => {
  mocks.getDayReports.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ reports: [], nextBefore: null });
  render(<DayReportsFeed initialPage={initialPage} />);
  fireEvent.click(screen.getByRole("button", { name: "Načíst starší reporty" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("Jarmark")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(mocks.getDayReports).toHaveBeenCalledTimes(2);
});

it("shows an empty state when there are no reports", () => {
  render(<DayReportsFeed initialPage={{ reports: [], nextBefore: null }} />);
  expect(screen.getByText("Zatím nejsou k dispozici žádné reporty.")).toBeTruthy();
});
