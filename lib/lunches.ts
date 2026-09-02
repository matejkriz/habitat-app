import { toDayKey, type DayCoverage } from "./excuse-coverage";
import { Presence, type Presence as PresenceValue } from "./types";

export const LunchStatus = {
  NO_LUNCH: "no-lunch",
  PRESENT: "present",
  EXCUSED: "excused",
  KEPT: "kept",
  LATE: "late",
  UNEXCUSED: "unexcused",
} as const;

export type LunchStatus = (typeof LunchStatus)[keyof typeof LunchStatus];

export type LunchAttendance = {
  readonly presence: PresenceValue;
};

export type ChildWithFamily = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly parentIds: ReadonlyArray<string>;
};

export function getLunchStatus(
  attendance: LunchAttendance | undefined,
  coverage: DayCoverage,
  noLunch = false,
): LunchStatus | null {
  if (noLunch) return LunchStatus.NO_LUNCH;
  if (!attendance) return null;

  if (attendance.presence === Presence.PRESENT) {
    return LunchStatus.PRESENT;
  }

  if (coverage.lunchCancelled) {
    return LunchStatus.EXCUSED;
  }

  if (coverage.excused) return LunchStatus.KEPT;

  return coverage.covered ? LunchStatus.LATE : LunchStatus.UNEXCUSED;
}

export function isPayableLunch(status: LunchStatus | null): boolean {
  return (
    status === LunchStatus.PRESENT ||
    status === LunchStatus.KEPT ||
    status === LunchStatus.LATE ||
    status === LunchStatus.UNEXCUSED
  );
}

export const getLocalDateKey = toDayKey;

const compareChildren = (a: ChildWithFamily, b: ChildWithFamily): number => {
  const byLastName = a.lastName.localeCompare(b.lastName, "cs");
  if (byLastName !== 0) return byLastName;

  return a.firstName.localeCompare(b.firstName, "cs");
};

/**
 * Keeps children sharing any parent together, including blended families where
 * sibling relationships form a larger connected group.
 */
export function sortChildrenWithSiblings<T extends ChildWithFamily>(
  children: ReadonlyArray<T>,
): T[] {
  const parent = children.map((_, index) => index);

  const find = (index: number): number => {
    if (parent[index] !== index) {
      parent[index] = find(parent[index]);
    }
    return parent[index];
  };

  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  const firstChildByParent = new Map<string, number>();

  children.forEach((child, childIndex) => {
    child.parentIds.forEach((parentId) => {
      const siblingIndex = firstChildByParent.get(parentId);
      if (siblingIndex === undefined) {
        firstChildByParent.set(parentId, childIndex);
      } else {
        union(childIndex, siblingIndex);
      }
    });
  });

  const families = new Map<number, T[]>();
  children.forEach((child, index) => {
    const root = find(index);
    const family = families.get(root) ?? [];
    family.push(child);
    families.set(root, family);
  });

  return [...families.values()]
    .map((family) => family.sort(compareChildren))
    .sort((a, b) => compareChildren(a[0], b[0]))
    .flat();
}
