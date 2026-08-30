"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/workos-client";
import { Avatar, Button } from "@/components/ui";
import { DevPersonaSwitcher } from "./dev-persona-switcher";
import { PushNotificationToggle } from "./push-notification-toggle";
import type { DevPersonaId } from "@/lib/dev-persona";
import type { UserRole } from "@/lib/types";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: UserRole;
    devPersonaId?: DevPersonaId;
  };
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavigationState {
  pathname: string;
  pendingHref: string | null;
}

const roleNavItems: Record<UserRole, NavItem[]> = {
  PARENT: [
    {
      href: "/rodic",
      label: "Přehled",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      href: "/rodic/omluvenka",
      label: "Omluvenka",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
  ],
  TEACHER: [
    {
      href: "/ucitel/dochazka",
      label: "Docházka",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
    {
      href: "/kalendar",
      label: "Kalendář",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ],
  DIRECTOR: [
    {
      href: "/reditel",
      label: "Přehled",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      ),
    },
    {
      href: "/ucitel/dochazka",
      label: "Docházka",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
    {
      href: "/kalendar",
      label: "Kalendář",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: "/reditel/obedy",
      label: "Obědy",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 3v7a2 2 0 002 2h1m0-9v18m9-18v18m0-18c2.21 0 4 2.239 4 5s-1.79 5-4 5"
          />
        </svg>
      ),
    },
    {
      href: "/reditel/omluvenky",
      label: "Omluvenky",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
  ],
};

const roleLabels: Record<UserRole, string> = {
  PARENT: "Rodič",
  TEACHER: "Učitel",
  DIRECTOR: "Ředitel",
};

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const navItems = roleNavItems[user.role];
  const { signOut } = useAuth();
  const [navigationState, setNavigationState] = useState<NavigationState>({
    pathname,
    pendingHref: null,
  });
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pendingHref =
    navigationState.pathname === pathname ? navigationState.pendingHref : null;
  const selectedHref = pendingHref ?? pathname;

  if (navigationState.pathname !== pathname) {
    setNavigationState({ pathname, pendingHref: null });
  }

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsUserMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isUserMenuOpen]);

  const handleSignOut = () => {
    setIsUserMenuOpen(false);
    void signOut({
      returnTo: new URL("/login", window.location.origin).toString(),
    });
  };

  const startNavigation = (href: string) => {
    if (href === pathname) return;
    setNavigationState({ pathname, pendingHref: href });
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-cream-dark sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/habitat-logo.webp"
                alt="Habitat"
                width={1232}
                height={400}
                className="h-8 w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  aria-current={pathname === item.href ? "page" : undefined}
                  aria-busy={pendingHref === item.href || undefined}
                  onNavigate={() => startNavigation(item.href)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    selectedHref === item.href
                      ? "bg-gold/10 text-gold"
                      : "text-charcoal-light hover:text-charcoal hover:bg-cream"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {user.devPersonaId && (
                <DevPersonaSwitcher currentPersonaId={user.devPersonaId} />
              )}
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-charcoal">
                  {user.name || user.email}
                </p>
                <p className="text-xs text-charcoal-light">
                  {roleLabels[user.role]}
                </p>
              </div>
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  aria-label="Otevřít uživatelské menu"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-controls="user-menu"
                  onClick={() => setIsUserMenuOpen((isOpen) => !isOpen)}
                  className="block rounded-full transition-shadow hover:ring-2 hover:ring-gold-light focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                >
                  <Avatar
                    name={user.name || user.email || "U"}
                    src={user.image}
                    size="md"
                  />
                </button>

                {isUserMenuOpen && (
                  <div
                    id="user-menu"
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-cream-dark bg-white p-2 shadow-habitat-lg animate-slide-down"
                  >
                    <div className="border-b border-cream-dark px-3 py-2 sm:hidden">
                      <p className="truncate text-sm font-semibold text-charcoal">
                        {user.name || user.email}
                      </p>
                      <p className="text-xs text-charcoal-light">
                        {roleLabels[user.role]}
                      </p>
                    </div>
                    {user.role === "DIRECTOR" && <PushNotificationToggle />}
                    <Button
                      role="menuitem"
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      className="mt-1 w-full justify-start sm:mt-0"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Odhlásit
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-cream-dark z-40">
        <div className="flex items-center justify-around h-16">
          {navItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-current={pathname === item.href ? "page" : undefined}
              aria-busy={pendingHref === item.href || undefined}
              onNavigate={() => startNavigation(item.href)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition-colors",
                selectedHref === item.href
                  ? "bg-gold/10 text-gold"
                  : "text-charcoal-light"
              )}
            >
              {item.icon}
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}
