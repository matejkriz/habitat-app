"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

interface AvailableVersion {
  version: string;
  commitSha: string;
}

interface AppUpdateBannerProps {
  onUpdate?: () => void;
}

function isInstalledPwa(): boolean {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

function parseAvailableVersion(value: unknown): AvailableVersion | null {
  if (!value || typeof value !== "object") return null;

  const { version, commitSha } = value as Record<string, unknown>;
  if (
    typeof version !== "string" ||
    !/^\d{4}\.\d{2}\.\d{2}$/.test(version) ||
    typeof commitSha !== "string" ||
    !/^[a-f\d]{40}$/.test(commitSha)
  ) {
    return null;
  }

  return { version, commitSha };
}

function reloadPage() {
  window.location.reload();
}

export function AppUpdateBanner({
  onUpdate = reloadPage,
}: AppUpdateBannerProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const currentCommitSha = process.env.NEXT_PUBLIC_APP_COMMIT_SHA;
  const [availableVersion, setAvailableVersion] =
    useState<AvailableVersion | null>(null);
  const [dismissedCommitSha, setDismissedCommitSha] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!currentCommitSha || !isInstalledPwa()) return;

    let isActive = true;
    const checkForUpdate = async () => {
      try {
        const response = await fetch("/api/version", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;

        const latestVersion = parseAvailableVersion(await response.json());
        if (!isActive || !latestVersion) return;

        setAvailableVersion(
          latestVersion.commitSha === currentCommitSha ? null : latestVersion,
        );
      } catch {
        return;
      }
    };
    const checkWhenVisible = () => {
      if (document.visibilityState !== "hidden") void checkForUpdate();
    };

    void checkForUpdate();
    const intervalId = window.setInterval(
      checkWhenVisible,
      UPDATE_CHECK_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", checkWhenVisible);
    window.addEventListener("online", checkForUpdate);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.removeEventListener("online", checkForUpdate);
    };
  }, [currentCommitSha]);

  if (
    !availableVersion ||
    availableVersion.commitSha === dismissedCommitSha
  ) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Dostupná aktualizace"
      className="border-t border-gold-dark/20 bg-gold-light/90 text-charcoal shadow-habitat-sm backdrop-blur-sm animate-slide-down motion-reduce:animate-none"
    >
      <div className="mx-auto flex min-h-14 max-w-7xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 lg:px-8">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full bg-gold-dark shadow-[0_0_0_4px_rgb(184_146_63_/_0.16)]"
        />
        <p
          role="status"
          aria-live="polite"
          className="min-w-0 flex-1 text-sm font-semibold leading-tight"
        >
          Je dostupná nová verze.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          isLoading={isUpdating}
          onClick={() => { if (isUpdating) return; setIsUpdating(true); onUpdate(); }}
          className="shrink-0 border border-gold-dark/20 bg-white/60 px-2.5 text-xs shadow-sm hover:bg-white/90 sm:px-3 sm:text-sm"
        >
          {isUpdating ? "Aktualizuji…" : "Aktualizovat teď"}
        </Button>
        <button
          type="button"
          aria-label="Skrýt upozornění na aktualizaci"
          disabled={isUpdating}
          onClick={() => setDismissedCommitSha(availableVersion.commitSha)}
          className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg text-charcoal-light transition-colors hover:bg-white/50 hover:text-charcoal focus-visible:ring-2 focus-visible:ring-charcoal focus-visible:ring-offset-1"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
