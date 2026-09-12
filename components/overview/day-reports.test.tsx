import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getDbUser: mocks.user }));
vi.mock("@/app/actions/day-details", () => ({
  getDayReports: async () => ({ reports: [], nextBefore: null }),
}));
import { DayReportsSection } from "./day-reports";
afterEach(cleanup);

it.each(["PARENT", "TEACHER", "DIRECTOR"])("shows reports with the correct controls for %s", async role => {
  mocks.user.mockResolvedValue({ role });
  render(await DayReportsSection());
  expect(screen.getByRole("heading", { name: "Reporty" })).toBeTruthy();
  const button = screen.queryByRole("button", { name: "Přidat report" });
  if (role === "PARENT") expect(button).toBeNull();
  else expect(button).toBeTruthy();
});
