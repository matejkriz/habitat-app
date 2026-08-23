import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { PushNotificationToggle } from "./push-notification-toggle";

vi.mock("@/app/actions/push-notifications", () => ({
  registerDirectorPushSubscription: vi.fn(),
  unregisterDirectorPushSubscription: vi.fn(),
}));

const originalPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

describe("PushNotificationToggle", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class PushManager {},
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission: vi.fn() },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalPublicKey === undefined) {
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    } else {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = originalPublicKey;
    }
    Reflect.deleteProperty(window, "PushManager");
    Reflect.deleteProperty(window, "Notification");
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("recovers when the installed app has no active service worker registration", async () => {
    const registration = {
      active: {},
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
      },
    } as unknown as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(undefined),
        register,
        ready: new Promise<ServiceWorkerRegistration>(() => undefined),
      },
    });

    render(<PushNotificationToggle />);

    expect(await screen.findByText("Vypnuto")).toBeTruthy();
    expect(register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });

  it("stops loading when the service worker cannot become active", async () => {
    vi.useFakeTimers();
    const registration = {
      active: null,
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
      },
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue(undefined),
        register: vi.fn().mockResolvedValue(registration),
        ready: new Promise<ServiceWorkerRegistration>(() => undefined),
      },
    });

    render(<PushNotificationToggle />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.queryByText("Zjišťuji stav…")).toBeNull();
    expect(screen.getByText("Stav se nepodařilo načíst")).toBeTruthy();
  });
});
