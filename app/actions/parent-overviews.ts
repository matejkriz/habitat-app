"use server";

import { getDbUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadLunchOverview, type LunchOverview } from "@/lib/lunch-overview";
import type { TripFundOverview } from "@/lib/day-details";

async function requireParent() {
  const user = await getDbUser();
  if (!user || user.role !== "PARENT") throw new Error("Unauthorized");
  return user;
}

export async function getParentLunchOverview(month: string): Promise<LunchOverview> {
  const user = await requireParent();
  return loadLunchOverview(month, user.id);
}

export async function getParentTripFundOverview(): Promise<TripFundOverview> {
  const user = await requireParent();
  const overview: TripFundOverview = await db.tripFunds.parentOverview(user.id);
  return { ...overview, children: overview.children.sort((a, b) =>
    a.lastName.localeCompare(b.lastName, "cs") || a.firstName.localeCompare(b.firstName, "cs")) };
}
