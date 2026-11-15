"use client";

import { useEffect, useRef, useState } from "react";
import { getCalendarSubscriptionLinks } from "@/app/actions/calendar-subscriptions";
import { CalendarProviderIcon } from "@/components/calendar-provider-icon";
import { Button } from "@/components/ui/button";

type Calendar = "habitat" | "jidelnicek";
type SubscriptionLinks = { habitat: string; jidelnicek: string };
const calendars = [
  { key: "habitat", name: "Habitat", label: "Odebírat události" },
  { key: "jidelnicek", name: "Habitat jídelníček", label: "Odebírat jídelníček" },
] as const;

function menuAnchor(button: HTMLButtonElement, container: HTMLDivElement) {
  const bounds = button.getBoundingClientRect();
  const parent = container.getBoundingClientRect();
  const menuWidth = Math.min(288, window.innerWidth - 48);
  const left = Math.max(16, Math.min(bounds.left, window.innerWidth - menuWidth - 16));
  return { left: left - parent.left, top: bounds.bottom - parent.top };
}

export function CalendarSubscriptions() {
  const links = useRef<Promise<SubscriptionLinks> | null>(null);
  const copying = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });
  const [active, setActive] = useState<Calendar | null>(null);
  const [readyLinks, setReadyLinks] = useState<SubscriptionLinks | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    function dismiss(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setActive(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setActive(null); trigger.current?.focus(); }
    }
    function reposition() {
      if (trigger.current && container.current) setAnchor(menuAnchor(trigger.current, container.current));
    }
    window.addEventListener("resize", reposition);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [active]);

  function loadLinks() {
    return links.current ??= getCalendarSubscriptionLinks().catch(error => {
      links.current = null;
      throw error;
    });
  }

  async function openCalendar(calendar: Calendar, button: HTMLButtonElement) {
    trigger.current = button;
    if (active === calendar) { setActive(null); return; }
    setAnchor(menuAnchor(button, container.current!));
    setActive(calendar);
    setError("");
    setFallback(null);
    setLoading(true);
    try { setReadyLinks(await loadLinks()); }
    catch { setError("Odkazy se nepodařilo načíst. Zkuste odběr otevřít znovu."); }
    finally { setLoading(false); }
  }

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
    const request = loadLinks();
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

  const calendar = calendars.find(item => item.key === active);
  const url = active && readyLinks ? readyLinks[active] : null;
  // Google recognizes external subscriptions through the webcal scheme in cid.
  const webcalUrl = url?.replace(/^https?:/, "webcal:") ?? "";
  const optionClass = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-charcoal hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-gold";

  return (
    <div ref={container} className="relative w-fit max-w-full">
      <div role="group" aria-label="Kalendáře k odběru" className="flex gap-2">
        {calendars.map(calendar => (
          <Button key={calendar.key} type="button" variant="outline" size="sm" className={`h-auto min-h-11 flex-auto whitespace-normal py-2 text-charcoal ${active === calendar.key ? "bg-cream-dark" : ""}`}
            aria-expanded={active === calendar.key}
            aria-controls={active === calendar.key ? `calendar-options-${calendar.key}` : undefined}
            onClick={event => void openCalendar(calendar.key, event.currentTarget)}>
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
            </svg>
            <span className="min-w-0 text-left leading-tight">{calendar.label}</span>
            <svg aria-hidden="true" className={`h-3 w-3 ${active === calendar.key ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
          </Button>
        ))}
      </div>
      {calendar ? (
        <div id={`calendar-options-${calendar.key}`} role="group" aria-label={`Odběr kalendáře ${calendar.name}`}
          style={anchor}
          className="absolute z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl bg-white p-2 shadow-lg">
          {loading ? <p role="status" className="px-3 py-2 text-sm text-charcoal-light">Načítání odkazů…</p> : null}
          {!loading && url ? <>
            <a className={optionClass} href={webcalUrl}><CalendarProviderIcon provider="apple" />Apple Kalendář</a>
            <a className={optionClass} target="_blank" rel="noreferrer"
              href={`https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(webcalUrl)}`}><CalendarProviderIcon provider="google" />Google Kalendář</a>
            <a className={optionClass} target="_blank" rel="noreferrer"
              href={`https://outlook.live.com/calendar/0/addfromweb/?url=${encodeURIComponent(url)}&name=${encodeURIComponent(calendar.name)}`}><CalendarProviderIcon provider="outlook" />Outlook</a>
            <button type="button" disabled={pending !== null} className={`${optionClass} mt-1 border-t border-cream-dark`}
              onClick={() => void copyLink(calendar)}>{copied === calendar.key ? "Zkopírováno" : "Kopírovat odkaz"}</button>
          </> : null}
          {error ? <p role="alert" className="px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {fallback ? (
            <input readOnly value={fallback.url} aria-label={`Odkaz na kalendář ${fallback.name}`}
              ref={input => { if (input) { input.focus(); input.select(); } }}
              onFocus={event => event.currentTarget.select()}
              className="mt-2 block w-full min-w-0 rounded border border-cream-dark bg-white px-2 py-2 text-sm text-charcoal focus:outline-2 focus:outline-gold" />
          ) : null}
          <span role="status" className="sr-only">{copied === calendar.key ? "Odkaz na kalendář je zkopírovaný." : ""}</span>
        </div>
      ) : null}
    </div>
  );
}
