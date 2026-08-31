import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditQuickAction } from "./audit-quick-action";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe("Director dashboard", () => {
  it("offers Audit alongside the other available pages", () => {
    render(<AuditQuickAction />);

    expect(
      screen.getByRole("link", { name: /Audit log/i }).getAttribute("href")
    ).toBe("/reditel/audit");
  });
});
