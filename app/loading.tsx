import Image from "next/image";

function ParentNavigationPreview() {
  return (
    <nav
      aria-hidden="true"
      data-slot="startup-parent-navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-dark bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex h-16 items-center justify-around">
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg bg-gold/10 px-1 py-2 text-xs font-medium text-gold">
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
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span className="whitespace-nowrap text-charcoal">Přehled</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-medium text-charcoal-light">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="whitespace-nowrap">Omluvenka</span>
        </div>
      </div>
    </nav>
  );
}

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Načítání aplikace Habitat"
      aria-busy="true"
      style={{ backgroundColor: "#FDF8F3" }}
      className="min-h-screen min-h-dvh bg-[#FDF8F3] text-charcoal"
    >
      <header className="sticky top-0 z-40 border-b border-cream-dark bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Image
              src="/habitat-logo.webp"
              alt="Habitat"
              width={1232}
              height={400}
              preload
              className="h-8 w-auto"
            />
            <div
              aria-hidden="true"
              data-slot="startup-avatar-skeleton"
              className="h-10 w-10 shrink-0 rounded-full border border-gold/25 bg-cream-dark motion-safe:animate-pulse"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-6 lg:px-8">
        <div aria-hidden="true" className="motion-safe:animate-pulse">
          <div className="mb-6 space-y-2">
            <div className="h-7 w-40 rounded bg-cream-dark" />
            <div className="h-4 w-56 max-w-full rounded bg-cream-dark/70" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-40 rounded-xl border border-cream-dark bg-white p-6"
              >
                <div className="mb-5 h-5 w-32 rounded bg-cream-dark" />
                <div className="space-y-3">
                  <div className="h-4 rounded bg-cream-dark/70" />
                  <div className="h-4 w-4/5 rounded bg-cream-dark/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <ParentNavigationPreview />
    </div>
  );
}
