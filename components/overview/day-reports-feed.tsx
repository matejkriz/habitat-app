"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const [direction, setDirection] = useState<"older" | "newer">("older");
  const [failedCursor, setFailedCursor] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);
  const { reports, nextBefore } = page;
  const shouldLoad = reports.length > 0 && index >= reports.length - 2;
  const error = nextBefore !== null && failedCursor === nextBefore;
  const day = reports[index];
  const newer = reports[index - 1];
  const older = reports[index + 1];

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

  useEffect(() => {
    if (!navigated.current) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [index]);

  function navigate(step: number) {
    navigated.current = true;
    setDirection(step > 0 ? "older" : "newer");
    setIndex(current => current + step);
  }

  if (!day) return <p className="py-8 text-center text-charcoal-light">Zatím nejsou k dispozici žádné reporty.</p>;

  return (
    <div className="mx-auto max-w-[65ch]">
      {newer && <ReportNavigation date={newer.date} direction="newer" onClick={() => navigate(-1)} />}
      <article key={day.date} aria-labelledby="current-report-date" data-direction={direction} className={`${styles.report} py-7 sm:py-9`}>
        <header className="mb-6 space-y-2">
          <h4 ref={heading} tabIndex={-1} id="current-report-date" className="scroll-mt-24 text-sm font-bold text-charcoal-light focus:outline-none">
            <time dateTime={new Date(day.date).toISOString().slice(0, 10)}>{dateFormat.format(day.date)}</time>
          </h4>
          {day.name && <p className="text-2xl font-extrabold leading-tight text-charcoal sm:text-3xl">{day.name}</p>}
          <div aria-hidden="true" className="h-1 w-10 rounded-full bg-gold" />
        </header>
        <ReportContent content={day.report} />
      </article>
      {older && <ReportNavigation date={older.date} direction="older" onClick={() => navigate(1)} />}
      {!older && nextBefore !== null && (
        <div className="border-t border-cream-dark py-5 text-center">
          {error ? <>
            <p role="alert" className="mb-3 text-sm text-charcoal-light">Starší reporty se nepodařilo načíst.</p>
            <Button variant="outline" size="sm" onClick={() => { setFailedCursor(null); setRetry(value => value + 1); }}>Zkusit znovu</Button>
          </> : <p role="status" className="text-sm text-charcoal-light">Načítání starších reportů…</p>}
        </div>
      )}
    </div>
  );
}

function ReportNavigation({ date, direction, onClick }: { date: number; direction: "older" | "newer"; onClick: () => void }) {
  const older = direction === "older";
  return (
    <button
      type="button"
      onClick={onClick}
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
