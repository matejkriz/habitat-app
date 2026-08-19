import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import * as ParentPage from "./page";

describe("parent dashboard layout", () => {
  it("stacks attendance statuses below the date on narrow screens", () => {
    const AttendanceHistoryRow = (
      ParentPage as unknown as Record<string, React.ComponentType<{
        record: {
          id: string;
          date: Date;
          presence: "PRESENT" | "ABSENT";
          excuseStatus: "NONE" | "EXCUSED" | "UNEXCUSED";
          excuse: null;
        };
      }>>
    ).AttendanceHistoryRow;

    expect(AttendanceHistoryRow).toBeTypeOf("function");
    if (!AttendanceHistoryRow) return;

    const { container } = render(
      <AttendanceHistoryRow
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
    expect(screen.getByText("Neomluveno").parentElement?.className).toContain(
      "flex-wrap",
    );
    expect(screen.getByText("Neomluveno").parentElement?.className).toContain(
      "col-span-2",
    );
  });
});
