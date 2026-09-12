"use server";

import { revalidatePath } from "next/cache";
import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDayDate, validateDayDetails, validateCrowns, type ChildTripExpense, type DayDetails, type DayDetailsPatch } from "@/lib/day-details";

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
  revalidatePath("/reditel");
  revalidatePath("/");
  revalidatePath("/rodic");
}

export async function getDayTripExpenses(dateKey: string): Promise<ChildTripExpense[]> {
  const user = await getDbUser();
  if (!user || user.role !== "DIRECTOR") throw new Error("Unauthorized");
  return db.childTripExpenses.list(parseDayDate(dateKey));
}

export async function setChildTripExpense(dateKey: string, childId: string, amount: number | null): Promise<void> {
  const user = await getDbUser();
  if (!user || user.role !== "DIRECTOR") throw new Error("Unauthorized");
  if (amount !== null) validateCrowns(amount);
  await db.childTripExpenses.set(parseDayDate(dateKey), childId, amount, user.id);
  revalidatePath("/kalendar");
  revalidatePath("/ucitel/dochazka");
  revalidatePath("/reditel/deti");
  revalidatePath("/reditel");
  revalidatePath("/");
  revalidatePath("/rodic");
}

export async function createTripExpense(dateKey: string, expense: number, overrides: { childId: string; amount: number }[]): Promise<void> {
  const user = await getDbUser();
  if (!user || user.role !== "DIRECTOR") throw new Error("Unauthorized");
  const date = parseDayDate(dateKey);
  validateCrowns(expense);
  for (const row of overrides) validateCrowns(row.amount);
  await db.tripFunds.createExpense(date, expense, overrides.map(({ childId, amount }) => ({ childId, amount })), user.id);
  revalidatePath("/kalendar");
  revalidatePath("/ucitel/dochazka");
  revalidatePath("/reditel/deti");
  revalidatePath("/reditel");
  revalidatePath("/");
  revalidatePath("/rodic");
}

export async function getDayReports(before?: number) {
  const user = await getDbUser();
  if (!user || (user.role !== "DIRECTOR" && user.role !== "PARENT" && user.role !== "TEACHER")) throw new Error("Unauthorized");
  if (before !== undefined && !Number.isFinite(before)) throw new Error("Neplatné datum");
  return db.dayDetails.reports(before);
}

export async function getDayReport(dateKey: string): Promise<string | null> {
  const user = await getDbUser();
  if (!user || (user.role !== "DIRECTOR" && user.role !== "TEACHER")) throw new Error("Unauthorized");
  const details = await db.dayDetails.get(parseDayDate(dateKey), true);
  return details.report ?? null;
}

export async function saveDayReport(dateKey: string, report: string): Promise<void> {
  const user = await getDbUser();
  if (!user || (user.role !== "DIRECTOR" && user.role !== "TEACHER")) throw new Error("Unauthorized");
  const date = parseDayDate(dateKey);
  if (typeof report !== "string" || !report.trim()) throw new Error("Vyplňte text reportu.");
  validateDayDetails({ report });
  await db.dayDetails.save(date, { report }, user.id);
  revalidatePath("/kalendar");
  revalidatePath("/ucitel/dochazka");
  revalidatePath("/reditel");
  revalidatePath("/rodic");
  revalidatePath("/");
}
