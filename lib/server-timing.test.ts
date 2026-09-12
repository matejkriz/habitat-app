import { afterEach, describe, expect, it, vi } from "vitest";
import { measureServerOperation } from "./server-timing";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("measureServerOperation", () => {
  it("logs a rounded structured success metric", async () => {
    const now = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(22.36);
    const log = vi.fn();

    await expect(
      measureServerOperation("convex.query.db:list", async () => 42, {
        now,
        log,
      }),
    ).resolves.toBe(42);

    const payload = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(payload).toEqual({
      event: "server_operation",
      operation: "convex.query.db:list",
      durationMs: 12.4,
      outcome: "ok",
    });
    expect(Object.keys(payload).sort()).toEqual(
      ["durationMs", "event", "operation", "outcome"].sort(),
    );
  });

  it("records failure without exposing the error and rethrows it", async () => {
    const secretError = new Error("session-token-secret");
    const now = vi.fn().mockReturnValueOnce(5).mockReturnValueOnce(8);
    const log = vi.fn();

    await expect(
      measureServerOperation(
        "authkit.withAuth",
        async () => {
          throw secretError;
        },
        { now, log },
      ),
    ).rejects.toBe(secretError);

    const serialized = String(log.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toEqual({
      event: "server_operation",
      operation: "authkit.withAuth",
      durationMs: 3,
      outcome: "error",
    });
    expect(serialized).not.toContain("session-token-secret");
  });

  it("does not let a logging failure break the measured operation", async () => {
    await expect(
      measureServerOperation("auth.getDbUser", async () => "user", {
        now: vi.fn().mockReturnValueOnce(1).mockReturnValueOnce(2),
        log: () => {
          throw new Error("logger unavailable");
        },
      }),
    ).resolves.toBe("user");
  });

  it("does not emit request metrics during a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await measureServerOperation("auth.getDbUser", async () => null);

    expect(info).not.toHaveBeenCalled();
  });
});
