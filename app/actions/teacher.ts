"use server";

import { getDbUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole, Presence } from "@prisma/client";
import { isClosedDay } from "@/lib/school-days";
import { recordBulkAttendance, canEnterAttendance } from "@/lib/attendance";
import { revalidatePath } from "next/cache";

/**
 * Get all active children for attendance entry
 */
export async function getAllChildren() {
  const user = await getDbUser();
  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DIRECTOR)) {
    throw new Error("Unauthorized");
  }

  const children = await prisma.child.findMany({
    where: { active: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return children;
}

/**
 * Get attendance for a specific date
 */
export async function getAttendanceForDate(dateStr: string) {
  const user = await getDbUser();
  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DIRECTOR)) {
    throw new Error("Unauthorized");
  }

  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  const closed = await isClosedDay(date);
  if (closed) {
    return { isClosed: true, attendance: [] };
  }

  const attendance = await prisma.attendance.findMany({
    where: { date },
    include: {
      child: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return {
    isClosed: false,
    attendance: attendance.map((a) => ({
      childId: a.childId,
      presence: a.presence,
      excuseStatus: a.excuseStatus,
    })),
  };
}

/**
 * Check if a date is a closed day
 */
export async function checkDateClosed(dateStr: string) {
  const date = new Date(dateStr);
  return isClosedDay(date);
}

/**
 * Save attendance for all children on a specific date
 */
export async function saveAttendance(formData: FormData) {
  const user = await getDbUser();
  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DIRECTOR)) {
    throw new Error("Unauthorized");
  }

  const dateStr = formData.get("date") as string;
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  // Check if we can enter attendance for this date
  const canEnter = await canEnterAttendance(date);
  if (!canEnter) {
    throw new Error("Nelze zaznamenat docházku pro tento den");
  }

  // Parse attendance data
  const records: Array<{ childId: string; presence: Presence }> = [];

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("child-")) {
      const childId = key.replace("child-", "");
      records.push({
        childId,
        presence: value === "present" ? Presence.PRESENT : Presence.ABSENT,
      });
    }
  }

  // Save all attendance records
  await recordBulkAttendance(records, date, user.id);

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      entityType: "Attendance",
      entityId: `bulk-${dateStr}`,
      newValue: {
        date: dateStr,
        recordCount: records.length,
        presentCount: records.filter((r) => r.presence === Presence.PRESENT).length,
      },
    },
  });

  revalidatePath("/ucitel/dochazka");
  revalidatePath("/rodic");

  return { success: true, recordCount: records.length };
}
