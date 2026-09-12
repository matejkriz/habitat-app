import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { validateCrowns, validateDayDetails, type TripFundOverview } from "../lib/day-details";
import { requireServerSecret } from "./serverSecret";
import type { Doc } from "./_generated/dataModel";
import { enqueueExcuseEvent } from "./pushNotifications";

const tableName = v.union(
  v.literal("users"),
  v.literal("children"),
  v.literal("parentChildren"),
  v.literal("attendance"),
  v.literal("excuses"),
  v.literal("closedDays"),
  v.literal("noLunchDays"),
  v.literal("auditLogs"),
);

const documentValue = v.any();
const excuseDayPart = v.union(
  v.literal("FULL_DAY"),
  v.literal("MORNING"),
  v.literal("AFTERNOON"),
);
const excuseValue = v.object({
  id: v.string(),
  childId: v.string(),
  fromDate: v.number(),
  toDate: v.number(),
  reason: v.union(v.string(), v.null()),
  dayPart: v.optional(excuseDayPart),
  cancelLunch: v.boolean(),
  submittedById: v.string(),
  submittedAt: v.number(),
  lateApprovedAt: v.union(v.number(), v.null()),
  lateApprovedById: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const list = query({
  args: { secret: v.string(), table: tableName },
  returns: v.array(v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    return await db.query(args.table).collect();
  },
});

export const findUser = query({
  args: {
    secret: v.string(),
    id: v.optional(v.string()),
    workosId: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.union(v.null(), v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);

    if (args.id) {
      return await db
        .query("users")
        .withIndex("by_app_id", (query) => query.eq("id", args.id!))
        .first();
    }
    if (args.workosId) {
      return await db
        .query("users")
        .withIndex("by_workos_id", (query) =>
          query.eq("workosId", args.workosId!),
        )
        .first();
    }
    if (args.email) {
      return await db
        .query("users")
        .withIndex("by_email", (query) => query.eq("email", args.email!))
        .first();
    }

    return null;
  },
});

export const listChildren = query({
  args: {
    secret: v.string(),
    active: v.optional(v.boolean()),
  },
  returns: v.array(v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    if (args.active !== undefined) {
      return await db
        .query("children")
        .withIndex("by_active", (query) => query.eq("active", args.active!))
        .collect();
    }
    return await db.query("children").collect();
  },
});

export const listParentChildren = query({
  args: {
    secret: v.string(),
    parentId: v.string(),
  },
  returns: v.array(v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const relations = await db
      .query("parentChildren")
      .withIndex("by_parent_id", (query) =>
        query.eq("parentId", args.parentId),
      )
      .collect();

    return await Promise.all(
      relations.map(async (relation) => ({
        ...relation,
        child: await db
          .query("children")
          .withIndex("by_app_id", (query) =>
            query.eq("id", relation.childId),
          )
          .first(),
      })),
    );
  },
});

export const getParentChild = query({
  args: {
    secret: v.string(),
    parentId: v.string(),
    childId: v.string(),
  },
  returns: v.union(v.null(), v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    return await db
      .query("parentChildren")
      .withIndex("by_parent_child", (query) =>
        query.eq("parentId", args.parentId).eq("childId", args.childId),
      )
      .first();
  },
});

export const listExcusesOverlapping = query({
  args: {
    secret: v.string(),
    childId: v.optional(v.string()),
    from: v.number(),
    to: v.number(),
  },
  returns: v.array(v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const childId = args.childId;
    const candidates = childId
      ? await db
          .query("excuses")
          .withIndex("by_child_from_date", (query) =>
            query.eq("childId", childId).lte("fromDate", args.to),
          )
          .collect()
      : await db
          .query("excuses")
          .withIndex("by_from_date", (query) => query.lte("fromDate", args.to))
          .collect();

    return candidates.filter((excuse) => excuse.toDate >= args.from);
  },
});

export const setNoLunchDay = mutation({
  args: {
    secret: v.string(),
    id: v.string(),
    date: v.number(),
    noLunch: v.boolean(),
    recordedById: v.string(),
    now: v.number(),
  },
  returns: v.boolean(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const existing = await db
      .query("noLunchDays")
      .withIndex("by_date", (query) => query.eq("date", args.date))
      .unique();

    if (!args.noLunch) {
      if (existing) await db.delete(existing._id);
      return false;
    }

    if (existing) {
      await db.patch(existing._id, {
        recordedById: args.recordedById,
        updatedAt: args.now,
      });
    } else {
      await db.insert("noLunchDays", {
        id: args.id,
        date: args.date,
        recordedById: args.recordedById,
        createdAt: args.now,
        updatedAt: args.now,
      });
    }

    return true;
  },
});

export const getById = query({
  args: { secret: v.string(), table: tableName, id: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    return await db
      .query(args.table)
      .withIndex("by_app_id", (q) => q.eq("id", args.id))
      .unique();
  },
});

export const insert = mutation({
  args: { secret: v.string(), table: tableName, value: documentValue },
  returns: v.string(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    return await db.insert(args.table, args.value);
  },
});

export const createExcuse = mutation({
  args: { secret: v.string(), value: excuseValue },
  returns: excuseValue,
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const value = args.value;

    const child = await db
      .query("children")
      .withIndex("by_app_id", (query) => query.eq("id", value.childId))
      .unique();
    if (!child) throw new Error("Child not found");

    const cancelLunch = child.doesNotTakeLunch ? true : value.cancelLunch;
    const dayPart =
      value.fromDate === value.toDate ? (value.dayPart ?? "FULL_DAY") : "FULL_DAY";
    const excuse = {
      ...value,
      dayPart,
      cancelLunch,
      lateApprovedAt:
        value.lateApprovedAt == null &&
        (child.doesNotTakeLunch || !cancelLunch)
          ? Date.now()
          : value.lateApprovedAt,
    };
    await db.insert("excuses", excuse);
    return excuse;
  },
});

export const patchById = mutation({
  args: {
    secret: v.string(),
    table: tableName,
    id: v.string(),
    patch: documentValue,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { db } = ctx;
    requireServerSecret(args.secret);
    const current = await db
      .query(args.table)
      .withIndex("by_app_id", (q) => q.eq("id", args.id))
      .unique();

    if (!current) {
      throw new Error(`Document not found in ${args.table} for id ${args.id}`);
    }

    if (args.table === "excuses") {
      const previous = current as Doc<"excuses">;
      // Give each saved revision a distinct key, including concurrent edits.
      await db.patch(previous._id, {
        ...args.patch,
        updatedAt: Math.max(Date.now(), previous.updatedAt + 1),
      });
      const updated = await db.get(previous._id);
      if (updated && (
        previous.fromDate !== updated.fromDate ||
        previous.toDate !== updated.toDate ||
        (previous.reason ?? null) !== (updated.reason ?? null) ||
        (previous.dayPart ?? "FULL_DAY") !== (updated.dayPart ?? "FULL_DAY") ||
        (previous.cancelLunch ?? true) !== (updated.cancelLunch ?? true)
      )) {
        // The edit and its delivery records commit together or both roll back.
        await enqueueExcuseEvent(ctx, updated, "EXCUSE_UPDATED");
      }
    } else {
      await db.patch(current._id, args.patch);
    }
    return true;
  },
});

export const deleteById = mutation({
  args: { secret: v.string(), table: tableName, id: v.string() },
  returns: v.boolean(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const current = await db
      .query(args.table)
      .withIndex("by_app_id", (q) => q.eq("id", args.id))
      .unique();

    if (!current) {
      return false;
    }

    await db.delete(current._id);
    return true;
  },
});

export const saveDayDetails = mutation({
  args: {
    secret: v.string(), date: v.number(), recordedById: v.string(),
    name: v.optional(v.union(v.string(), v.null())),
    expense: v.optional(v.union(v.number(), v.null())),
    report: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    if (!Number.isFinite(args.date) || !Number.isFinite(new Date(args.date).getTime())) throw new Error("Neplatné datum");
    validateDayDetails(args);
    const current = await db.query("dayDetails").withIndex("by_date", q => q.eq("date", args.date)).unique();
    const patch = {
      ...(args.name === undefined ? {} : { name: args.name?.trim() || null }),
      ...(args.expense === undefined ? {} : { expense: args.expense }),
      recordedById: args.recordedById, updatedAt: Date.now(),
    };
    if (current) await db.patch(current._id, patch);
    else await db.insert("dayDetails", { date: args.date, ...patch });
    if (args.report !== undefined) {
      const report = await db.query("dayReports").withIndex("by_date", q => q.eq("date", args.date)).unique();
      if (!args.report) {
        if (report) await db.delete(report._id);
      } else {
        const value = { date: args.date, report: args.report, recordedById: args.recordedById, updatedAt: Date.now() };
        if (report) await db.patch(report._id, value);
        else await db.insert("dayReports", value);
      }
    }
    await db.insert("auditLogs", {
      id: `day_${args.date}_${Date.now()}`, userId: args.recordedById, action: "UPDATE",
      entityType: "DayDetails", entityId: String(args.date),
      previousValue: { name: current?.name ?? null, expense: current?.expense ?? null },
      newValue: { ...patch, reportChanged: args.report !== undefined }, createdAt: Date.now(),
    });
    return null;
  },
});

export const getDayDetails = query({
  args: { secret: v.string(), date: v.number(), includeReport: v.boolean() },
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const day = await db.query("dayDetails").withIndex("by_date", q => q.eq("date", args.date)).unique();
    const report = args.includeReport
      ? await db.query("dayReports").withIndex("by_date", q => q.eq("date", args.date)).unique()
      : null;
    return { name: day?.name ?? null, expense: day?.expense ?? null,
      ...(args.includeReport ? { report: report?.report ?? null } : {}) };
  },
});

