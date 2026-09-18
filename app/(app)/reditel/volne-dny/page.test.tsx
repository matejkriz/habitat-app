import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Page from "./page";
const mocks = vi.hoisted(() => ({
  getClosedDays: vi.fn(),
  addClosedDay: vi.fn(),
  removeClosedDay: vi.fn(),
}));
vi.mock("@/app/actions/director", () => mocks);
beforeEach(() => {
  vi.resetAllMocks();
});
it("shows a load error and retries", async () => {
  mocks.getClosedDays
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce([]);
  render(<Page />);
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("načíst"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
it("keeps a day visible after failed deletion and allows retry", async () => {
  mocks.getClosedDays.mockResolvedValue([
    { id: "closed", date: new Date(2030, 0, 1), description: "Prázdniny" },
  ]);
  mocks.removeClosedDay
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(undefined);
  render(<Page />);
  fireEvent.click(await screen.findByRole("button", { name: "Smazat" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("smazat"),
  );
  expect(screen.getByText("Prázdniny")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Smazat" }));
  await waitFor(() => expect(screen.queryByText("Prázdniny")).toBeNull());
});
