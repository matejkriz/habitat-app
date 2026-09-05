import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppShell } from "./app-shell";

const signOut = vi.fn();
const navigation = vi.hoisted(() => ({ pathname: "/reditel" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("@/lib/workos-client", () => ({
  useAuth: () => ({ signOut }),
}));

vi.mock("@/app/actions/push-notifications", () => ({
  registerDirectorPushSubscription: vi.fn(),
  unregisterDirectorPushSubscription: vi.fn(),
}));

vi.mock("@/app/actions/dev-persona", () => ({
  switchDevPersona: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}));

interface MockLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  onNavigate?: () => void;
  prefetch?: boolean;
}

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, onNavigate, prefetch, ...props }: MockLinkProps) => (
    <a
      href={href}
      data-prefetch={prefetch ? "true" : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onNavigate?.();
      }}
      {...props}
    >
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
  navigation.pathname = "/reditel";
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
        "/reditel/obedy",
        "/reditel/omluvenky",
      ])
    );
  });

  it("shows the complete mobile navigation label for excuses", () => {
    render(
      <AppShell user={director}>
        <div>Obsah</div>
      </AppShell>
    );

    const excusesLabel = screen.getByText("Omluvenky", { selector: "span" });
    const excusesLink = excusesLabel.closest("a");

    expect(excusesLabel.className).toContain("whitespace-nowrap");
    expect(excusesLabel.className).not.toContain("truncate");
    expect(excusesLabel.className).not.toContain("max-w-");
    expect(excusesLink?.className).toContain("min-w-0");
    expect(excusesLink?.className).toContain("flex-1");
  });

  it("keeps the mobile navigation and content clear of the device safe area", () => {
    const { container } = render(
      <AppShell user={director}>
        <div>Obsah</div>
      </AppShell>
    );

    const mobileNavigation = Array.from(
      container.querySelectorAll("nav")
    ).find((navigationElement) =>
      navigationElement.className.includes("md:hidden")
    );
    const main = container.querySelector("main");

    expect(mobileNavigation?.className).toContain(
      "pb-[env(safe-area-inset-bottom)]"
    );
    expect(container.querySelector("header")?.className).toContain(
      "pt-[env(safe-area-inset-top)]"
    );
    expect(main?.className).toContain(
      "pb-[calc(6rem+env(safe-area-inset-bottom))]"
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

    expect(signOut).toHaveBeenCalledWith({
      returnTo: "http://localhost:3000/login",
    });
  });

  it("offers notification settings only to directors", () => {
    const { rerender } = render(
      <AppShell user={director}>
        <div>Obsah</div>
      </AppShell>
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Otevřít uživatelské menu" })
    );

    expect(
      screen.getByRole("menuitemcheckbox", { name: "Notifikace" })
    ).toBeTruthy();

    rerender(
      <AppShell user={{ ...director, role: "PARENT" }}>
        <div>Obsah</div>
      </AppShell>
    );

    expect(
      screen.queryByRole("menuitemcheckbox", { name: "Notifikace" })
    ).toBeNull();
  });

  it("highlights a mobile destination as soon as its navigation starts", () => {
    render(
      <AppShell user={director}>
        <div>Obsah</div>
      </AppShell>
    );

    const getMobileLink = (name: string) =>
      screen.getAllByRole("link", { name }).at(-1) as HTMLAnchorElement;

    expect(getMobileLink("Přehled").className).toContain("text-gold");
    expect(getMobileLink("Docházka").className).toContain("text-charcoal-light");

    fireEvent.click(getMobileLink("Docházka"));

    expect(getMobileLink("Přehled").className).toContain("text-charcoal-light");
    expect(getMobileLink("Docházka").className).toContain("text-gold");
    expect(getMobileLink("Docházka").getAttribute("aria-busy")).toBe("true");
  });

  it("does not leave the current destination in a pending state", () => {
    render(
      <AppShell user={director}>
        <div>Obsah</div>
      </AppShell>
    );

    const overviewLink = screen.getAllByRole("link", { name: "Přehled" }).at(-1);
    if (!overviewLink) throw new Error("Chybí odkaz na přehled");

    fireEvent.click(overviewLink);

    expect(overviewLink.getAttribute("aria-busy")).toBeNull();
  });

  it("marks the role's primary destination active while the URL is root", () => {
    navigation.pathname = "/";
    render(
      <AppShell user={director}>
        <div>Obsah</div>
      </AppShell>
    );

    const overviewLink = screen.getAllByRole("link", { name: "Přehled" }).at(-1);
    if (!overviewLink) throw new Error("Chybí odkaz na přehled");

    expect(overviewLink.getAttribute("aria-current")).toBe("page");
    expect(overviewLink.className).toContain("text-gold");
  });
});
