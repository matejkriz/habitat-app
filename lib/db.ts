import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { api } from "../convex/_generated/api";
import type {
  Attendance,
  AuditLog,
  Child,
  ChildGender,
  ClosedDay,
  Excuse,
  ParentChild,
  Presence,
  User,
  UserRole,
} from "./types";
import type { ExcuseStatus, AuditAction } from "./types";

type TableName =
  | "users"
  | "children"
  | "parentChildren"
  | "attendance"
  | "excuses"
  | "closedDays"
  | "auditLogs";

type RawUser = {
  readonly id: string;
  readonly workosId?: string;
  readonly clerkId?: string;
  readonly name?: string | null;
  readonly email?: string | null;
  readonly image?: string | null;
  readonly role: UserRole;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type RawChild = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly gender?: ChildGender;
  readonly active: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type RawParentChild = {
  readonly id: string;
  readonly parentId: string;
  readonly childId: string;
  readonly createdAt: number;
};

type RawAttendance = {
  readonly id: string;
  readonly childId: string;
  readonly date: number;
  readonly presence: Presence;
  readonly excuseStatus: ExcuseStatus;
  readonly excuseId?: string | null;
  readonly recordedById?: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type RawExcuse = {
  readonly id: string;
  readonly childId: string;
  readonly fromDate: number;
  readonly toDate: number;
  readonly reason?: string | null;
  readonly submittedById: string;
  readonly submittedAt: number;
  readonly autoApproved: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type RawClosedDay = {
  readonly id: string;
  readonly date: number;
  readonly description?: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type RawAuditLog = {
  readonly id: string;
  readonly userId?: string | null;
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  readonly previousValue?: unknown;
  readonly newValue?: unknown;
  readonly createdAt: number;
};

type GetArgs = {
  readonly where: Record<string, unknown>;
  readonly include?: Record<string, unknown>;
  readonly select?: Record<string, unknown>;
};

type ListArgs = {
  readonly where?: Record<string, unknown>;
  readonly include?: Record<string, unknown>;
  readonly select?: Record<string, unknown>;
  readonly orderBy?: unknown;
  readonly take?: number;
};

type CreateRecordArgs = {
  readonly data: Record<string, unknown>;
};

type UpdateRecordArgs = {
  readonly where: Record<string, unknown>;
  readonly data: Record<string, unknown>;
};

type BulkUpdateRecordArgs = {
  readonly where: Record<string, unknown>;
  readonly data: Record<string, unknown>;
};

type RemoveRecordArgs = {
  readonly where: Record<string, unknown>;
};

const getConvexUrl = (): string => {
  const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "CONVEX_URL (or NEXT_PUBLIC_CONVEX_URL) is not set. Configure Convex deployment URL in your environment.",
    );
  }
  return url;
};

const globalForConvex = globalThis as unknown as {
  convexClient: ConvexHttpClient | undefined;
};

const getClient = (): ConvexHttpClient => {
  if (globalForConvex.convexClient) {
    return globalForConvex.convexClient;
  }
  const client = new ConvexHttpClient(getConvexUrl());
  if (process.env.NODE_ENV !== "production") {
    globalForConvex.convexClient = client;
  }
  return client;
};

type ConvexQueryReference = FunctionReference<"query">;
type ConvexMutationReference = FunctionReference<"mutation">;

const convexQuery = async <Ref extends ConvexQueryReference>(
  reference: Ref,
  args: Ref["_args"],
): Promise<Ref["_returnType"]> => await getClient().query(reference, args);

const convexMutation = async <Ref extends ConvexMutationReference>(
  reference: Ref,
  args: Ref["_args"],
): Promise<Ref["_returnType"]> => await getClient().mutation(reference, args);

const createId = (): string => `id_${randomUUID().replace(/-/g, "")}`;

const toTimestamp = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime();
  throw new Error("Invalid date value");
};

const normalizeDates = (value: unknown): unknown => {
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = normalizeDates(nested);
    }
    return output;
  }
  return value;
};

const fromRawUser = (raw: RawUser): User => ({
  id: raw.id,
  workosId: raw.workosId ?? "",
  name: raw.name ?? null,
  email: raw.email ?? null,
  image: raw.image ?? null,
  role: raw.role,
  createdAt: new Date(raw.createdAt),
  updatedAt: new Date(raw.updatedAt),
});

