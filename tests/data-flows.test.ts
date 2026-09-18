// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { getFunctionName, type FunctionReference } from "convex/server";

const transport = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
  user: { id: "teacher", role: "TEACHER" } as {
    id: string;
    role: string;
  } | null,
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = transport.query;
    mutation = transport.mutation;
  },
}));
vi.mock("@/lib/auth", () => ({ getDbUser: async () => transport.user }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/slack", () => ({
  sendExcuseNotification: vi.fn().mockResolvedValue(undefined),
}));

import { saveAttendance } from "../app/actions/teacher";
import {
  submitExcuse,
  getChildAttendanceHistory,
  getChildCalendarMonth,
  getChildExcuses,
  getChildStats,
  getChildTodayStatus,
  editParentExcuse,
  deleteParentExcuse,
} from "../app/actions/parent";
import {
  createChild,
  assignParentToChild,
  removeParentFromChild,
  addClosedDay,
  removeClosedDay,
  exportAttendanceCSV,
  updateExcuse,
  getLunchOverview,
} from "../app/actions/director";
import { db } from "../lib/db";

const modules = import.meta.glob("../convex/**/*.ts");
const createTest = () => convexTest(schema, modules);
let t: ReturnType<typeof createTest>;
const day = "2026-09-17";
function attendance(...ids: string[]) {
  const form = new FormData();
  form.set("date", day);
  ids.forEach((id) => form.set(`child-${id}`, "absent"));
  return form;
}
function excuse(...ids: string[]) {
  const form = new FormData();
  form.set("requestId", "test-request-123456789");
  form.set("fromDate", day);
  form.set("toDate", day);
  form.set("reason", 'Řekl "bolí mě břicho"; doma');
  ids.forEach((id) => form.append("childIds", id));
  return form;
}
async function rows(table: "attendance" | "excuses" | "auditLogs") {
  return t.run(({ db }) => db.query(table).collect());
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-17T12:00:00Z"));
  vi.stubEnv("CONVEX_URL", "https://test.convex.cloud");
  vi.stubEnv("PUSH_INTERNAL_SECRET", "test-secret");
  t = createTest();
  transport.user = { id: "teacher", role: "TEACHER" };
  transport.query.mockImplementation((ref, args) => t.query(ref, args));
  transport.mutation.mockImplementation((ref, args) => t.mutation(ref, args));
  await t.run(async ({ db }) => {
    for (const role of ["TEACHER", "DIRECTOR", "PARENT"] as const) {
      await db.insert("users", {
        id: role.toLowerCase(),
        role,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    for (const id of ["a", "b"]) {
      await db.insert("children", {
        id,
        firstName: id,
        lastName: "Test",
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await db.insert("parentChildren", {
        id: `link-${id}`,
        parentId: "parent",
        childId: id,
        createdAt: Date.now(),
      });
    }
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("attendance through actions, adapter and Convex", () => {
  it("persists a day and overwrites it without duplicates", async () => {
    await saveAttendance(attendance("a", "b"));
    const form = attendance("a", "b");
    form.set("child-a", "present");
    await saveAttendance(form);
    const saved = await rows("attendance");
    expect(saved).toHaveLength(2);
    expect(saved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ childId: "a", presence: "PRESENT" }),
        expect.objectContaining({ childId: "b", presence: "ABSENT" }),
      ]),
    );
    transport.user = { id: "parent", role: "PARENT" };
    expect(await getChildAttendanceHistory("a")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ presence: "PRESENT" }),
      ]),
    );
  });
  it("does not leave a partial day when a selected child no longer exists", async () => {
    await expect(saveAttendance(attendance("a", "missing"))).rejects.toThrow();
    expect(await rows("attendance")).toHaveLength(0);
    expect(await rows("auditLogs")).toHaveLength(0);
  });
  it.each(["2026-09-18", "2026-09-21", "invalid"])(
    "rejects a closed, future or invalid day: %s",
    async (date) => {
      const form = attendance("a");
      form.set("date", date);
      await expect(saveAttendance(form)).rejects.toThrow();
      expect(await rows("attendance")).toHaveLength(0);
    },
  );
  it("rejects malformed presence instead of silently saving absence", async () => {
    const form = attendance("a");
    form.set("child-a", "typo");
    await expect(saveAttendance(form)).rejects.toThrow();
    expect(await rows("attendance")).toHaveLength(0);
  });
});

describe("parent isolation at the server action boundary", () => {
  it.each([
    ["history", () => getChildAttendanceHistory("a")],
    ["calendar", () => getChildCalendarMonth("a", "2026-09")],
    ["excuses", () => getChildExcuses("a")],
    ["stats", () => getChildStats("a")],
    ["today", () => getChildTodayStatus("a")],
  ])("denies another parent's %s", async (_name, action) => {
    transport.user = { id: "other-parent", role: "PARENT" };
    await expect(action()).rejects.toThrow("Access denied");
  });
  it.each(["edit", "delete"])(
    "cannot %s another child's excuse",
    async (action) => {
      transport.user = { id: "parent", role: "PARENT" };
      const created = await submitExcuse(excuse("a"));
      transport.user = { id: "other-parent", role: "PARENT" };
      const id = created.excuses[0].id;
      await expect(
        action === "edit"
          ? editParentExcuse(id, {
              fromDate: day,
              toDate: day,
              reason: "changed",
            })
          : deleteParentExcuse(id),
      ).rejects.toThrow("Access denied");
      expect(await rows("excuses")).toEqual([
        expect.objectContaining({ id, reason: 'Řekl "bolí mě břicho"; doma' }),
      ]);
    },
  );
  it.each([null, { id: "parent", role: "PARENT" }])(
    "denies attendance writes by %j",
    async (user) => {
      transport.user = user;
      await expect(saveAttendance(attendance("a"))).rejects.toThrow(
        "Unauthorized",
      );
      expect(await rows("attendance")).toHaveLength(0);
    },
  );
  it("denies child administration to a teacher", async () => {
    await expect(createChild("Nové", "Dítě", "FEMALE")).rejects.toThrow(
      "Unauthorized",
    );
    expect(
      await t.run(({ db }) => db.query("children").collect()),
    ).toHaveLength(2);
  });
});

