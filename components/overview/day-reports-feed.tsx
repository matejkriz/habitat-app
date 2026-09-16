"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { getDayReports } from "@/app/actions/day-details";
import { ReportContent } from "@/components/days/report-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import styles from "./day-reports-feed.module.css";

type ReportsPage = Awaited<ReturnType<typeof getDayReports>>;
const dateFormat = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long", day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC",
});

export function DayReportsFeed({ initialPage, children }: { initialPage: ReportsPage; children?: ReactNode }) {
  const [source, setSource] = useState({ page: initialPage, version: 0 });
  if (source.page !== initialPage) setSource({ page: initialPage, version: source.version + 1 });

  return (
    <Card aria-labelledby="day-reports-title" className="min-w-0 p-4 sm:p-6">
      <CardHeader className="border-b border-cream-dark pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle id="day-reports-title">Reporty</CardTitle>
          {children}
        </div>
        <p className="text-sm text-charcoal-light">Co jsme spolu zažili.</p>
      </CardHeader>
      <CardContent>
        <ReportReader key={source.version} initialPage={initialPage} />
      </CardContent>
    </Card>
  );
}

function ReportReader({ initialPage }: { initialPage: ReportsPage }) {
  const [page, setPage] = useState(initialPage);
  const [index, setIndex] = useState(0);
  const [transition, setTransition] = useState<{ from: number; step: number; height: number } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const currentPanel = useRef<HTMLDivElement>(null);
  const previousPanel = useRef<HTMLDivElement>(null);
  const moving = useRef(false);
  const [failedCursor, setFailedCursor] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);
  const { reports, nextBefore } = page;
  const shouldLoad = reports.length > 0 && index >= reports.length - 2;
  const error = nextBefore !== null && failedCursor === nextBefore;
  const day = reports[index];

  // Load one page ahead so navigation can name the actual next record's date.
  useEffect(() => {
    if (!shouldLoad || nextBefore === null) return;
    let active = true;
    getDayReports(nextBefore).then(result => {
      if (!active) return;
      setPage(previous => {
        const known = new Set(previous.reports.map(report => report.date));
        return {
          reports: [...previous.reports, ...result.reports.filter(report => !known.has(report.date))],
          nextBefore: result.nextBefore !== null && result.nextBefore < nextBefore ? result.nextBefore : null,
        };
      });
    }).catch(() => { if (active) setFailedCursor(nextBefore); });
    return () => { active = false; };
  }, [shouldLoad, nextBefore, retry]);

  useLayoutEffect(() => {
    if (!transition || !viewport.current || !currentPanel.current || !previousPanel.current) return;
    const oldHeight = transition.height;
    const frame = viewport.current;
    const incoming = currentPanel.current;
    const outgoing = previousPanel.current;
    const animations: Animation[] = [];
    let cancelled = false;
    const distance = transition.step > 0 ? oldHeight : -incoming.getBoundingClientRect().height;
    const slide = { duration: 220, easing: "cubic-bezier(.2,.65,.3,1)", fill: "forwards" as const };

    async function run() {
      try {
        animations.push(
          outgoing.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-distance}px)` }], slide),
          incoming.animate([{ transform: `translateY(${distance}px)` }, { transform: "translateY(0)" }], slide),
        );
        await Promise.all(animations.map(animation => animation.finished));
        if (cancelled) return;
        outgoing.style.visibility = "hidden";
        // Measure after the slide so text wrapping or a loaded neighbor is included.
        const height = incoming.getBoundingClientRect().height;
        const resize = frame.animate([{ height: `${oldHeight}px` }, { height: `${height}px` }], {
          duration: 300, easing: "cubic-bezier(.25,.1,.25,1)", fill: "forwards",
        });
        animations.push(resize);
        await resize.finished;
      } catch {
        // Interrupted animations settle on the selected report instead of locking navigation.
      } finally {
        if (!cancelled) {
          moving.current = false;
          setTransition(null);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
      animations.forEach(animation => animation.cancel());
    };
  }, [transition]);

  useLayoutEffect(() => {
    if (navigated.current && !transition) heading.current?.focus({ preventScroll: true });
  }, [index, transition]);

  function navigate(step: number) {
    if (moving.current || !reports[index + step]) return;
    navigated.current = true;
    if (viewport.current && typeof viewport.current.animate === "function" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      moving.current = true;
      setTransition({ from: index, step, height: viewport.current.getBoundingClientRect().height });
    }
    setIndex(current => current + step);
  }

  if (!day) return <p className="py-8 text-center text-charcoal-light">Zatím nejsou k dispozici žádné reporty.</p>;

  function renderDay(at: number, outgoing = false) {
    const selected = reports[at];
    const newer = reports[at - 1];
    const older = reports[at + 1];
    const headingId = outgoing ? "previous-report-date" : "current-report-date";
    return <>
      {newer && <ReportNavigation date={newer.date} direction="newer" disabled={Boolean(transition)} onClick={() => navigate(-1)} />}
      <article aria-labelledby={headingId} className="py-7 sm:py-9">
        <header className="mb-6 space-y-2">
          <h4 ref={outgoing ? undefined : heading} tabIndex={-1} id={headingId} className={`${styles.date} text-sm font-bold text-charcoal-light`}>
            <time dateTime={new Date(selected.date).toISOString().slice(0, 10)}>{dateFormat.format(selected.date)}</time>
          </h4>
          {selected.name && <p className="text-2xl font-extrabold leading-tight text-charcoal sm:text-3xl">{selected.name}</p>}
        </header>
        <ReportContent content={selected.report} />
      </article>
      {older && <ReportNavigation date={older.date} direction="older" disabled={Boolean(transition)} onClick={() => navigate(1)} />}
      {!older && nextBefore !== null && (
        <div className="border-t border-cream-dark py-5 text-center">
          {error ? <>
            <p role="alert" className="mb-3 text-sm text-charcoal-light">Starší reporty se nepodařilo načíst.</p>
            <Button variant="outline" size="sm" disabled={Boolean(transition)} onClick={() => { setFailedCursor(null); setRetry(value => value + 1); }}>Zkusit znovu</Button>
          </> : <p role="status" className="text-sm text-charcoal-light">Načítání starších reportů…</p>}
        </div>
      )}
    </>;
  }

  return (
    <div ref={viewport} role="region" aria-label="Denní reporty" aria-busy={Boolean(transition)}
      className={`${styles.viewport} mx-auto max-w-[65ch]`}
      style={transition ? { height: transition.height, overflow: "clip" } : undefined}>
      {transition && <div ref={previousPanel} aria-hidden="true" inert className={styles.outgoing}>
        {renderDay(transition.from, true)}
      </div>}
      <div ref={currentPanel} data-report-panel="current">{renderDay(index)}</div>
    </div>
  );
}

function ReportNavigation({ date, direction, disabled, onClick }: { date: number; direction: "older" | "newer"; disabled: boolean; onClick: () => void }) {
  const older = direction === "older";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${older ? "Starší" : "Novější"} report: ${dateFormat.format(date)}`}
      className={`group flex w-full touch-manipulation items-center justify-center gap-3 py-4 text-left ${older ? "border-t" : "border-b"} border-cream-dark`}
    >
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-sage-light bg-cream transition-colors group-hover:border-sage-dark group-hover:bg-cream-dark">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d={older ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"} />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-charcoal-light">{older ? "Starší report" : "Novější report"}</span>
        <span className="block text-sm font-bold text-charcoal">{dateFormat.format(date)}</span>
      </span>
    </button>
  );
}
