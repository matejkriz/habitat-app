import { beforeEach, describe, expect, it, vi } from "vitest";
import AppLayout from "./layout";
import { AppShell } from "@/components/layout/app-shell";

const mocks = vi.hoisted(() => ({ getDbUser: vi.fn(), getParentChildren: vi.fn(), ToastProvider: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/app/actions/parent", () => ({ getParentChildren: mocks.getParentChildren }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: () => null }));
vi.mock("@/components/ui/toast-provider", () => ({ ToastProvider: mocks.ToastProvider }));

describe("AppLayout parent makeup navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ role: "PARENT" });
  });
  it("enables makeup for a parent with any reduced-schedule child", async () => {
    mocks.getParentChildren.mockResolvedValue([{ attendanceDays: [1, 2, 3, 4] }, { attendanceDays: [1, 3] }]);
    const layout = await AppLayout({ children: "Obsah" });
    expect(layout.props.children).toMatchObject({ props: { canSubmitMakeup: true } });
  });
  it("keeps makeup hidden for legacy children with default attendance", async () => {
    mocks.getParentChildren.mockResolvedValue([{}, { attendanceDays: [1, 2, 3, 4] }]);
    const layout = await AppLayout({ children: "Obsah" });
    expect(layout.props.children).toMatchObject({ props: { canSubmitMakeup: false } });
  });
  it("keeps the toast provider above the app shell so confirmations survive page navigation", async () => {
    mocks.getParentChildren.mockResolvedValue([]);
    const layout = await AppLayout({ children: "Obsah" });
    expect(layout.type).toBe(mocks.ToastProvider);
    expect(layout.props.children).toMatchObject({ type: AppShell, props: { children: "Obsah" } });
  });
});
