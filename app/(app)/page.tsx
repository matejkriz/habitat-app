import { redirect } from "next/navigation";
import { getDbUser } from "@/lib/auth";
import { UserRole } from "@/lib/types";
import ParentDashboard from "./rodic/page";
import TeacherAttendancePage from "./ucitel/dochazka/page";
import DirectorDashboard from "./reditel/page";

interface HomePageProps {
  readonly searchParams: Promise<{ child?: string; month?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const user = await getDbUser();

  if (!user) {
    redirect("/login");
  }

  switch (user.role) {
    case UserRole.PARENT:
      return <ParentDashboard searchParams={searchParams} />;
    case UserRole.TEACHER:
      return <TeacherAttendancePage />;
    case UserRole.DIRECTOR:
      return <DirectorDashboard />;
  }
}