export const listDayReports = query({
  args: { secret: v.string(), before: v.optional(v.number()) },
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const rows = await db.query("dayReports")
      .withIndex("by_date", q => args.before === undefined ? q : q.lt("date", args.before))
      .order("desc").take(5);
    const reports = await Promise.all(rows.map(async row => {
      const day = await db.query("dayDetails").withIndex("by_date", q => q.eq("date", row.date)).unique();
      return { date: row.date, name: day?.name ?? null, report: row.report };
    }));
    return { reports, nextBefore: rows.length === 5 ? rows[rows.length - 1].date : null };
  },
});

export const listDayDetails = query({
  args: { secret: v.string(), from: v.number(), to: v.number() },
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const days = await db.query("dayDetails").withIndex("by_date", q => q.gte("date", args.from).lte("date", args.to)).collect();
    return days.map(day => ({ date: day.date, name: day.name ?? null, expense: day.expense ?? null }));
  },
});

async function readTripFundOverview(db: QueryCtx["db"]): Promise<TripFundOverview> {
  const [children, days, attendance, overrides] = await Promise.all([
    db.query("children").collect(),
    db.query("dayDetails").collect(),
    db.query("attendance").collect(),
    db.query("childTripExpenses").collect(),
  ]);
  const details = new Map(days.map(day => [day.date, day]));
  // Individual amounts remain chargeable even if the day's default was cleared.
  const dates = new Set([
    ...days.filter(day => day.expense != null).map(day => day.date),
    ...overrides.map(row => row.date),
  ]);
  const tripDays = [...dates].sort((a, b) => a - b).map(date => ({
    date, name: details.get(date)?.name ?? null, expense: details.get(date)?.expense ?? null,
  }));
  const individual = new Map(overrides.map(row => [`${row.childId}:${row.date}`, row.amount]));
  const present = new Set(attendance.filter(row => row.presence === "PRESENT").map(row => `${row.childId}:${row.date}`));

  return {
    days: tripDays,
    children: children.map(child => {
      const amounts = tripDays.map(day => {
        const key = `${child.id}:${day.date}`;
        return present.has(key) ? individual.get(key) ?? day.expense ?? 0 : null;
      });
      const fundSpent = amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
      return {
        childId: child.id, firstName: child.firstName, lastName: child.lastName,
        fundSent: child.fundSent ?? null, amounts, fundSpent,
        fundBalance: (child.fundSent ?? 0) - fundSpent,
      };
    }),
  };
}

