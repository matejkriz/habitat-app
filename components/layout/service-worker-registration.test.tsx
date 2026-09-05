import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ register: vi.fn() }));

vi.mock("@/lib/service-worker", () => ({
  registerHabitatServiceWorker: mocks.register,
}));

import { ServiceWorkerRegistration } from "./service-worker-registration";

const originalReadyState = Object.getOwnPropertyDescriptor(document, "readyState");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.register.mockReset();
  if (originalReadyState) {
    Object.defineProperty(document, "readyState", originalReadyState);
  } else {
    Reflect.deleteProperty(document, "readyState");
  }
});

describe("ServiceWorkerRegistration", () => {
  it("checks for a worker update after the initial page load", async () => {
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "loading",
    });
    mocks.register.mockResolvedValue(undefined);

    render(<ServiceWorkerRegistration />);
    expect(mocks.register).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("load"));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
  });
});
