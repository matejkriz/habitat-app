"use server";

import { revalidatePath } from "next/cache";
import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDayDate, validateDayDetails, type DayDetails, type DayDetailsPatch } from "@/lib/day-details";

export async function getDayDetailsForDate(dateKey: string): Promise<DayDetails> {
  const user = await getDbUser();
  if (!user || (user.role !== "DIRECTOR" && user.role !== "TEACHER")) throw new Error("Unauthorized");
  const details = await db.dayDetails.get(parseDayDate(dateKey), user.role === "DIRECTOR");
  return user.role === "DIRECTOR" ? details : { name: details.name };
}

export async function saveDayDetails(dateKey: string, details: DayDetailsPatch): Promise<void> {
  const user = await getDbUser();
  if (!user || user.role !== "DIRECTOR") throw new Error("Unauthorized");
  const date = parseDayDate(dateKey);
  validateDayDetails(details);
  // Whitelist fields at the action boundary; omitted fields remain untouched.
  await db.dayDetails.save(date, {
    ...(details.name === undefined ? {} : { name: details.name }),
    ...(details.expense === undefined ? {} : { expense: details.expense }),
    ...(details.report === undefined ? {} : { report: details.report }),
  }, user.id);
  revalidatePath("/kalendar");
  revalidatePath("/ucitel/dochazka");
  revalidatePath("/reditel/deti");
}
