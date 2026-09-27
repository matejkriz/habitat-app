import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const secret = "test-server-secret";
const now = new Date("2026-09-22T08:30:00Z").getTime();
const date = new Date("2026-09-22T00:00:00+02:00").getTime();

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async ({ db }) => {
    for (const role of ["PARENT", "DIRECTOR"] as const) {
      await db.insert("users", { id: role, role, createdAt: now, updatedAt: now });
    }
    await db.insert("children", {
      id: "child", firstName: "Anna", lastName: "Malá", active: true,
      createdAt: now, updatedAt: now,
    });
    await db.insert("parentChildren", {
      id: "link", parentId: "PARENT", childId: "child", createdAt: now,
    });
    await db.insert("pushSubscriptions", {
      userId: "DIRECTOR", endpoint: "https://push.test/director", p256dh: "key", auth: "auth",
      topics: ["DIRECTOR_EXCUSE_CREATED"], createdAt: now, updatedAt: now,
    });
  });
  return t;
}

const input = {
  secret, parentId: "PARENT", requestId: "makeup-request-123456", childIds: ["child"],
  fromDate: date, toDate: date, reason: "Náhradní den", kind: "MAKEUP" as const,
  cancelLunch: false, dayPart: "FULL_DAY" as const,
};

describe("attendance schedule and makeup persistence", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("PUSH_INTERNAL_SECRET", secret); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it("stores a partial schedule and accepts an empty regular schedule", async () => {
    const t = await setup();
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceDays: [1, 3] } });
    expect(await t.query(api.db.getById, { secret, table: "children", id: "child" })).toMatchObject({ attendanceDays: [1, 3] });
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceDays: [] } });
    expect(await t.query(api.db.getById, { secret, table: "children", id: "child" })).toMatchObject({ attendanceDays: [] });
  });

  it.each([[1, 1], [0, 1], [5], [1.5]])("rejects malformed weekdays %j", async (...days) => {
    const t = await setup();
    await expect(t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceDays: days } })).rejects.toThrow("docházky");
  });

  it("persists late makeup without silently approving its lunch and retries only once", async () => {
    const t = await setup();
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceDays: [1, 3, 4] } });
    const first = await t.mutation(api.parentExcuses.createParentExcuses, input);
    const replay = await t.mutation(api.parentExcuses.createParentExcuses, input);
    expect(first.excuses[0]).toMatchObject({ kind: "MAKEUP", cancelLunch: false, lateApprovedAt: null });
    expect(replay.replayed).toBe(true);
    expect(await t.run(({ db }) => db.query("excuses").collect())).toHaveLength(1);
    await t.mutation(api.pushNotifications.enqueueExcuse, { secret, excuseId: first.excuses[0].id });
    expect(await t.run(({ db }) => db.query("notificationEvents").collect())).toEqual([
      expect.objectContaining({ title: "Nová náhrada", body: expect.stringContaining("Anna Malá") }),
    ]);
    expect(await t.run(({ db }) => db.query("notificationDeliveries").collect())).toHaveLength(1);
  });

  it("rejects makeup for a child with the default full schedule", async () => {
    const t = await setup();
    await expect(t.mutation(api.parentExcuses.createParentExcuses, input)).rejects.toThrow("nechodí");
    expect(await t.run(({ db }) => db.query("excuses").collect())).toHaveLength(0);
  });

  it.each(["AFTERNOON", "NO_LUNCH"])("settles a makeup without a lunch to review: %s", async (mode) => {
    const t = await setup();
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: {
      attendanceDays: [1, 3, 4], doesNotTakeLunch: mode === "NO_LUNCH",
    } });
    const result = await t.mutation(api.parentExcuses.createParentExcuses, {
      ...input, dayPart: mode === "AFTERNOON" ? "AFTERNOON" : "FULL_DAY",
    });
    expect(result.excuses[0].lateApprovedAt).toBe(now);
  });

  it("rejects a range containing only regular attendance days", async () => {
    const t = await setup();
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceDays: [2, 3, 4] } });
    await expect(t.mutation(api.parentExcuses.createParentExcuses, input)).rejects.toThrow("nechodí");
  });

  it.each(["fromDate", "toDate"] as const)("rejects a regular makeup %s endpoint even if another date is an off day", async field => {
    const t = await setup();
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceDays: [1, 3, 4] } });
    const range = field === "fromDate" ? { fromDate: date - 86400000 } : { toDate: date + 86400000 };
    await expect(t.mutation(api.parentExcuses.createParentExcuses, { ...input, ...range })).rejects.toThrow("nechodí");
    expect(await t.run(({ db }) => db.query("excuses").collect())).toHaveLength(0);
  });

  it("rejects a regular day off excuse before writing any records", async () => {
    const t = await setup();
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceDays: [1, 3, 4] } });
    await expect(t.mutation(api.parentExcuses.createParentExcuses, { ...input, kind: "EXCUSE" })).rejects.toThrow("pravidelně chodí");
    expect(await t.run(({ db }) => db.query("excuses").collect())).toHaveLength(0);
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toHaveLength(0);
  });

  it("preserves the all-weekdays default for regular excuses", async () => {
    const t = await setup();
    const result = await t.mutation(api.parentExcuses.createParentExcuses, { ...input, kind: "EXCUSE" });
    expect(result.excuses).toHaveLength(1);
  });

  it("validates every sibling before committing the excuse batch", async () => {
    const t = await setup();
    await t.run(async ({ db }) => {
      await db.insert("children", { id: "other", firstName: "Max", lastName: "Malý", active: true, attendanceDays: [1, 3, 4], createdAt: now, updatedAt: now });
      await db.insert("parentChildren", { id: "other-link", parentId: "PARENT", childId: "other", createdAt: now });
    });
    await expect(t.mutation(api.parentExcuses.createParentExcuses, { ...input, kind: "EXCUSE", childIds: ["child", "other"] })).rejects.toThrow("pravidelně chodí");
    expect(await t.run(({ db }) => db.query("excuses").collect())).toHaveLength(0);
    expect(await t.run(({ db }) => db.query("auditLogs").collect())).toHaveLength(0);
    expect(await t.run(({ db }) => db.query("parentExcuseRequests").collect())).toHaveLength(0);
  });

  it("rejects a closed missing-schedule date", async () => {
    const t = await setup();
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceDays: [1, 3, 4] } });
    await t.run(({ db }) => db.insert("closedDays", { id: "closed", date, createdAt: now, updatedAt: now }));
    await expect(t.mutation(api.parentExcuses.createParentExcuses, input)).rejects.toThrow("otevřený");
  });

  it("rolls back the entire batch when any child is not owned", async () => {
    const t = await setup();
    await t.mutation(api.db.patchById, { secret, table: "children", id: "child", patch: { attendanceDays: [1, 3, 4] } });
    await expect(t.mutation(api.parentExcuses.createParentExcuses, { ...input, childIds: ["child", "other"] })).rejects.toThrow("přístup");
    expect(await t.run(({ db }) => db.query("excuses").collect())).toHaveLength(0);
  });
});
