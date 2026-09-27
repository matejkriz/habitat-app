import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "./layout";

const mocks = vi.hoisted(() => ({ getDbUser: vi.fn(), getParentChildren: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/app/actions/parent", () => ({ getParentChildren: mocks.getParentChildren }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: () => null }));

describe("AppLayout parent makeup navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ role: "PARENT" });
  });
  it("enables makeup for a parent with any reduced-schedule child", async () => {
    mocks.getParentChildren.mockResolvedValue([{ attendanceDays: [1, 2, 3, 4] }, { attendanceDays: [1, 3] }]);
    const layout = await AppLayout({ children: "Obsah" });
    expect(layout.props.canSubmitMakeup).toBe(true);
  });
  it("keeps makeup hidden for legacy children with default attendance", async () => {
    mocks.getParentChildren.mockResolvedValue([{}, { attendanceDays: [1, 2, 3, 4] }]);
    const layout = await AppLayout({ children: "Obsah" });
    expect(layout.props.canSubmitMakeup).toBe(false);
  });
});
