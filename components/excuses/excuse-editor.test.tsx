import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExcuseEditor } from "./excuse-editor";

describe("ExcuseEditor", () => {
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
    fireEvent.change(screen.getByLabelText("Dítě bude chybět"), {
      target: { value: "AFTERNOON" },
    });
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

    expect(screen.queryByLabelText("Dítě bude chybět")).toBeNull();
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
});
