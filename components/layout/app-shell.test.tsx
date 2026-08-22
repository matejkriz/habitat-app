import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppShell } from "./app-shell";

const signOut = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/reditel",
}));

vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ signOut }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

const director = {
  name: "Jan Novák",
  email: "jan@example.com",
  image: null,
  role: "DIRECTOR" as const,
};

afterEach(() => {
  cleanup();
  signOut.mockClear();
});

describe("AppShell", () => {
  it("shows only primary director destinations in navigation", () => {
    const { container } = render(
      <AppShell user={director}>
        <div>Obsah</div>
      </AppShell>
    );

    const navHrefs = Array.from(container.querySelectorAll("nav a"), (link) =>
      link.getAttribute("href")
    );

    expect(new Set(navHrefs)).toEqual(
      new Set([
        "/reditel",
        "/ucitel/dochazka",
        "/kalendar",
        "/reditel/omluvenky",
      ])
    );
  });

  it("reveals sign out only after opening the user menu", () => {
    render(
      <AppShell user={director}>
        <div>Obsah</div>
      </AppShell>
    );

    expect(screen.queryAllByRole("button", { name: "Odhlásit" })).toHaveLength(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Otevřít uživatelské menu" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Odhlásit" }));

    expect(signOut).toHaveBeenCalledWith({ redirectUrl: "/login" });
  });
});
