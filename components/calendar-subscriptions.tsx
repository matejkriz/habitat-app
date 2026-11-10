"use client";

import { useEffect, useRef, useState } from "react";
import { getCalendarSubscriptionLinks } from "@/app/actions/calendar-subscriptions";
import { Button } from "@/components/ui/button";

type Calendar = "habitat" | "jidelnicek";
type SubscriptionLinks = { habitat: string; jidelnicek: string };
const calendars = [
  { key: "habitat", name: "Habitat" },
  { key: "jidelnicek", name: "Habitat jídelníček" },
] as const;

export function CalendarSubscriptions() {
  const links = useRef<Promise<SubscriptionLinks> | null>(null);
  const copying = useRef(false);
  const [pending, setPending] = useState<Calendar | null>(null);
  const [copied, setCopied] = useState<Calendar | null>(null);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyLink(calendar: typeof calendars[number]) {
    if (copying.current) return;
    copying.current = true;
    setPending(calendar.key);
    setCopied(null);
    setError("");
    setFallback(null);
    const request = links.current ??= getCalendarSubscriptionLinks().catch(error => {
      links.current = null;
      throw error;
    });
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        // Start the clipboard write during the click, preserving Safari's user gesture
        // while the server action retrieves the personal subscription URL.
        const data = request.then(value => new Blob([value[calendar.key]], { type: "text/plain" }));
        void data.catch(() => {});
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": data })]);
      } else {
        await navigator.clipboard.writeText((await request)[calendar.key]);
      }
      setCopied(calendar.key);
    } catch {
      setError("Odkaz se nepodařilo zkopírovat.");
      try {
        setFallback({ name: calendar.name, url: (await request)[calendar.key] });
      } catch {
        // A failed server action is retried on the next click.
      }
    } finally {
      copying.current = false;
      setPending(null);
    }
  }

  return (
    <div>
      <div role="group" aria-label="Kalendáře k odběru" className="flex flex-wrap gap-2">
        {calendars.map(calendar => (
          <Button key={calendar.key} type="button" variant="outline" size="sm"
            aria-label={`Kopírovat odkaz na kalendář ${calendar.name}`}
            title={`Kopírovat odkaz na kalendář ${calendar.name}`}
            disabled={pending !== null} isLoading={pending === calendar.key}
            onClick={() => void copyLink(calendar)}>
            {pending !== calendar.key ? (
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
              </svg>
            ) : null}
            {copied === calendar.key ? "Zkopírováno" : calendar.name}
          </Button>
        ))}
        <span role="status" className="sr-only">{copied ? "Odkaz na kalendář je zkopírovaný." : ""}</span>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
      {fallback ? (
        <input readOnly value={fallback.url} aria-label={`Odkaz na kalendář ${fallback.name}`}
          ref={input => { if (input) { input.focus(); input.select(); } }}
          onFocus={event => event.currentTarget.select()}
          className="mt-2 block w-full min-w-0 rounded border border-cream-dark bg-white px-2 py-2 text-sm text-charcoal focus:outline-2 focus:outline-gold" />
      ) : null}
    </div>
  );
}