export const getTripFundOverview = query({
  args: { secret: v.string() },
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    return readTripFundOverview(db);
  },
});

export const getTripFunds = query({
  args: { secret: v.string() },
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const overview = await readTripFundOverview(db);
    return overview.children.map(({ childId, fundSent, fundSpent, fundBalance }) => ({
      childId, fundSent, fundSpent, fundBalance,
    }));
  },
});

export const getDayTripExpenses = query({
  args: { secret: v.string(), date: v.number() },
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    const [day, attendance, overrides] = await Promise.all([
      db.query("dayDetails").withIndex("by_date", q => q.eq("date", args.date)).unique(),
      db.query("attendance").withIndex("by_date", q => q.eq("date", args.date)).collect(),
      db.query("childTripExpenses").withIndex("by_date", q => q.eq("date", args.date)).collect(),
    ]);
    const individual = new Map(overrides.map(row => [row.childId, row.amount]));
    const rows = await Promise.all(attendance.filter(record => record.presence === "PRESENT").map(async record => {
      const child = await db.query("children").withIndex("by_app_id", q => q.eq("id", record.childId)).unique();
      if (!child) return null;
      return { childId: child.id, name: `${child.firstName} ${child.lastName}`,
        amount: individual.get(child.id) ?? day?.expense ?? 0, override: individual.get(child.id) ?? null };
    }));
    return rows.filter(row => row !== null).sort((a, b) => a.name.localeCompare(b.name, "cs"));
  },
});

