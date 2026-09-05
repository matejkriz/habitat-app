import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: ({
    alt,
    preload,
    priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    preload?: boolean;
    priority?: boolean;
  }) => {
    void preload;
    void priority;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} {...props} />
    );
  },
}));

afterEach(cleanup);

describe("application startup loading state", () => {
  it("provides an accessible branded loading screen at the root segment", async () => {
    const loadingFile = "app/loading.tsx";
    if (!existsSync(loadingFile)) {
      expect(existsSync(loadingFile)).toBe(true);
      return;
    }

    const loadingModulePath = "./loading";
    const { default: Loading } = await import(loadingModulePath);
    render(<Loading />);

    expect(
      screen.getByRole("status", { name: "Načítání aplikace Habitat" }),
    ).toBeTruthy();
    expect(screen.getByRole("img", { name: "Habitat" })).toBeTruthy();
  });

  it("mirrors the application chrome while the parent dashboard loads", async () => {
    const loadingModulePath = "./loading";
    const { default: Loading } = await import(loadingModulePath);
    const { container } = render(<Loading />);

    const status = screen.getByRole("status", {
      name: "Načítání aplikace Habitat",
    });
    const header = screen.getByRole("banner");
    const avatar = container.querySelector(
      '[data-slot="startup-avatar-skeleton"]',
    );
    const mobileNavigation = container.querySelector(
      '[data-slot="startup-parent-navigation"]',
    );

    expect(status.className).toContain("bg-[#FDF8F3]");
    expect(status.firstElementChild).toBe(header);
    expect(header.className).toContain("pt-[env(safe-area-inset-top)]");
    expect(avatar?.className).toContain("h-10");
    expect(avatar?.className).toContain("w-10");
    expect(avatar?.className).toContain("rounded-full");
    expect(mobileNavigation?.className).toContain("md:hidden");
    expect(mobileNavigation?.className).toContain(
      "pb-[env(safe-area-inset-bottom)]",
    );
    expect(mobileNavigation?.textContent).toContain("Přehled");
    expect(mobileNavigation?.textContent).toContain("Omluvenka");

    const overviewLabel = Array.from(
      mobileNavigation?.querySelectorAll("span") ?? [],
    ).find((label) => label.textContent === "Přehled");
    expect(overviewLabel?.className).toContain("text-charcoal");
  });

  it("sets the startup background inline before the stylesheet is available", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");

    expect(layout).toContain('style={{ backgroundColor: "#FDF8F3" }}');
    expect(layout).toContain('colorScheme: "light"');
    expect(layout).toContain('viewportFit: "cover"');
    expect(readFileSync("app/loading.tsx", "utf8")).toContain("preload");
    expect(readFileSync("app/loading.tsx", "utf8")).not.toContain("priority");
  });

  it("registers the offline worker from the root layout", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");

    expect(layout).toContain("<ServiceWorkerRegistration />");
  });
});
