import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "reconcile recently submitted excuses",
  { minutes: 1 },
  internal.pushNotifications.reconcileExcuseNotifications,
);

crons.interval(
  "recover pending push notification deliveries",
  { minutes: 5 },
  internal.pushNotifications.recoverDueDeliveries,
);

export default crons;
