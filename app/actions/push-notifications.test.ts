import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDbUser: vi.fn(),
  upsertDirector: vi.fn(),
  removeDirector: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getDbUser: mocks.getDbUser }));
vi.mock("@/lib/db", () => ({
  db: {
    pushSubscriptions: {
      upsertDirector: mocks.upsertDirector,
      removeDirector: mocks.removeDirector,
    },
  },
}));

import {
  registerDirectorPushSubscription,
  unregisterDirectorPushSubscription,
} from "./push-notifications";

const validSubscription = {
  endpoint: "https://push.example.test/subscription/123",
  keys: {
    p256dh: "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdEf",
    auth: "AbCdEfGhIjKlMnOp",
  },
};

describe("director push notification actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDbUser.mockResolvedValue({ id: "director-1", role: "DIRECTOR" });
    mocks.upsertDirector.mockResolvedValue(undefined);
    mocks.removeDirector.mockResolvedValue(undefined);
  });

  it("stores a validated subscription for the signed-in director", async () => {
    await registerDirectorPushSubscription(validSubscription);

    expect(mocks.upsertDirector).toHaveBeenCalledWith({
      userId: "director-1",
      endpoint: validSubscription.endpoint,
      ...validSubscription.keys,
    });
  });

  it("does not allow a parent to register a director subscription", async () => {
    mocks.getDbUser.mockResolvedValue({ id: "parent-1", role: "PARENT" });

    await expect(registerDirectorPushSubscription(validSubscription)).rejects.toThrow(
      "Unauthorized",
    );
    expect(mocks.upsertDirector).not.toHaveBeenCalled();
  });

  it("rejects a non-HTTPS endpoint", async () => {
    await expect(
      registerDirectorPushSubscription({
        ...validSubscription,
        endpoint: "http://push.example.test/subscription/123",
      }),
    ).rejects.toThrow("Neplatný push endpoint");
  });

  it("removes only the current director's endpoint", async () => {
    await unregisterDirectorPushSubscription(validSubscription.endpoint);

    expect(mocks.removeDirector).toHaveBeenCalledWith({
      userId: "director-1",
      endpoint: validSubscription.endpoint,
    });
  });
});