export const setChildTripExpense = mutation({
  args: { secret: v.string(), date: v.number(), childId: v.string(), amount: v.union(v.number(), v.null()), recordedById: v.string() },
  returns: v.null(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    if (!Number.isFinite(args.date)) throw new Error("Neplatné datum");
    if (args.amount !== null) validateCrowns(args.amount);
    const child = await db.query("children").withIndex("by_app_id", q => q.eq("id", args.childId)).unique();
    if (!child) throw new Error("Dítě nebylo nalezeno");
    const attendance = await db.query("attendance").withIndex("by_child_date", q => q.eq("childId", args.childId).eq("date", args.date)).unique();
    if (attendance?.presence !== "PRESENT") throw new Error("Nejprve dítě označte jako přítomné a uložte docházku");
    const current = await db.query("childTripExpenses").withIndex("by_child_date", q => q.eq("childId", args.childId).eq("date", args.date)).unique();
    if (args.amount === null) {
      if (current) await db.delete(current._id);
    } else {
      const value = { date: args.date, childId: args.childId, amount: args.amount, recordedById: args.recordedById, updatedAt: Date.now() };
      if (current) await db.patch(current._id, value);
      else await db.insert("childTripExpenses", value);
    }
    await db.insert("auditLogs", { id: `trip_${args.childId}_${args.date}_${Date.now()}`,
      userId: args.recordedById, action: "UPDATE", entityType: "ChildTripExpense", entityId: `${args.childId}:${args.date}`,
      previousValue: { amount: current?.amount ?? null }, newValue: { amount: args.amount }, createdAt: Date.now() });
    return null;
  },
});

export const createTripExpense = mutation({
  args: {
    secret: v.string(), date: v.number(), expense: v.number(), recordedById: v.string(),
    overrides: v.array(v.object({ childId: v.string(), amount: v.number() })),
  },
  returns: v.null(),
  handler: async ({ db }, args) => {
    requireServerSecret(args.secret);
    if (!Number.isFinite(args.date) || !Number.isFinite(new Date(args.date).getTime())) throw new Error("Neplatné datum");
    validateCrowns(args.expense);
    const ids = new Set<string>();
    for (const row of args.overrides) {
      validateCrowns(row.amount);
      if (ids.has(row.childId)) throw new Error("Dítě je uvedené vícekrát");
      ids.add(row.childId);
    }
    const [day, existing, attendance] = await Promise.all([
      db.query("dayDetails").withIndex("by_date", q => q.eq("date", args.date)).unique(),
      db.query("childTripExpenses").withIndex("by_date", q => q.eq("date", args.date)).first(),
      db.query("attendance").withIndex("by_date", q => q.eq("date", args.date)).collect(),
    ]);
    if (day?.expense != null || existing) throw new Error("Pro tento den už je útrata zadaná. Upravte ji v tabulce nebo v detailu dne.");
    const present = new Set(attendance.filter(row => row.presence === "PRESENT").map(row => row.childId));
    for (const row of args.overrides) {
      const child = await db.query("children").withIndex("by_app_id", q => q.eq("id", row.childId)).unique();
      if (!child) throw new Error("Dítě nebylo nalezeno");
      if (!present.has(row.childId)) throw new Error("Individuální útratu lze uložit jen přítomnému dítěti. Zkontrolujte docházku.");
    }
    const updatedAt = Date.now();
    const patch = { expense: args.expense, recordedById: args.recordedById, updatedAt };
    if (day) await db.patch(day._id, patch);
    else await db.insert("dayDetails", { date: args.date, ...patch });
    for (const row of args.overrides) {
      await db.insert("childTripExpenses", { ...row, date: args.date, recordedById: args.recordedById, updatedAt });
    }
    await db.insert("auditLogs", {
      id: `trip_create_${args.date}_${updatedAt}`, userId: args.recordedById,
      action: "CREATE", entityType: "TripExpense", entityId: String(args.date),
      previousValue: null, newValue: { expense: args.expense, overrides: args.overrides }, createdAt: updatedAt,
    });
    return null;
  },
});

export const getParentTripFundOverview = query({
  args: { secret: v.string(), parentId: v.string() },
  handler: async ({ db }, args): Promise<TripFundOverview> => {
    requireServerSecret(args.secret);
    const links = await db.query("parentChildren").withIndex("by_parent_id", q => q.eq("parentId", args.parentId)).collect();
    if (links.length === 0) return { days: [], children: [] };
    const childIds = new Set(links.map(link => link.childId));
    const overview = await readTripFundOverview(db);
    const children = overview.children.filter(child => childIds.has(child.childId));
    const columns = overview.days.flatMap((_, index) => children.some(child => child.amounts[index] !== null) ? [index] : []);
    return {
      days: columns.map(index => ({ date: overview.days[index].date, name: overview.days[index].name, expense: null })),
      children: children.map(child => ({ ...child, amounts: columns.map(index => child.amounts[index]) })),
    };
  },
});