const fromRawChild = (raw: RawChild): Child => ({
  id: raw.id,
  firstName: raw.firstName,
  lastName: raw.lastName,
  gender: raw.gender ?? null,
  active: raw.active,
  createdAt: new Date(raw.createdAt),
  updatedAt: new Date(raw.updatedAt),
});

const fromRawParentChild = (raw: RawParentChild): ParentChild => ({
  id: raw.id,
  parentId: raw.parentId,
  childId: raw.childId,
  createdAt: new Date(raw.createdAt),
});

const fromRawAttendance = (raw: RawAttendance): Attendance => ({
  id: raw.id,
  childId: raw.childId,
  date: new Date(raw.date),
  presence: raw.presence,
  excuseStatus: raw.excuseStatus,
  excuseId: raw.excuseId ?? null,
  recordedById: raw.recordedById ?? null,
  createdAt: new Date(raw.createdAt),
  updatedAt: new Date(raw.updatedAt),
});

const fromRawExcuse = (raw: RawExcuse): Excuse => ({
  id: raw.id,
  childId: raw.childId,
  fromDate: new Date(raw.fromDate),
  toDate: new Date(raw.toDate),
  reason: raw.reason ?? null,
  submittedById: raw.submittedById,
  submittedAt: new Date(raw.submittedAt),
  autoApproved: raw.autoApproved,
  createdAt: new Date(raw.createdAt),
  updatedAt: new Date(raw.updatedAt),
});

const fromRawClosedDay = (raw: RawClosedDay): ClosedDay => ({
  id: raw.id,
  date: new Date(raw.date),
  description: raw.description ?? null,
  createdAt: new Date(raw.createdAt),
  updatedAt: new Date(raw.updatedAt),
});

const fromRawAuditLog = (raw: RawAuditLog): AuditLog => ({
  id: raw.id,
  userId: raw.userId ?? null,
  action: raw.action,
  entityType: raw.entityType,
  entityId: raw.entityId,
  previousValue: raw.previousValue ?? null,
  newValue: raw.newValue ?? null,
  createdAt: new Date(raw.createdAt),
});

const listTable = async <TRaw>(table: TableName): Promise<ReadonlyArray<TRaw>> => {
  const rows = await convexQuery(api.db.list, { table });
  return rows as unknown as ReadonlyArray<TRaw>;
};

const getById = async <TRaw>(table: TableName, id: string): Promise<TRaw | null> => {
  const row = await convexQuery(api.db.getById, { table, id });
  return row as unknown as TRaw | null;
};

const patchById = async (
  table: TableName,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> => {
  await convexMutation(api.db.patchById, { table, id, patch });
};

const insert = async (table: TableName, value: Record<string, unknown>): Promise<void> => {
  await convexMutation(api.db.insert, { table, value });
};

const deleteById = async (table: TableName, id: string): Promise<boolean> =>
  await convexMutation(api.db.deleteById, { table, id });

const compareValues = (a: unknown, b: unknown): number => {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "cs");
};

const applyTake = <T>(rows: ReadonlyArray<T>, take?: number): ReadonlyArray<T> =>
  typeof take === "number" ? rows.slice(0, take) : rows;

