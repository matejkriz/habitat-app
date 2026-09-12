import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/actions/day-details", () => ({ getDayReport: mocks.get, saveDayReport: mocks.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
import { ReportDialog } from "./report-dialog";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(null);
  mocks.save.mockResolvedValue(undefined);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

it("prefills the day and existing text, saves the report and refreshes the overview", async () => {
  mocks.get.mockResolvedValue("Původní report");
  const close = vi.fn();
  render(<ReportDialog initialDate="2026-09-10" onClose={close} />);
  expect((screen.getByLabelText("Datum") as HTMLInputElement).value).toBe("2026-09-10");
  await waitFor(() => expect((screen.getByLabelText("Report") as HTMLTextAreaElement).value).toBe("Původní report"));
  fireEvent.change(screen.getByLabelText("Report"), { target: { value: "Doplněný report" } });
  fireEvent.click(screen.getByRole("button", { name: "Uložit report" }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(mocks.save).toHaveBeenCalledWith("2026-09-10", "Doplněný report");
  expect(mocks.refresh).toHaveBeenCalled();
});

it("keeps the entered report on a save error and allows retrying", async () => {
  mocks.save.mockRejectedValueOnce(new Error("Uložení selhalo"));
  render(<ReportDialog initialDate="2026-09-10" onClose={vi.fn()} />);
  await waitFor(() => expect((screen.getByLabelText("Report") as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("Report"), { target: { value: "Náš den" } });
  fireEvent.click(screen.getByRole("button", { name: "Uložit report" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect((screen.getByLabelText("Report") as HTMLTextAreaElement).value).toBe("Náš den");
  fireEvent.click(screen.getByRole("button", { name: "Uložit report" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
});

it("does not use a stale report when the selected date changes", async () => {
  let resolveFirst!: (value: string) => void;
  mocks.get.mockImplementationOnce(() => new Promise<string>(resolve => { resolveFirst = resolve; }))
    .mockResolvedValueOnce("Druhý den");
  render(<ReportDialog initialDate="2026-09-10" onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Datum"), { target: { value: "2026-09-11" } });
  await waitFor(() => expect((screen.getByLabelText("Report") as HTMLTextAreaElement).value).toBe("Druhý den"));
  await act(async () => resolveFirst("První den"));
  expect((screen.getByLabelText("Report") as HTMLTextAreaElement).value).toBe("Druhý den");
});
