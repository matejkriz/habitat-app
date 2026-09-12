import { getDayReports } from "@/app/actions/day-details";
import { DayReportsFeed } from "./day-reports-feed";

export async function DayReportsSection() {
  const page = await getDayReports();
  return <DayReportsFeed initialPage={page} />;
}