const matchesDateFilter = (date: number, value: unknown): boolean => {
  if (value instanceof Date || typeof value === "number" || typeof value === "string") {
    return date === toTimestamp(value);
  }
  if (value && typeof value === "object") {
    const filter = value as { gte?: Date | number | string; lte?: Date | number | string };
    const gte = filter.gte !== undefined ? toTimestamp(filter.gte) : Number.NEGATIVE_INFINITY;
    const lte = filter.lte !== undefined ? toTimestamp(filter.lte) : Number.POSITIVE_INFINITY;
    return date >= gte && date <= lte;
  }
  return false;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const assertFound = <T>(value: T | null | undefined, message: string): T => {
  if (!value) {
    throw new Error(message);
  }
  return value;
};

const applyUserSelect = (user: User, select?: Record<string, unknown>) => {
  if (!select) return user;
  const output: Record<string, unknown> = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) output[key] = (user as Record<string, unknown>)[key];
  }
  return output;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = {
  users: {
    get: async (args: GetArgs) => {
      const users = (await listTable<RawUser>("users")).map(fromRawUser);
      const where = args.where;

      const user =
        (where.id ? users.find((u) => u.id === where.id) : undefined) ??
        (where.workosId
          ? users.find((u) => u.workosId === where.workosId)
          : undefined) ??
        (where.email ? users.find((u) => u.email === where.email) : undefined) ??
        null;

      if (!user) return null;
      return applyUserSelect(user, args.select) as User;
    },

    list: async (args: ListArgs = {}) => {
      let users = (await listTable<RawUser>("users")).map(fromRawUser);
      if (args.where?.role) {
        users = users.filter((u) => u.role === args.where?.role);
      }

      if (Array.isArray(args.orderBy)) {
        users = [...users].sort((a, b) => {
          for (const rule of args.orderBy as Array<Record<string, unknown>>) {
            if (rule.name) {
              const result = compareValues(a.name, b.name) * (rule.name === "desc" ? -1 : 1);
              if (result !== 0) return result;
            }
            if (rule.email) {
              const result = compareValues(a.email, b.email) * (rule.email === "desc" ? -1 : 1);
              if (result !== 0) return result;
            }
          }
          return 0;
        });
      }

      const selected = users.map((u) => applyUserSelect(u, args.select)) as ReadonlyArray<User>;
      return applyTake(selected, args.take);
    },

    create: async (args: CreateRecordArgs) => {
      const data = args.data;
      const users = (await listTable<RawUser>("users")).map(fromRawUser);
      const workosId = String(data.workosId ?? "");
      const email = data.email == null ? null : String(data.email);

      if (!workosId) {
        throw new Error("WorkOS user ID is required");
      }
      if (users.some((u) => u.workosId === workosId)) {
        throw new Error("User with this WorkOS ID already exists");
      }
      if (email && users.some((u) => u.email === email)) {
        throw new Error("User with this email already exists");
      }

      const now = Date.now();
      const id = createId();
      const created: RawUser = {
        id,
        workosId,
        email,
        image: data.image == null ? null : String(data.image),
        name: data.name == null ? null : String(data.name),
        role: (data.role as UserRole) ?? "PARENT",
        createdAt: now,
        updatedAt: now,
      };
      await insert("users", created as unknown as Record<string, unknown>);
      return fromRawUser(created);
    },

    update: async (args: UpdateRecordArgs) => {
      const users = (await listTable<RawUser>("users")).map(fromRawUser);
      const current =
        (args.where.id ? users.find((u) => u.id === args.where.id) : undefined) ??
        (args.where.workosId
          ? users.find((u) => u.workosId === args.where.workosId)
          : undefined) ??
        null;

      const existing = assertFound(current, "User not found");
      const patch = normalizeDates(args.data) as Record<string, unknown>;

      if (patch.email !== undefined && patch.email !== null) {
        const email = String(patch.email);
        const collision = users.find((u) => u.email === email && u.id !== existing.id);
        if (collision) throw new Error("User with this email already exists");
      }
      if (patch.workosId !== undefined) {
        const workosId = String(patch.workosId);
        const collision = users.find(
          (u) => u.workosId === workosId && u.id !== existing.id,
        );
        if (collision) throw new Error("User with this WorkOS ID already exists");
      }

      await patchById("users", existing.id, { ...patch, updatedAt: Date.now() });
      const updatedRaw = await getById<RawUser>("users", existing.id);
      return fromRawUser(assertFound(updatedRaw, "User not found after update"));
    },
  },

  children: {
    list: async (args: ListArgs = {}) => {
      const children = (await listTable<RawChild>("children")).map(fromRawChild);
      const relations = (await listTable<RawParentChild>("parentChildren")).map(
        fromRawParentChild,
      );
      const users = (await listTable<RawUser>("users")).map(fromRawUser);

      let filtered = children;
      if (args.where?.active !== undefined) {
        filtered = filtered.filter((c) => c.active === Boolean(args.where?.active));
      }

      if (args.orderBy) {
        const orderRules = Array.isArray(args.orderBy)
          ? (args.orderBy as Array<Record<string, unknown>>)
          : [args.orderBy as Record<string, unknown>];
        filtered = [...filtered].sort((a, b) => {
          for (const rule of orderRules) {
            if (rule.active) {
              const result =
                compareValues(a.active ? 1 : 0, b.active ? 1 : 0) *
                (rule.active === "desc" ? -1 : 1);
              if (result !== 0) return result;
            }
            if (rule.lastName) {
              const result =
                compareValues(a.lastName, b.lastName) * (rule.lastName === "desc" ? -1 : 1);
              if (result !== 0) return result;
            }
            if (rule.firstName) {
              const result =
                compareValues(a.firstName, b.firstName) * (rule.firstName === "desc" ? -1 : 1);
              if (result !== 0) return result;
            }
          }
          return 0;
        });
      }

      const withIncludes = filtered.map((child) => {
        if (!args.include?.parents) {
          return child;
        }
        const childRelations = relations.filter((r) => r.childId === child.id);
        const include = (args.include?.parents ?? {}) as Record<string, unknown>;
        const includeConfig = (include as { include?: unknown }).include;
        const includeParent = isRecord(
          (includeConfig as { parent?: unknown } | undefined)?.parent,
        )
          ? ((includeConfig as { parent?: unknown }).parent as Record<string, unknown>)
          : null;

        return {
          ...child,
          parents: childRelations.map((relation) => {
            const parent = users.find((u) => u.id === relation.parentId) ?? null;
            if (!includeParent?.select || !parent) {
              return { ...relation, parent };
            }
            return {
              ...relation,
              parent: applyUserSelect(parent, includeParent.select as Record<string, unknown>),
            };
          }),
        };
      });

      return applyTake(withIncludes, args.take);
    },

    get: async (args: GetArgs) => {
      const raw = await getById<RawChild>("children", String(args.where.id));
      if (!raw) return null;
      return fromRawChild(raw);
    },

    create: async (args: CreateRecordArgs) => {
      const now = Date.now();
      const created: RawChild = {
        id: createId(),
        firstName: String(args.data.firstName ?? ""),
        lastName: String(args.data.lastName ?? ""),
        gender: args.data.gender as ChildGender,
        active: args.data.active === undefined ? true : Boolean(args.data.active),
        createdAt: now,
        updatedAt: now,
      };
      await insert("children", created as unknown as Record<string, unknown>);
      return fromRawChild(created);
    },

    update: async (args: UpdateRecordArgs) => {
      const id = String(args.where.id);
      const current = await getById<RawChild>("children", id);
      assertFound(current, "Child not found");

      const patch = normalizeDates(args.data) as Record<string, unknown>;
      await patchById("children", id, {
        ...patch,
        updatedAt: Date.now(),
      } as Record<string, unknown>);
      const updated = await getById<RawChild>("children", id);
      return fromRawChild(assertFound(updated, "Child not found after update"));
    },

    count: async (args: { where?: Record<string, unknown> } = {}) => {
      const children = (await listTable<RawChild>("children")).map(fromRawChild);
      if (args.where?.active === undefined) return children.length;
      return children.filter((c) => c.active === Boolean(args.where?.active)).length;
    },
  },

  parentLinks: {
    list: async (args: ListArgs = {}) => {
      const relations = (await listTable<RawParentChild>("parentChildren")).map(
        fromRawParentChild,
      );
      const children = (await listTable<RawChild>("children")).map(fromRawChild);

      let filtered = relations;
      if (args.where?.parentId) {
        filtered = filtered.filter((r) => r.parentId === args.where?.parentId);
      }

      return filtered.map((relation) => {
        if (!args.include?.child) return relation;
        const child = children.find((c) => c.id === relation.childId) ?? null;
        return {
          ...relation,
          child,
        };
      });
    },

    get: async (args: GetArgs) => {
      const relations = (await listTable<RawParentChild>("parentChildren")).map(
        fromRawParentChild,
      );
      const composite = args.where.parentId_childId as
        | { parentId: string; childId: string }
        | undefined;
      if (!composite) return null;

      const relation =
        relations.find(
          (r) => r.parentId === composite.parentId && r.childId === composite.childId,
        ) ?? null;
      if (!relation) return null;

      if (!args.include) return relation;

      const users = (await listTable<RawUser>("users")).map(fromRawUser);
      const children = (await listTable<RawChild>("children")).map(fromRawChild);

      const withInclude: Record<string, unknown> = { ...relation };
      if (args.include.parent) {
        const parent = users.find((u) => u.id === relation.parentId) ?? null;
        const parentInclude = args.include.parent as Record<string, unknown>;
        withInclude.parent =
          parent && parentInclude.select
            ? applyUserSelect(parent, parentInclude.select as Record<string, unknown>)
            : parent;
      }
      if (args.include.child) {
        const child = children.find((c) => c.id === relation.childId) ?? null;
        const childInclude = args.include.child as Record<string, unknown>;
        if (!child) {
          withInclude.child = null;
        } else if (!childInclude.select) {
          withInclude.child = child;
        } else {
          const output: Record<string, unknown> = {};
          for (const [key, enabled] of Object.entries(childInclude.select as Record<string, unknown>)) {
            if (enabled) output[key] = (child as Record<string, unknown>)[key];
          }
          withInclude.child = output;
        }
      }
      return withInclude;
    },

    create: async (args: CreateRecordArgs) => {
      const parentId = String(args.data.parentId ?? "");
      const childId = String(args.data.childId ?? "");

      const relations = (await listTable<RawParentChild>("parentChildren")).map(
        fromRawParentChild,
      );
      if (relations.some((r) => r.parentId === parentId && r.childId === childId)) {
        throw new Error("Parent-child relation already exists");
      }

      const created: RawParentChild = {
        id: createId(),
        parentId,
        childId,
        createdAt: Date.now(),
      };
      await insert("parentChildren", created as unknown as Record<string, unknown>);
      return fromRawParentChild(created);
    },

    remove: async (args: RemoveRecordArgs) => {
      const composite = args.where.parentId_childId as
        | { parentId: string; childId: string }
        | undefined;
      if (!composite) throw new Error("Missing composite key");
      const relations = (await listTable<RawParentChild>("parentChildren")).map(
        fromRawParentChild,
      );
      const relation = relations.find(
        (r) => r.parentId === composite.parentId && r.childId === composite.childId,
      );
      if (!relation) throw new Error("Relation not found");
      await deleteById("parentChildren", relation.id);
      return relation;
    },
  },

  attendance: {
    list: async (args: ListArgs = {}) => {
      const attendance = (await listTable<RawAttendance>("attendance")).map(fromRawAttendance);
      const children = (await listTable<RawChild>("children")).map(fromRawChild);
      const excuses = (await listTable<RawExcuse>("excuses")).map(fromRawExcuse);

      let filtered = attendance;
      const where = args.where;

      if (where) {
        filtered = filtered.filter((row) => {
          if (where.childId && row.childId !== where.childId) return false;
          if (where.id && row.id !== where.id) return false;
          if (where.excuseId !== undefined && row.excuseId !== where.excuseId) return false;
          if (where.presence && row.presence !== where.presence) return false;
          if (where.date && !matchesDateFilter(row.date.getTime(), where.date)) return false;
          return true;
        });
      }

      const withInclude = filtered.map((row) => {
        if (!args.include) return row;
        const output: Record<string, unknown> = { ...row };

        if (args.include.child) {
          const child = children.find((c) => c.id === row.childId) ?? null;
          const childInclude = args.include.child as Record<string, unknown>;
          if (!child) {
            output.child = null;
          } else if (!childInclude.select) {
            output.child = child;
          } else {
            const selected: Record<string, unknown> = {};
            for (const [key, enabled] of Object.entries(
              childInclude.select as Record<string, unknown>,
            )) {
              if (enabled) selected[key] = (child as Record<string, unknown>)[key];
            }
            output.child = selected;
          }
        }

        if (args.include.excuse) {
          const excuse = row.excuseId
            ? excuses.find((e) => e.id === row.excuseId) ?? null
            : null;
          const excuseInclude = args.include.excuse as Record<string, unknown>;
          if (!excuse) {
            output.excuse = null;
          } else if (!excuseInclude.select) {
            output.excuse = excuse;
          } else {
            const selected: Record<string, unknown> = {};
            for (const [key, enabled] of Object.entries(
              excuseInclude.select as Record<string, unknown>,
            )) {
              if (enabled) selected[key] = (excuse as Record<string, unknown>)[key];
            }
            output.excuse = selected;
          }
        }

        return output;
      });

      if (args.orderBy) {
        const rules = Array.isArray(args.orderBy)
          ? (args.orderBy as Array<Record<string, unknown>>)
          : [args.orderBy as Record<string, unknown>];
        withInclude.sort((a, b) => {
          for (const rule of rules) {
            if (rule.date) {
              const direction = rule.date === "desc" ? -1 : 1;
              const result =
                compareValues(
                  (a as { date: Date }).date.getTime(),
                  (b as { date: Date }).date.getTime(),
                ) * direction;
              if (result !== 0) return result;
            }
            if (isRecord(rule.child) && rule.child.lastName) {
              const direction = rule.child.lastName === "desc" ? -1 : 1;
              const aChild = (a as { child?: { lastName?: string } }).child?.lastName ?? "";
              const bChild = (b as { child?: { lastName?: string } }).child?.lastName ?? "";
              const result = compareValues(aChild, bChild) * direction;
              if (result !== 0) return result;
            }
          }
          return 0;
        });
      }

      return applyTake(withInclude, args.take);
    },

    get: async (args: GetArgs) => {
      if (args.where.id) {
        const raw = await getById<RawAttendance>("attendance", String(args.where.id));
        return raw ? fromRawAttendance(raw) : null;
      }

      const composite = args.where.childId_date as
        | { childId: string; date: Date | number | string }
        | undefined;
      if (!composite) return null;

      const rows = (await listTable<RawAttendance>("attendance")).map(fromRawAttendance);
      const targetDate = toTimestamp(composite.date);
      return (
        rows.find((row) => row.childId === composite.childId && row.date.getTime() === targetDate) ??
        null
      );
    },

    create: async (args: CreateRecordArgs) => {
      const data = args.data;
      const now = Date.now();
      const created: RawAttendance = {
        id: createId(),
        childId: String(data.childId),
        date: toTimestamp(data.date),
        presence: data.presence as Presence,
        excuseStatus: data.excuseStatus as ExcuseStatus,
        excuseId: data.excuseId == null ? null : String(data.excuseId),
        recordedById: data.recordedById == null ? null : String(data.recordedById),
        createdAt: now,
        updatedAt: now,
      };

      const all = (await listTable<RawAttendance>("attendance")).map(fromRawAttendance);
      if (
        all.some(
          (row) =>
            row.childId === created.childId && row.date.getTime() === created.date,
        )
      ) {
        throw new Error("Attendance already exists for child and date");
      }

      await insert("attendance", created as unknown as Record<string, unknown>);
      return fromRawAttendance(created);
    },

    save: async (args: {
      where: { childId_date: { childId: string; date: Date | number | string } };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => {
      const all = (await listTable<RawAttendance>("attendance")).map(fromRawAttendance);
      const childId = args.where.childId_date.childId;
      const date = toTimestamp(args.where.childId_date.date);
      const existing = all.find((row) => row.childId === childId && row.date.getTime() === date);

      if (existing) {
        const patch = normalizeDates(args.update) as Record<string, unknown>;
        await patchById("attendance", existing.id, {
          ...patch,
          updatedAt: Date.now(),
        } as Record<string, unknown>);
        const updated = await getById<RawAttendance>("attendance", existing.id);
        return fromRawAttendance(assertFound(updated, "Attendance not found after update"));
      }

      const now = Date.now();
      const created: RawAttendance = {
        id: createId(),
        childId: String(args.create.childId),
        date: toTimestamp(args.create.date),
        presence: args.create.presence as Presence,
        excuseStatus: args.create.excuseStatus as ExcuseStatus,
        excuseId: args.create.excuseId == null ? null : String(args.create.excuseId),
        recordedById:
          args.create.recordedById == null ? null : String(args.create.recordedById),
        createdAt: now,
        updatedAt: now,
      };
      await insert("attendance", created as unknown as Record<string, unknown>);
      return fromRawAttendance(created);
    },

    update: async (args: UpdateRecordArgs) => {
      const id = String(args.where.id);
      const current = await getById<RawAttendance>("attendance", id);
      assertFound(current, "Attendance not found");
      const patch = normalizeDates(args.data) as Record<string, unknown>;
      await patchById("attendance", id, {
        ...patch,
        updatedAt: Date.now(),
      } as Record<string, unknown>);
      const updated = await getById<RawAttendance>("attendance", id);
      return fromRawAttendance(assertFound(updated, "Attendance not found after update"));
    },

    bulkUpdate: async (args: BulkUpdateRecordArgs) => {
      const rows = (await listTable<RawAttendance>("attendance")).map(fromRawAttendance);
      const where = args.where;

      const matched = rows.filter((row) => {
        if (where.childId && row.childId !== where.childId) return false;
        if (where.excuseId !== undefined && row.excuseId !== where.excuseId) return false;
        if (where.presence && row.presence !== where.presence) return false;
        if (where.date && !matchesDateFilter(row.date.getTime(), where.date)) return false;
        return true;
      });

      for (const row of matched) {
        const patch = normalizeDates(args.data) as Record<string, unknown>;
        await patchById("attendance", row.id, {
          ...patch,
          updatedAt: Date.now(),
        } as Record<string, unknown>);
      }

      return { count: matched.length };
    },
  },

  excuses: {
    first: async (args: { where: Record<string, unknown> }) => {
      const excuses = (await listTable<RawExcuse>("excuses")).map(fromRawExcuse);
      const where = args.where;
      const result =
        excuses.find((excuse) => {
          if (where.childId && excuse.childId !== where.childId) return false;
          if (isRecord(where.fromDate) && where.fromDate.lte !== undefined) {
            if (excuse.fromDate.getTime() > toTimestamp(where.fromDate.lte)) return false;
          }
          if (isRecord(where.toDate) && where.toDate.gte !== undefined) {
            if (excuse.toDate.getTime() < toTimestamp(where.toDate.gte)) return false;
          }
          return true;
        }) ?? null;
      return result;
    },

    get: async (args: GetArgs) => {
      const raw = await getById<RawExcuse>("excuses", String(args.where.id));
      return raw ? fromRawExcuse(raw) : null;
    },

    list: async (args: ListArgs = {}) => {
      const excuses = (await listTable<RawExcuse>("excuses")).map(fromRawExcuse);
      const children = (await listTable<RawChild>("children")).map(fromRawChild);
      const users = (await listTable<RawUser>("users")).map(fromRawUser);

      let filtered = excuses.filter((excuse) => {
        const where = args.where;
        if (!where) return true;
        if (where.childId && excuse.childId !== where.childId) return false;
        if (where.autoApproved !== undefined && excuse.autoApproved !== where.autoApproved) {
          return false;
        }
        if (where.fromDate && !matchesDateFilter(excuse.fromDate.getTime(), where.fromDate)) {
          return false;
        }
        if (
          where.submittedAt &&
          !matchesDateFilter(excuse.submittedAt.getTime(), where.submittedAt)
        ) {
          return false;
        }
        return true;
      });

      const orderBy = args.orderBy as Record<string, unknown> | undefined;
      if (orderBy && isRecord(orderBy) && orderBy.submittedAt) {
        filtered = [...filtered].sort(
          (a, b) =>
            compareValues(a.submittedAt.getTime(), b.submittedAt.getTime()) *
            (orderBy.submittedAt === "desc" ? -1 : 1),
        );
      }

      const withInclude = filtered.map((excuse) => {
        if (!args.include) return excuse;
        const output: Record<string, unknown> = { ...excuse };
        if (args.include.child) {
          const child = children.find((c) => c.id === excuse.childId) ?? null;
          const childInclude = args.include.child as Record<string, unknown>;
          if (child && childInclude.select) {
            const selected: Record<string, unknown> = {};
            for (const [key, enabled] of Object.entries(
              childInclude.select as Record<string, unknown>,
            )) {
              if (enabled) selected[key] = (child as Record<string, unknown>)[key];
            }
            output.child = selected;
          } else {
            output.child = child;
          }
        }
        if (args.include.submittedBy) {
          const submittedBy = users.find((u) => u.id === excuse.submittedById) ?? null;
          const submittedByInclude = args.include.submittedBy as Record<string, unknown>;
          if (submittedBy && submittedByInclude.select) {
            output.submittedBy = applyUserSelect(
              submittedBy,
              submittedByInclude.select as Record<string, unknown>,
            );
          } else {
            output.submittedBy = submittedBy;
          }
        }
        return output;
      });

      return applyTake(withInclude, args.take);
    },

    create: async (args: CreateRecordArgs) => {
      const data = args.data;
      const now = Date.now();
      const created: RawExcuse = {
        id: createId(),
        childId: String(data.childId),
        fromDate: toTimestamp(data.fromDate),
        toDate: toTimestamp(data.toDate),
        reason: data.reason == null ? null : String(data.reason),
        submittedById: String(data.submittedById),
        submittedAt: data.submittedAt ? toTimestamp(data.submittedAt) : now,
        autoApproved: Boolean(data.autoApproved),
        createdAt: now,
        updatedAt: now,
      };
      await insert("excuses", created as unknown as Record<string, unknown>);
      return fromRawExcuse(created);
    },

    update: async (args: UpdateRecordArgs) => {
      const id = String(args.where.id);
      const current = await getById<RawExcuse>("excuses", id);
      assertFound(current, "Excuse not found");

      const patch = normalizeDates(args.data) as Record<string, unknown>;
      await patchById("excuses", id, {
        ...patch,
        updatedAt: Date.now(),
      } as Record<string, unknown>);
      const updated = await getById<RawExcuse>("excuses", id);
      return fromRawExcuse(assertFound(updated, "Excuse not found after update"));
    },

    remove: async (args: RemoveRecordArgs) => {
      const id = String(args.where.id);
      const current = await getById<RawExcuse>("excuses", id);
      const existing = assertFound(current, "Excuse not found");
      await deleteById("excuses", id);
      return fromRawExcuse(existing);
    },
  },

  closedDays: {
    list: async (args: ListArgs = {}) => {
      let rows = (await listTable<RawClosedDay>("closedDays")).map(fromRawClosedDay);

      if (args.where?.date) {
        rows = rows.filter((row) => matchesDateFilter(row.date.getTime(), args.where?.date));
      }

      const orderBy = args.orderBy as Record<string, unknown> | undefined;
      if (orderBy && isRecord(orderBy) && orderBy.date) {
        rows = [...rows].sort(
          (a, b) =>
            compareValues(a.date.getTime(), b.date.getTime()) *
            (orderBy.date === "desc" ? -1 : 1),
        );
      }

      if (args.select) {
        return rows.map((row) => {
          const selected: Record<string, unknown> = {};
          for (const [key, enabled] of Object.entries(args.select as Record<string, unknown>)) {
            if (enabled) selected[key] = (row as Record<string, unknown>)[key];
          }
          return selected;
        });
      }
      return applyTake(rows, args.take);
    },

    get: async (args: GetArgs) => {
      if (args.where.id) {
        const raw = await getById<RawClosedDay>("closedDays", String(args.where.id));
        return raw ? fromRawClosedDay(raw) : null;
      }

      if (args.where.date) {
        const rows = (await listTable<RawClosedDay>("closedDays")).map(fromRawClosedDay);
        const date = toTimestamp(args.where.date);
        return rows.find((row) => row.date.getTime() === date) ?? null;
      }
      return null;
    },

    create: async (args: CreateRecordArgs) => {
      const date = toTimestamp(args.data.date);
      const existing = (await listTable<RawClosedDay>("closedDays")).find((row) => row.date === date);
      if (existing) {
        throw new Error("Closed day already exists for this date");
      }

      const now = Date.now();
      const created: RawClosedDay = {
        id: createId(),
        date,
        description: args.data.description == null ? null : String(args.data.description),
        createdAt: now,
        updatedAt: now,
      };
      await insert("closedDays", created as unknown as Record<string, unknown>);
      return fromRawClosedDay(created);
    },

    remove: async (args: RemoveRecordArgs) => {
      const id = String(args.where.id);
      const current = await getById<RawClosedDay>("closedDays", id);
      const existing = assertFound(current, "Closed day not found");
      await deleteById("closedDays", id);
      return fromRawClosedDay(existing);
    },
  },

  auditLogs: {
    create: async (args: CreateRecordArgs) => {
      const now = Date.now();
      const created: RawAuditLog = {
        id: createId(),
        userId: args.data.userId == null ? null : String(args.data.userId),
        action: args.data.action as AuditAction,
        entityType: String(args.data.entityType),
        entityId: String(args.data.entityId),
        previousValue: normalizeDates(args.data.previousValue ?? null),
        newValue: normalizeDates(args.data.newValue ?? null),
        createdAt: now,
      };
      await insert("auditLogs", created as unknown as Record<string, unknown>);
      return fromRawAuditLog(created);
    },

    list: async (args: ListArgs = {}) => {
      let logs = (await listTable<RawAuditLog>("auditLogs")).map(fromRawAuditLog);
      const users = (await listTable<RawUser>("users")).map(fromRawUser);

      const orderBy = args.orderBy as Record<string, unknown> | undefined;
      if (orderBy && isRecord(orderBy) && orderBy.createdAt) {
        logs = [...logs].sort(
          (a, b) =>
            compareValues(a.createdAt.getTime(), b.createdAt.getTime()) *
            (orderBy.createdAt === "desc" ? -1 : 1),
        );
      }

      const withInclude = logs.map((log) => {
        if (!args.include?.user) return log;
        const user = log.userId ? users.find((u) => u.id === log.userId) ?? null : null;
        const userInclude = args.include.user as Record<string, unknown>;
        return {
          ...log,
          user:
            user && userInclude.select
              ? applyUserSelect(user, userInclude.select as Record<string, unknown>)
              : user,
        };
      });

      return applyTake(withInclude, args.take);
    },
  },
};
