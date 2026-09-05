import type { NextFetchEvent, NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handler: vi.fn(),
  authkitProxy: vi.fn(),
}));

vi.mock("@workos-inc/authkit-nextjs", () => ({
  authkitProxy: (...args: ReadonlyArray<unknown>) => {
    mocks.authkitProxy(...args);
    return mocks.handler;
  },
}));
vi.mock("@/lib/workos-url", () => ({
  getWorkOSBaseUrl: () => "https://habitat.example",
}));

import proxy from "./proxy";

afterEach(() => {
  vi.restoreAllMocks();
  mocks.handler.mockReset();
});

describe("AuthKit proxy timing", () => {
  it("preserves the response and appends the AuthKit Server-Timing metric", async () => {
    const response = new Response(null, {
      status: 307,
      headers: {
        Location: "https://habitat.example/login",
        "Server-Timing": "existing;dur=2",
        "X-AuthKit-State": "preserved",
      },
    });
    mocks.handler.mockResolvedValue(response);
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(112.34);
    const request = new Request("https://habitat.example/") as NextRequest;
    const event = {} as NextFetchEvent;

    const result = await proxy(request, event);

    expect(result).toBe(response);
    expect(mocks.handler).toHaveBeenCalledOnce();
    expect(mocks.handler).toHaveBeenCalledWith(request, event);
    expect(response.headers.get("Location")).toBe(
      "https://habitat.example/login",
    );
    expect(response.headers.get("X-AuthKit-State")).toBe("preserved");
    expect(response.headers.get("Server-Timing")).toBe(
      "existing;dur=2, authkit;dur=12.3",
    );
  });
});
