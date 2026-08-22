import { redirect } from "next/navigation";
import { getAttendanceCalendarMonth } from "@/app/actions/calendar";
import { getDbUser } from "@/lib/auth";
import { UserRole } from "@/lib/types";
import { AttendanceCalendar } from "./attendance-calendar";

export const metadata = {
  title: "Kalendář docházky",
};

function getCurrentMonthKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AttendanceCalendarPage() {
  const user = await getDbUser();
  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DIRECTOR)) {
    redirect("/login");
  }

  const initialMonth = await getAttendanceCalendarMonth(getCurrentMonthKey());

  return <AttendanceCalendar initialMonth={initialMonth} />;
}
