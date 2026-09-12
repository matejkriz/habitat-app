import { getDayReports } from "@/app/actions/day-details";
import { getDbUser } from "@/lib/auth";
import { AddReportButton } from "@/components/days/report-dialog";
import { DayReportsFeed } from "./day-reports-feed";

export async function DayReportsSection() {
  const [page, user] = await Promise.all([getDayReports(), getDbUser()]);
  const canAddReport = user?.role === "TEACHER" || user?.role === "DIRECTOR";
  return (
    <DayReportsFeed initialPage={page}>
      {canAddReport && <AddReportButton />}
    </DayReportsFeed>
  );
}
