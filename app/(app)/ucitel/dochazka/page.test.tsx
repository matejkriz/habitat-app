import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAllChildren: vi.fn(),
  getAttendanceForDate: vi.fn(),
  saveAttendance: vi.fn(),
}));

vi.mock("@/app/actions/teacher", () => mocks);

import TeacherAttendancePage from "./page";

describe("TeacherAttendancePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows whether each excused child was excused on time", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Žofie", lastName: "Žížalka" },
      { id: "child-2", firstName: "Oskar", lastName: "Okurka" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [],
      excuses: [
        { childId: "child-1", isOnTime: true },
        { childId: "child-2", isOnTime: false },
      ],
    });

    render(<TeacherAttendancePage />);

    await waitFor(() => {
      expect(screen.getByText("Žofie Žížalka")).toBeTruthy();
    });
    expect(screen.getByText("Omluveno včas")).toBeTruthy();
    expect(screen.getByText("Omluveno pozdě")).toBeTruthy();
  });

  it("prefills excused children as absent unless attendance was already saved", async () => {
    mocks.getAllChildren.mockResolvedValue([
      { id: "child-1", firstName: "Žofie", lastName: "Žížalka" },
      { id: "child-2", firstName: "Oskar", lastName: "Okurka" },
      { id: "child-3", firstName: "Božena", lastName: "Bublina" },
    ]);
    mocks.getAttendanceForDate.mockResolvedValue({
      isClosed: false,
      attendance: [{ childId: "child-2", presence: "PRESENT" }],
      excuses: [
        { childId: "child-1", isOnTime: true },
        { childId: "child-2", isOnTime: false },
      ],
    });

    render(<TeacherAttendancePage />);

    await waitFor(() => {
      expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    });
    const toggles = screen.getAllByRole<HTMLInputElement>("checkbox");
    expect(toggles[0].checked).toBe(false);
    expect(toggles[1].checked).toBe(true);
    expect(toggles[2].checked).toBe(true);
  });
});
