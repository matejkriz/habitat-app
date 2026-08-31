import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getDbUser: vi.fn() }));

import { AttendanceHistoryRow } from "./attendance-history-row";
import { NewExcuseLink } from "./new-excuse-link";

describe("parent dashboard layout", () => {
  it("hides the new excuse shortcut on narrow screens", () => {
    render(<NewExcuseLink childId="child-1" />);

    const link = screen.getByRole("link", { name: "Nová omluvenka" });
    expect(link.className).toContain("hidden");
    expect(link.className).toContain("sm:inline-flex");
  });

  it("stacks attendance statuses below the date on narrow screens", () => {
    const { container } = render(
      <AttendanceHistoryRow
        childGender="FEMALE"
        record={{
          id: "attendance-1",
          date: new Date("2026-08-19T12:00:00.000Z"),
          presence: "ABSENT",
          excuseStatus: "UNEXCUSED",
          excuse: null,
        }}
      />,
    );

    expect(container.firstElementChild?.className).toContain(
      "grid-cols-[auto_minmax(0,1fr)]",
    );
    expect(screen.getByText("Nepřítomna")).toBeTruthy();
    expect(screen.getByText("Neomluveno").parentElement?.className).toContain(
      "flex-wrap",
    );
    expect(screen.getByText("Neomluveno").parentElement?.className).toContain(
      "col-span-2",
    );
  });
});
