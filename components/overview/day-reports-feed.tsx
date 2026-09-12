"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getDayReports } from "@/app/actions/day-details";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDateWithWeekday } from "@/lib/utils";

type ReportsPage = Awaited<ReturnType<typeof getDayReports>>;

export function DayReportsFeed({ initialPage, children }: { initialPage: ReportsPage; children?: ReactNode }) {
  const [pages, setPages] = useState<ReportsPage[]>([]);
  const [previousPage, setPreviousPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const reports = [initialPage, ...pages].flatMap(page => page.reports);
  if (initialPage !== previousPage) {
    setPreviousPage(initialPage);
    setPages([]);
  }
  const nextBefore = pages.length ? pages[pages.length - 1].nextBefore : initialPage.nextBefore;

  const loadMore = useCallback(async () => {
    if (inFlight.current || nextBefore === null) return;
    inFlight.current = true;
    setLoading(true);
    setError(false);
    try {
      const page = await getDayReports(nextBefore);
      setPages(previous => [...previous, page]);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [nextBefore]);

  useEffect(() => {
    if (!sentinel.current || nextBefore === null || error) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadMore();
    }, { root: viewport.current, rootMargin: "100px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loadMore, nextBefore, error]);

  return (
    <Card aria-labelledby="day-reports-title">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle id="day-reports-title">Reporty</CardTitle>
          {children}
        </div>
        <p className="text-sm text-charcoal-light">Zprávy z jednotlivých dní, od nejnovějších.</p>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <p className="py-8 text-center text-charcoal-light">Zatím nejsou k dispozici žádné reporty.</p>
        ) : (
          <div
            ref={viewport}
            role="region"
            aria-label="Denní reporty"
            tabIndex={0}
            className="h-[28rem] max-h-[65dvh] overflow-y-auto overscroll-contain rounded-lg pr-3 focus-visible:outline-2 focus-visible:outline-gold"
          >
            <div className="divide-y divide-cream-dark">
              {reports.map(day => (
                <article key={day.date} className="py-5 first:pt-0">
                  <h4 className="font-bold text-charcoal">{formatDateWithWeekday(new Date(day.date))}</h4>
                  {day.name && <p className="mt-1 font-semibold text-gold-dark">{day.name}</p>}
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-charcoal">{day.report}</p>
                </article>
              ))}
            </div>
            {nextBefore !== null && (
              <div ref={sentinel} className="py-4 text-center">
                {error && <p role="alert" className="mb-2 text-sm text-coral-dark">Reporty se nepodařilo načíst.</p>}
                <Button variant="outline" size="sm" disabled={loading} onClick={() => void loadMore()}>
                  {loading ? "Načítání…" : error ? "Zkusit znovu" : "Načíst starší reporty"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
