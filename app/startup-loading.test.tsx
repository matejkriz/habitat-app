import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: ({
    alt,
    priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
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

  it("sets the startup background inline before the stylesheet is available", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");

    expect(layout).toContain('style={{ backgroundColor: "#FDF8F3" }}');
  });
});
