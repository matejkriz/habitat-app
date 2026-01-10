import { auth } from "./auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

/**
 * Get the current session on the server side
 * Returns null if not authenticated
 */
export async function getSession() {
  return await auth();
}

/**
 * Require authentication - redirects to login if not authenticated
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Require a specific role - redirects if user doesn't have the required role
 */
export async function requireRole(requiredRole: UserRole | UserRole[]) {
  const session = await requireAuth();
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (!roles.includes(session.user.role)) {
    // Redirect to appropriate dashboard based on role
    const dashboardRoutes: Record<string, string> = {
      PARENT: "/rodic",
      TEACHER: "/ucitel/dochazka",
      DIRECTOR: "/reditel",
    };
    redirect(dashboardRoutes[session.user.role] || "/");
  }

  return session;
}

/**
 * Check if user has a specific role (for conditional rendering)
 */
export async function hasRole(role: UserRole | UserRole[]) {
  const session = await auth();
  if (!session?.user) return false;

  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(session.user.role);
}

/**
 * Check if user is a director
 */
export async function isDirector() {
  return hasRole(UserRole.DIRECTOR);
}

/**
 * Check if user is a teacher or director
 */
export async function isTeacherOrDirector() {
  return hasRole([UserRole.TEACHER, UserRole.DIRECTOR]);
}

/**
 * Check if user is a parent
 */
export async function isParent() {
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
