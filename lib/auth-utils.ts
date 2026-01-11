import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getDbUser, type SessionUser } from "./auth";

/**
 * Get the current session on the server side
 * Returns null if not authenticated
 */
export async function getSession(): Promise<SessionUser | null> {
  return await getDbUser();
}

/**
 * Require authentication - redirects to login if not authenticated
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getDbUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Require a specific role - redirects if user doesn't have the required role
 */
export async function requireRole(
  requiredRole: UserRole | UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth();
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (!roles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    const dashboardRoutes: Record<string, string> = {
      PARENT: "/rodic",
      TEACHER: "/ucitel/dochazka",
      DIRECTOR: "/reditel",
    };
    redirect(dashboardRoutes[user.role] || "/");
  }

  return user;
}

/**
 * Check if user has a specific role (for conditional rendering)
 */
export async function hasRole(role: UserRole | UserRole[]): Promise<boolean> {
  const user = await getDbUser();
  if (!user) return false;

  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(user.role);
}

/**
 * Check if user is a director
 */
export async function isDirector(): Promise<boolean> {
  return hasRole(UserRole.DIRECTOR);
}

/**
 * Check if user is a teacher or director
 */
export async function isTeacherOrDirector(): Promise<boolean> {
  return hasRole([UserRole.TEACHER, UserRole.DIRECTOR]);
}

/**
 * Check if user is a parent
 */
export async function isParent(): Promise<boolean> {
  return hasRole(UserRole.PARENT);
}

/**
 * Get redirect path based on user role
 */
export function getRoleDashboard(role: UserRole): string {
  const dashboardRoutes: Record<UserRole, string> = {
    PARENT: "/rodic",
    TEACHER: "/ucitel/dochazka",
    DIRECTOR: "/reditel",
  };
  return dashboardRoutes[role];
}
