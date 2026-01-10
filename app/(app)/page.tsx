import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoleDashboard } from "@/lib/auth-utils";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Redirect to role-specific dashboard
  const dashboard = getRoleDashboard(session.user.role);
  redirect(dashboard);
}
