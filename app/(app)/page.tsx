import { redirect } from "next/navigation";
import { getDbUser } from "@/lib/auth";
import { getRoleDashboard } from "@/lib/auth-utils";

export default async function HomePage() {
  const user = await getDbUser();

  if (!user) {
    redirect("/login");
  }

  // Redirect to role-specific dashboard
  const dashboard = getRoleDashboard(user.role);
  redirect(dashboard);
}
