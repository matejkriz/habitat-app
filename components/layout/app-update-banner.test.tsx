import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AppUpdateBanner } from "./app-update-banner";

const CURRENT_COMMIT = "1111111111111111111111111111111111111111";
const LATEST_COMMIT = "2222222222222222222222222222222222222222";

function setInstalledPwa(isInstalled: boolean) {
  Object.defineProperty(navigator, "standalone", {
    configurable: true,
    value: isInstalled,
  });
}

function versionResponse(commitSha = LATEST_COMMIT) {
  return Response.json({ version: "2026.09.06", commitSha });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "standalone");
});

describe("AppUpdateBanner", () => {
  it("does not check for updates outside an installed PWA", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_COMMIT_SHA", CURRENT_COMMIT);
    setInstalledPwa(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AppUpdateBanner />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Je dostupná nová verze.")).toBeNull();
  });

  it("does not offer the commit already running", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_COMMIT_SHA", CURRENT_COMMIT);
    setInstalledPwa(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(versionResponse(CURRENT_COMMIT)));

    render(<AppUpdateBanner />);

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(screen.queryByText("Je dostupná nová verze.")).toBeNull();
  });

  it("can dismiss the available update", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_COMMIT_SHA", CURRENT_COMMIT);
    setInstalledPwa(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(versionResponse()));

    render(<AppUpdateBanner />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Skrýt upozornění na aktualizaci",
      }),
    );

    expect(screen.queryByText("Je dostupná nová verze.")).toBeNull();
  });

  it("can reload into the available update", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_COMMIT_SHA", CURRENT_COMMIT);
    setInstalledPwa(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(versionResponse()));
    const updateNow = vi.fn();

    render(<AppUpdateBanner onUpdate={updateNow} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Aktualizovat teď" }),
    );

    expect(updateNow).toHaveBeenCalledOnce();
    const pending = screen.getByRole("button", { name: "Aktualizuji…" });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(pending);
    expect(updateNow).toHaveBeenCalledOnce();
  });

  it("checks again when the PWA returns to the foreground", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_COMMIT_SHA", CURRENT_COMMIT);
    setInstalledPwa(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(versionResponse(CURRENT_COMMIT))
      .mockResolvedValueOnce(versionResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<AppUpdateBanner />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    document.dispatchEvent(new Event("visibilitychange"));

    expect(await screen.findByText("Je dostupná nová verze.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("periodically checks while the PWA stays visible", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_APP_COMMIT_SHA", CURRENT_COMMIT);
    setInstalledPwa(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(versionResponse(CURRENT_COMMIT))
      .mockResolvedValueOnce(versionResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<AppUpdateBanner />);
    await act(async () => Promise.resolve());
    expect(fetchMock).toHaveBeenCalledOnce();

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Je dostupná nová verze.")).toBeTruthy();
  });

  it("ignores malformed version responses", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_COMMIT_SHA", CURRENT_COMMIT);
    setInstalledPwa(true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ version: 7, commitSha: 7 })),
    );

    render(<AppUpdateBanner />);

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(screen.queryByText("Je dostupná nová verze.")).toBeNull();
  });
});
