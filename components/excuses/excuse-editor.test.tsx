import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExcuseEditor } from "./excuse-editor";

const getExcuseCalendarMonth = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/calendar", () => ({ getExcuseCalendarMonth }));

describe("ExcuseEditor", () => {
  beforeEach(() => getExcuseCalendarMonth.mockResolvedValue({ monthKey: "2026-09", closedDateKeys: [] }));
  it.each(["EXCUSE", "MAKEUP"] as const)("filters edited %s endpoints by the child's schedule", async (kind) => {
    render(<ExcuseEditor excuse={{ id: "record", kind, fromDate: "2026-09-09", toDate: "2026-09-09", dayPart: "FULL_DAY", reason: null, child: { attendanceDays: [1, 3] } }} onSave={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Upravit" }));
    fireEvent.click(screen.getByLabelText("Od"));
    expect(await screen.findByRole("button", { name: /středa 9\. září 2026/i })).toHaveProperty("disabled", kind === "MAKEUP");
    expect(screen.getByRole("button", { name: /úterý 8\. září 2026/i })).toHaveProperty("disabled", kind === "EXCUSE");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lets the user change the dates and reason", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ExcuseEditor
        excuse={{
          id: "excuse-1",
          fromDate: new Date(2024, 0, 2),
          toDate: new Date(2024, 0, 2),
          dayPart: "FULL_DAY",
          reason: "Nemoc",
        }}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upravit" }));
    fireEvent.change(screen.getByLabelText("Od"), { target: { value: "2024-01-04" } });
    fireEvent.change(screen.getByLabelText("Do"), { target: { value: "2024-01-04" } });
    fireEvent.click(screen.getByRole("radio", { name: "Odpoledne" }));
    fireEvent.change(screen.getByLabelText("Důvod"), { target: { value: "Rodinné důvody" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit změny" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("excuse-1", {
        fromDate: "2024-01-04",
        toDate: "2024-01-04",
        dayPart: "AFTERNOON",
        reason: "Rodinné důvody",
      });
    });
  });

  it("hides the day-part choice for a multi-day excuse", () => {
    render(
      <ExcuseEditor
        excuse={{
          id: "excuse-1",
          fromDate: new Date(2024, 0, 2),
          toDate: new Date(2024, 0, 3),
          dayPart: "FULL_DAY",
          reason: null,
        }}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upravit" }));

    expect(screen.queryByRole("group", { name: "Dítě bude chybět" })).toBeNull();
  });

  it("asks for confirmation before deleting", async () => {
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirm);
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <ExcuseEditor
        excuse={{
          id: "excuse-1",
          fromDate: new Date(2024, 0, 2),
          toDate: new Date(2024, 0, 3),
          dayPart: "FULL_DAY",
          reason: null,
        }}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Smazat" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("excuse-1"));
    expect(confirm).toHaveBeenCalledWith("Opravdu chcete tuto omluvenku smazat?");
  });
  it("names makeup when confirming deletion", async () => {
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirm);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ExcuseEditor excuse={{ id: "makeup", fromDate: "2026-09-10", toDate: "2026-09-10", kind: "MAKEUP", dayPart: "FULL_DAY", reason: null }} onDelete={onDelete} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Smazat" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("makeup"));
    expect(confirm).toHaveBeenCalledWith("Opravdu chcete tuto náhradu smazat?");
  });
});

it("prevents reopening an editor while deleting its excuse", async () => {
  vi.stubGlobal("confirm", vi.fn(() => true));
  const onDelete = vi.fn(() => new Promise<void>(() => {}));
  render(<ExcuseEditor excuse={{ id: "locked", fromDate: "2026-09-10", toDate: "2026-09-10", dayPart: "FULL_DAY", reason: null }} onDelete={onDelete} onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Smazat" }));
  expect((screen.getByRole("button", { name: "Upravit" }) as HTMLButtonElement).disabled).toBe(true);
});
