import { redirect } from "next/navigation";
import { getDbUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { getParentChildren } from "@/app/actions/parent";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getDbUser();

  if (!user) {
    redirect("/login");
  }

  const canSubmitMakeup = user.role === "PARENT" && (await getParentChildren()).some(
    (child) => child.attendanceDays !== undefined && child.attendanceDays.length < 4,
  );

  return <AppShell user={user} canSubmitMakeup={canSubmitMakeup}>{children}</AppShell>;
}