describe("parent excuse submission recovery", () => {
  beforeEach(() => {
    transport.user = { id: "parent", role: "PARENT" };
  });
  it("retries the same submission without duplicate excuses or audit entries", async () => {
    const first = await submitExcuse(excuse("a", "b"));
    const second = await submitExcuse(excuse("a", "b"));
    expect(second.excuses).toEqual(first.excuses);
    expect(await rows("excuses")).toHaveLength(2);
    expect(await rows("auditLogs")).toHaveLength(2);
  });
  it("preserves a partial-day excuse through atomic submission and retry", async () => {
    const form = excuse("a");
    form.set("dayPart", "AFTERNOON");
    await submitExcuse(form);
    await submitExcuse(form);
    expect(await rows("excuses")).toEqual([
      expect.objectContaining({ dayPart: "AFTERNOON" }),
    ]);
    form.set("dayPart", "MORNING");
    await expect(submitExcuse(form)).rejects.toThrow("Obsah opakovaného požadavku");
    expect(await rows("excuses")).toHaveLength(1);
  });
  it.each(["kept", "no-lunch-child"])(
    "preserves automatic approval for %s",
    async (mode) => {
      const form = excuse("a");
      if (mode === "kept") form.set("cancelLunch", "false");
      else
        await db.children.update({
          where: { id: "a" },
          data: { doesNotTakeLunch: true },
        });
      const result = await submitExcuse(form);
      expect(result.summary.lateDayCount).toBe(0);
      expect(result.summary.automaticallyApprovedDayCount).toBe(1);
      expect(await rows("excuses")).toEqual([
        expect.objectContaining({
          cancelLunch: mode !== "kept",
          lateApprovedAt: Date.now(),
        }),
      ]);
    },
  );
  it("rejects reuse of a request identity with changed contents", async () => {
    await submitExcuse(excuse("a"));
    const changed = excuse("a");
    changed.set("cancelLunch", "false");
    await expect(submitExcuse(changed)).rejects.toThrow(
      "Obsah opakovaného požadavku",
    );
    expect(await rows("excuses")).toHaveLength(1);
  });
  it("creates nothing if a linked child has disappeared", async () => {
    await t.run(async ({ db }) => {
      const child = await db
        .query("children")
        .withIndex("by_app_id", (q) => q.eq("id", "b"))
        .unique();
      await db.delete(child!._id);
    });
    await expect(submitExcuse(excuse("a", "b"))).rejects.toThrow();
    expect(await rows("excuses")).toHaveLength(0);
  });
  it("can retry after the response is lost after commit", async () => {
    let lost = false;
    transport.mutation.mockImplementation(
      async (ref: FunctionReference<"mutation">, args) => {
        const result = await t.mutation(ref, args);
        if (!lost && getFunctionName(ref).includes("createParentExcuses")) {
          lost = true;
          throw new Error("Connection lost");
        }
        return result;
      },
    );
    await expect(submitExcuse(excuse("a", "b"))).rejects.toThrow(
      "Connection lost",
    );
    await submitExcuse(excuse("a", "b"));
    expect(await rows("excuses")).toHaveLength(2);
  });
});

describe("director workflows", () => {
  beforeEach(() => {
    transport.user = { id: "director", role: "DIRECTOR" };
  });
  it("assigns and removes a parent's access to a newly created child", async () => {
    const child = await createChild("Nové", "Dítě", "FEMALE");
    await assignParentToChild("parent", child.id);
    transport.user = { id: "parent", role: "PARENT" };
    await expect(getChildExcuses(child.id)).resolves.toEqual([]);
    transport.user = { id: "director", role: "DIRECTOR" };
    await removeParentFromChild("parent", child.id);
    transport.user = { id: "parent", role: "PARENT" };
    await expect(getChildExcuses(child.id)).rejects.toThrow("Access denied");
  });
  it("blocks attendance on a custom closed day and allows it after removal", async () => {
    const closed = await addClosedDay(day, "Volno");
    await expect(saveAttendance(attendance("a"))).rejects.toThrow();
    await removeClosedDay(closed.id);
    await saveAttendance(attendance("a"));
    expect(await rows("attendance")).toHaveLength(1);
  });
  it("exports quoted text and reflects excuse approval and deletion", async () => {
    await saveAttendance(attendance("a"));
    transport.user = { id: "parent", role: "PARENT" };
    const created = await submitExcuse(excuse("a"));
    transport.user = { id: "director", role: "DIRECTOR" };
    expect(
      (await getLunchOverview("2026-09")).children.find(
        (child) => child.id === "a",
      )?.payableLunches,
    ).toBe(1);
    await updateExcuse(created.excuses[0].id, true);
    expect(
      (await getLunchOverview("2026-09")).children.find(
        (child) => child.id === "a",
      )?.payableLunches,
    ).toBe(0);
    expect(await exportAttendanceCSV(day, day, "a")).toContain(
      '"Omluveno";"Řekl ""bolí mě břicho""; doma"',
    );
    transport.user = { id: "parent", role: "PARENT" };
    await deleteParentExcuse(created.excuses[0].id);
    expect(await getChildAttendanceHistory("a")).toEqual([
      expect.objectContaining({ excuseStatus: "UNEXCUSED" }),
    ]);
    expect(await db.attendance.list()).toHaveLength(1);
  });
});
