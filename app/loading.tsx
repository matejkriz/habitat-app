import Image from "next/image";

export default function Loading() {
  return (
    <main
      role="status"
      aria-label="Načítání aplikace Habitat"
      aria-busy="true"
      className="min-h-screen bg-cream px-4 py-6"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex h-16 items-center border-b border-cream-dark bg-white px-4 sm:px-6">
          <Image
            src="/habitat-logo.webp"
            alt="Habitat"
            width={1232}
            height={400}
            priority
            className="h-8 w-auto"
          />
        </div>

        <div aria-hidden="true" className="animate-pulse py-6">
          <div className="mb-6 space-y-2">
            <div className="h-7 w-40 rounded bg-cream-dark" />
            <div className="h-4 w-56 rounded bg-cream-dark/70" />
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
      </div>
    </main>
  );
}
