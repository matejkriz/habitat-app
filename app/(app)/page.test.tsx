import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./rodic/page", () => ({
  default: () => <div>Dashboard rodiče</div>,
}));
vi.mock("./ucitel/dochazka/page", () => ({
  default: () => <div>Dashboard učitele</div>,
}));
vi.mock("./reditel/page", () => ({
  default: () => <div>Dashboard ředitele</div>,
}));

import HomePage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("role-aware home page", () => {
  it.each([
    ["PARENT", "Dashboard rodiče"],
    ["TEACHER", "Dashboard učitele"],
    ["DIRECTOR", "Dashboard ředitele"],
  ] as const)("renders %s directly without a dashboard redirect", async (role, label) => {
    mocks.getDbUser.mockResolvedValue({ id: "user-1", role });

    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(page);

    expect(screen.getByText(label)).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("still sends an unauthenticated visitor to login", async () => {
    mocks.getDbUser.mockResolvedValue(null);
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      HomePage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
