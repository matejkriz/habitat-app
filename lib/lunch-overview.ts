import { db } from "@/lib/db";
import type { Attendance, Child, NoLunchDay } from "@/lib/types";
import { getSchoolDaysInRange } from "@/lib/school-days";
import { getExcusesOverlapping } from "@/lib/excuse";
import { getDayCoverage, getDayPartCoverage, groupExcusesByChild } from "@/lib/excuse-coverage";
import { getLocalDateKey, getLunchStatus, isPayableLunch, sortChildrenWithSiblings, type LunchStatus } from "@/lib/lunches";

type LunchChildWithParentsRow = Child & {
  readonly parents: ReadonlyArray<{
    readonly parent: {
      readonly id: string;
    };
  }>;
};

export type LunchOverview = {
  readonly month: string;
  readonly monthLabel: string;
  readonly days: ReadonlyArray<{
    readonly key: string;
    readonly day: number;
    readonly weekday: string;
  }>;
  readonly children: ReadonlyArray<{
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly statuses: ReadonlyArray<LunchStatus | null>;
    readonly payableLunches: number;
  }>;
  readonly childrenWithoutLunch: ReadonlyArray<{
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
  }>;
};

export async function loadLunchOverview(month: string, parentId?: string): Promise<LunchOverview> {

  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const year = match ? Number(match[1]) : Number.NaN;
  const monthIndex = match ? Number(match[2]) - 1 : Number.NaN;

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isInteger(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    throw new Error("Neplatný měsíc");
  }

  const startOfMonth = new Date(year, monthIndex, 1);
  const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  const [schoolDays, children, attendance, excuses, noLunchDays] = await Promise.all([
    getSchoolDaysInRange(startOfMonth, endOfMonth),
    (parentId === undefined ? db.children.list({
      where: { active: true },
      include: {
        parents: {
          include: {
            parent: {
              select: { id: true },
            },
          },
        },
      },
    }) : db.parentLinks.list({ where: { parentId }, include: { child: true } }).then((links: { child: Child }[]) =>
      links.filter(link => link.child.active).map(({ child }) => ({ ...child, parents: [{ parent: { id: parentId } }] }))
    )) as Promise<ReadonlyArray<LunchChildWithParentsRow>>,
    db.attendance.list({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    }) as Promise<ReadonlyArray<Attendance>>,
    getExcusesOverlapping({ from: startOfMonth, to: endOfMonth }),
    db.noLunchDays.list({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
    }) as Promise<ReadonlyArray<NoLunchDay>>,
  ]);

  const excusesByChild = groupExcusesByChild(excuses);
  const sortedChildren = sortChildrenWithSiblings(
    children.map((child) => ({
      ...child,
      parentIds: child.parents.map(({ parent }) => parent.id),
    })),
  );
  const childrenWithLunch = sortedChildren.filter(
    (child) => !child.doesNotTakeLunch,
  );
  const childrenWithoutLunch = sortedChildren.filter(
    (child) => child.doesNotTakeLunch,
  );
  const attendanceByChildAndDate = new Map(
    attendance.map((record) => [
      `${record.childId}:${getLocalDateKey(record.date)}`,
      record,
    ]),
  );
  const noLunchDateKeys = new Set(noLunchDays.map((day) => getLocalDateKey(day.date)));
  const days = schoolDays.map((date) => ({
    date,
    key: getLocalDateKey(date),
    day: date.getDate(),
    weekday: ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"][date.getDay()],
  }));

  return {
    month,
    monthLabel: new Intl.DateTimeFormat("cs-CZ", {
      month: "long",
      year: "numeric",
    }).format(startOfMonth),
    days: days.map(({ key, day, weekday }) => ({ key, day, weekday })),
    children: childrenWithLunch.map((child) => {
      const childExcuses = excusesByChild.get(child.id) ?? [];
      const statuses = days.map((day) => {
        const wholeDayCoverage = getDayCoverage(childExcuses, day.date);
        const morningCoverage = getDayPartCoverage(
          childExcuses,
          day.date,
          "MORNING",
        );
        const usesMorningCancellation =
          !wholeDayCoverage.covered && morningCoverage.covered;

        return getLunchStatus(
          attendanceByChildAndDate.get(`${child.id}:${day.key}`),
          usesMorningCancellation ? morningCoverage : wholeDayCoverage,
          noLunchDateKeys.has(day.key),
          usesMorningCancellation,
        );
      });

      return {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        statuses,
        payableLunches: statuses.filter(isPayableLunch).length,
      };
    }),
    childrenWithoutLunch: childrenWithoutLunch.map((child) => ({
      id: child.id,
      firstName: child.firstName,
      lastName: child.lastName,
    })),
  };
}

