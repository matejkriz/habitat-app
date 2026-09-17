"use client";

import { useLinkStatus } from "next/link";

export function NavigationFeedback() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span role="status" className="pointer-events-none absolute inset-0 grid place-items-center rounded-[inherit] bg-cream/90">
      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-gold border-t-transparent motion-reduce:animate-none" />
      <span className="sr-only">Načítání…</span>
    </span>
  );
}
