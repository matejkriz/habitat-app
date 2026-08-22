"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import {
  getAttendanceCalendarMonth,
  type AttendanceCalendarMonth,
} from "@/app/actions/calendar";
import type { AttendanceCalendarDay, CalendarChildDetail } from "@/lib/attendance-calendar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { PRESENT_CHILDREN_LABEL } from "@/lib/presence-label";

const WEEKDAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

function formatLongDate(dateKey: string): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function getCurrentMonthKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, amount: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = new Date(year, month - 1 + amount, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function getGridOffset(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  const sundayBasedDay = new Date(year, month - 1, 1).getDay();
  return (sundayBasedDay + 6) % 7;
}

function getWorkweekGridOffset(days: ReadonlyArray<AttendanceCalendarDay>): number {
  const firstWorkday = days.find((day) => {
    const weekday = new Date(`${day.dateKey}T12:00:00`).getDay();
    return weekday >= 1 && weekday <= 4;
  });
  if (!firstWorkday) return 0;
  return new Date(`${firstWorkday.dateKey}T12:00:00`).getDay() - 1;
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );
}

function CalendarDayButton({
  day,
  onOpen,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: {
  readonly day: AttendanceCalendarDay;
  readonly onOpen: () => void;
  readonly onHoverStart: (event: PointerEvent<HTMLButtonElement>) => void;
  readonly onHoverMove: (event: PointerEvent<HTMLButtonElement>) => void;
  readonly onHoverEnd: () => void;
}) {
  const statusLabel = day.isPast ? "přítomno" : "očekáváno";
  const accessibleStatus = day.isClosed
    ? day.closedReason || "zavřeno"
    : `${day.counts.expected} ${statusLabel}`;

  return (
    <button
      type="button"
      aria-label={`${formatLongDate(day.dateKey)}, ${accessibleStatus}`}
      onClick={onOpen}
      onPointerEnter={(event) => event.pointerType === "mouse" && onHoverStart(event)}
      onPointerMove={(event) => event.pointerType === "mouse" && onHoverMove(event)}
      onPointerLeave={onHoverEnd}
      onPointerCancel={onHoverEnd}
      className={cn(
        "group relative min-h-20 overflow-hidden rounded-lg border p-1.5 text-left transition-all sm:min-h-28 sm:p-2.5",
        "focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-gold",
        day.isClosed
          ? "border-cream-dark/70 bg-cream-dark/35 text-charcoal-light hover:bg-cream-dark/60"
          : "border-sage/20 bg-white hover:-translate-y-0.5 hover:border-sage/50 hover:shadow-md",
        day.isToday && "border-2 border-gold bg-gold/5 shadow-sm",
        !day.isClosed && !day.isResolved && day.isPast && "border-coral/40 bg-coral/5",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={cn(
            "flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-bold sm:text-sm",
            day.isToday ? "bg-gold text-charcoal" : "text-charcoal",
          )}
        >
          {day.dayNumber}
        </span>
        {day.isToday && (
          <span className="hidden rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-dark sm:block">
            Dnes
          </span>
        )}
      </div>

      {day.isClosed ? (
        <div className="mt-2 sm:mt-4">
          <span className="block text-[10px] font-semibold sm:text-xs">Zavřeno</span>
          {day.closedReason && (
            <span className="hidden truncate text-[10px] text-charcoal-light sm:block">
              {day.closedReason}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-1 sm:mt-2">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold leading-none text-sage-dark sm:text-3xl">
              {day.counts.expected}
            </span>
            <span className="hidden text-[10px] font-semibold text-charcoal-light sm:inline">
              {statusLabel}
            </span>
          </div>
          <div className="mt-1 min-h-4 text-[9px] leading-tight text-charcoal-light sm:text-[11px]">
            {day.isToday && `${day.counts.present} dorazilo · ${day.counts.waiting} čekáme`}
            {day.isFuture && day.counts.excused > 0 && `${day.counts.excused} omluveno`}
            {day.isPast && day.counts.unknown > 0 && (
              <span className="font-semibold text-coral-dark">{day.counts.unknown} bez zápisu</span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

function PreviewChildList({
  title,
  items,
  tone,
}: {
  readonly title: string;
  readonly items: ReadonlyArray<CalendarChildDetail>;
  readonly tone: "gold" | "coral" | "neutral";
}) {
  if (items.length === 0) return null;

  const toneClasses = {
    gold: "text-gold-dark",
    coral: "text-coral-dark",
    neutral: "text-charcoal-light",
  };
  const visibleItems = items.slice(0, 3);

  return (
    <div>
      <p className={cn("text-[11px] font-extrabold uppercase tracking-wide", toneClasses[tone])}>
        {title} · {items.length}
      </p>
      <div className="mt-1 space-y-1">
        {visibleItems.map((child) => (
          <div key={child.childId} className="text-xs leading-snug text-charcoal">
            <span className="font-semibold">{child.name}</span>
            {child.reason && <span className="text-charcoal-light"> · {child.reason}</span>}
          </div>
        ))}
        {items.length > visibleItems.length && (
          <p className="text-[11px] font-semibold text-charcoal-light">
            + {items.length - visibleItems.length} další
          </p>
        )}
      </div>
    </div>
  );
}

function DayHoverPreview({
  day,
  left,
  top,
}: {
  readonly day: AttendanceCalendarDay;
  readonly left: number;
  readonly top: number;
}) {
  const hasExceptions =
    day.children.waiting.length > 0 ||
    day.children.excused.length > 0 ||
    day.children.unexcused.length > 0 ||
    day.children.unknown.length > 0;

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-40 w-72 overflow-hidden rounded-xl border border-sage/20 bg-white shadow-2xl"
      style={{ left, top }}
    >
      <div className="border-b border-cream-dark bg-cream/60 px-4 py-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold-dark">
          Rychlý přehled
        </p>
        <p className="mt-0.5 text-sm font-extrabold capitalize text-charcoal">
          {formatLongDate(day.dateKey)}
        </p>
      </div>

      {day.isClosed ? (
        <div className="px-4 py-4">
          <p className="text-sm font-bold text-charcoal">Habitat má zavřeno</p>
          <p className="mt-1 text-xs text-charcoal-light">
            {day.closedReason || "V tento den neprobíhá výuka."}
          </p>
        </div>
      ) : (
        <div className="px-4 py-3.5">
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg bg-sage/10 px-1 py-2">
              <p className="text-lg font-extrabold leading-none text-sage-dark">{day.counts.expected}</p>
              <p className="mt-1 text-[9px] text-charcoal-light">očekáváme</p>
            </div>
            <div className="rounded-lg bg-sage/10 px-1 py-2">
              <p className="text-lg font-extrabold leading-none text-sage-dark">{day.counts.present}</p>
              <p className="mt-1 text-[9px] text-charcoal-light">dorazilo</p>
            </div>
            <div className="rounded-lg bg-gold/10 px-1 py-2">
              <p className="text-lg font-extrabold leading-none text-gold-dark">{day.counts.waiting}</p>
              <p className="mt-1 text-[9px] text-charcoal-light">čekáme</p>
            </div>
            <div className="rounded-lg bg-coral/10 px-1 py-2">
              <p className="text-lg font-extrabold leading-none text-coral-dark">
                {day.counts.excused + day.counts.unexcused}
              </p>
              <p className="mt-1 text-[9px] text-charcoal-light">nedorazí</p>
            </div>
          </div>

          {hasExceptions ? (
            <div className="mt-3 max-h-52 space-y-2.5 overflow-hidden border-t border-cream-dark pt-3">
              <PreviewChildList title="Ještě čekáme" items={day.children.waiting} tone="gold" />
              <PreviewChildList title="Omluvené" items={day.children.excused} tone="gold" />
              <PreviewChildList title="Bez omluvenky" items={day.children.unexcused} tone="coral" />
              <PreviewChildList title="Bez zápisu" items={day.children.unknown} tone="neutral" />
            </div>
          ) : (
            <p className="mt-3 border-t border-cream-dark pt-3 text-xs text-charcoal-light">
              {day.isFuture ? "Zatím bez omluvenek." : "Všechny záznamy jsou vyřešené."}
            </p>
          )}

          <p className="mt-3 text-[10px] font-semibold text-charcoal-light">
            Kliknutím otevřete celý detail dne
          </p>
        </div>
      )}
    </div>
  );
}

function ChildList({
  title,
  items,
  tone,
}: {
  readonly title: string;
  readonly items: ReadonlyArray<CalendarChildDetail>;
  readonly tone: "sage" | "gold" | "coral" | "neutral";
}) {
  if (items.length === 0) return null;

  const toneClasses = {
    sage: "bg-sage/10 text-sage-dark",
    gold: "bg-gold/10 text-gold-dark",
    coral: "bg-coral/10 text-coral-dark",
    neutral: "bg-cream-dark/60 text-charcoal-light",
  };

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", toneClasses[tone])}>
          {items.length}
        </span>
        <h3 className="text-sm font-bold text-charcoal">{title}</h3>
      </div>
      <div className="space-y-1.5">
        {items.map((child) => (
          <div key={child.childId} className="rounded-lg bg-cream px-3 py-2">
            <p className="text-sm font-semibold text-charcoal">{child.name}</p>
            {child.reason && <p className="text-xs text-charcoal-light">{child.reason}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function DayDetailModal({ day, onClose }: { day: AttendanceCalendarDay; onClose: () => void }) {
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-day-title"
        className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-cream-dark px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-dark">Přehled dne</p>
            <h2 id="attendance-day-title" className="mt-1 text-xl font-extrabold capitalize text-charcoal">
              {formatLongDate(day.dateKey)}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Zavřít přehled dne"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-charcoal-light transition-colors hover:bg-cream-dark hover:text-charcoal"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {day.isClosed ? (
            <div className="rounded-xl bg-cream-dark/60 p-5 text-center">
              <p className="font-bold text-charcoal">Habitat má zavřeno</p>
              <p className="mt-1 text-sm text-charcoal-light">
                {day.closedReason || "V tento den neprobíhá výuka."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-sage/10 p-3 text-center">
                  <p className="text-2xl font-extrabold text-sage-dark">{day.counts.expected}</p>
                  <p className="text-xs text-charcoal-light">
                    {day.isPast ? PRESENT_CHILDREN_LABEL : "Očekávané děti"}
                  </p>
                </div>
                <div className="rounded-xl bg-sage/10 p-3 text-center">
                  <p className="text-2xl font-extrabold text-sage-dark">{day.counts.present}</p>
                  <p className="text-xs text-charcoal-light">Dorazilo</p>
                </div>
                <div className="rounded-xl bg-gold/10 p-3 text-center">
                  <p className="text-2xl font-extrabold text-gold-dark">{day.counts.waiting}</p>
                  <p className="text-xs text-charcoal-light">Čekáme</p>
                </div>
                <div className="rounded-xl bg-coral/10 p-3 text-center">
                  <p className="text-2xl font-extrabold text-coral-dark">
                    {day.counts.excused + day.counts.unexcused}
                  </p>
                  <p className="text-xs text-charcoal-light">Nedorazí</p>
                </div>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <ChildList title="Čekáme na příchod" items={day.children.waiting} tone="gold" />
                <ChildList title="Očekáváme" items={day.children.expected} tone="sage" />
                <ChildList title="Přítomné děti" items={day.children.present} tone="sage" />
                <ChildList title="Omluvené děti" items={day.children.excused} tone="gold" />
                <ChildList title="Nepřítomné bez omluvenky" items={day.children.unexcused} tone="coral" />
                <ChildList title="Bez zápisu" items={day.children.unknown} tone="neutral" />
              </div>
            </>
          )}
        </div>

        <footer className="border-t border-cream-dark p-4 sm:flex sm:justify-end sm:px-6">
          <Button
            className="h-12 w-full sm:w-auto"
            onClick={() => router.push(`/ucitel/dochazka?date=${day.dateKey}`)}
          >
            Otevřít den v Docházce
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </footer>
      </div>
    </div>
  );
}

export function AttendanceCalendar({ initialMonth }: { initialMonth: AttendanceCalendarMonth }) {
  const [calendar, setCalendar] = useState(initialMonth);
  const [selectedDay, setSelectedDay] = useState<AttendanceCalendarDay | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{
    day: AttendanceCalendarDay;
    left: number;
    top: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const gridOffset = useMemo(() => getGridOffset(calendar.monthKey), [calendar.monthKey]);
  const workweekDays = useMemo(
    () => calendar.days.filter((day) => {
      const weekday = new Date(`${day.dateKey}T12:00:00`).getDay();
      return weekday >= 1 && weekday <= 4;
    }),
    [calendar.days],
  );
  const workweekGridOffset = useMemo(() => getWorkweekGridOffset(workweekDays), [workweekDays]);
  const today = calendar.days.find((day) => day.isToday);

  async function loadMonth(monthKey: string) {
    setHoverPreview(null);
    setIsLoading(true);
    setError("");
    try {
      setCalendar(await getAttendanceCalendarMonth(monthKey));
    } catch {
      setError("Kalendář se nepodařilo načíst. Zkuste to prosím znovu.");
    } finally {
      setIsLoading(false);
    }
  }

  function getPreviewPosition(event: PointerEvent<HTMLButtonElement>) {
    const previewWidth = 288;
    const previewHeight = 340;
    const offset = 14;
    const edge = 12;
    const fitsRight = event.clientX + offset + previewWidth <= window.innerWidth - edge;
    const fitsBelow = event.clientY + offset + previewHeight <= window.innerHeight - edge;

    return {
      left: Math.max(edge, fitsRight ? event.clientX + offset : event.clientX - previewWidth - offset),
      top: Math.max(edge, fitsBelow ? event.clientY + offset : event.clientY - previewHeight - offset),
    };
  }

  function showHoverPreview(day: AttendanceCalendarDay, event: PointerEvent<HTMLButtonElement>) {
    setHoverPreview({ day, ...getPreviewPosition(event) });
  }

  function openDay(day: AttendanceCalendarDay) {
    setHoverPreview(null);
    setSelectedDay(day);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-charcoal sm:text-3xl">Kalendář docházky</h1>
          <p className="mt-1 max-w-2xl text-sm text-charcoal-light sm:text-base">
            Rychlý přehled očekávané účasti pro plánování programu a obědů.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-charcoal-light">
          <span className="h-2.5 w-2.5 rounded-full bg-sage" /> očekáváme
          <span className="ml-2 h-2.5 w-2.5 rounded-full bg-coral" /> chybí zápis
        </div>
      </div>

      {today && (
        <button
          type="button"
          onClick={() => openDay(today)}
          className="grid w-full grid-cols-3 gap-2 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/10 via-white to-sage/10 p-4 text-left shadow-sm transition-shadow hover:shadow-md sm:grid-cols-[1.2fr_repeat(3,1fr)] sm:items-center sm:p-5"
        >
          <div className="col-span-3 mb-1 sm:col-span-1 sm:mb-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-gold-dark">Dnes</p>
            <p className="mt-0.5 font-bold capitalize text-charcoal">{formatLongDate(today.dateKey)}</p>
          </div>
          {today.isClosed ? (
            <div className="col-span-3">
              <p className="text-lg font-extrabold text-charcoal">Habitat má dnes zavřeno</p>
              <p className="text-xs text-charcoal-light">{today.closedReason || "Dnes neprobíhá výuka."}</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-2xl font-extrabold text-sage-dark">{today.counts.expected}</p>
                <p className="text-xs text-charcoal-light">očekáváme</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-sage-dark">{today.counts.present}</p>
                <p className="text-xs text-charcoal-light">dorazilo</p>
              </div>
              <div>
                <p className={cn("text-2xl font-extrabold", today.counts.waiting ? "text-gold-dark" : "text-sage-dark")}>
                  {today.counts.waiting}
                </p>
                <p className="text-xs text-charcoal-light">ještě čekáme</p>
              </div>
            </>
          )}
        </button>
      )}

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-cream-dark px-3 py-3 sm:px-5">
          <button
            type="button"
            aria-label="Předchozí měsíc"
            onClick={() => loadMonth(shiftMonth(calendar.monthKey, -1))}
            disabled={isLoading}
            className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-cream disabled:opacity-50"
          >
            <ChevronIcon direction="left" />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-extrabold capitalize text-charcoal sm:text-xl">
              {formatMonth(calendar.monthKey)}
            </h2>
            {calendar.monthKey !== getCurrentMonthKey() && (
              <button
                type="button"
                onClick={() => loadMonth(getCurrentMonthKey())}
                className="mt-0.5 text-xs font-bold text-gold-dark hover:underline"
              >
                Zpět na dnešek
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Další měsíc"
            onClick={() => loadMonth(shiftMonth(calendar.monthKey, 1))}
            disabled={isLoading}
            className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-cream disabled:opacity-50"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>

        {error && (
          <div role="alert" className="m-3 rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral-dark sm:m-5">
            {error}
          </div>
        )}

        <div className={cn("relative p-2 sm:p-4", isLoading && "pointer-events-none opacity-55")}>
          <div className="mb-1 grid grid-cols-4 gap-1 sm:hidden">
            {WEEKDAYS.slice(0, 4).map((weekday) => (
              <div key={weekday} className="py-1 text-center text-[10px] font-extrabold uppercase tracking-wide text-charcoal-light">
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1 sm:hidden">
            {Array.from({ length: workweekGridOffset }, (_, index) => (
              <div key={`mobile-empty-${index}`} aria-hidden="true" />
            ))}
            {workweekDays.map((day) => (
              <CalendarDayButton
                key={`mobile-${day.dateKey}`}
                day={day}
                onOpen={() => openDay(day)}
                onHoverStart={(event) => showHoverPreview(day, event)}
                onHoverMove={(event) => showHoverPreview(day, event)}
                onHoverEnd={() => setHoverPreview(null)}
              />
            ))}
          </div>
          <div className="mb-1 hidden grid-cols-7 gap-2 sm:grid">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-1 text-center text-xs font-extrabold uppercase tracking-wide text-charcoal-light">
                {weekday}
              </div>
            ))}
          </div>
          <div className="hidden grid-cols-7 gap-2 sm:grid">
            {Array.from({ length: gridOffset }, (_, index) => (
              <div key={`empty-${index}`} aria-hidden="true" />
            ))}
            {calendar.days.map((day) => (
              <CalendarDayButton
                key={day.dateKey}
                day={day}
                onOpen={() => openDay(day)}
                onHoverStart={(event) => showHoverPreview(day, event)}
                onHoverMove={(event) => showHoverPreview(day, event)}
                onHoverEnd={() => setHoverPreview(null)}
              />
            ))}
          </div>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center" aria-live="polite">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-gold border-t-transparent" />
              <span className="sr-only">Načítám kalendář</span>
            </div>
          )}
        </div>
      </section>

      <p className="text-center text-xs text-charcoal-light">
        Na počítači přejeďte přes den pro rychlý náhled, kliknutím otevřete detail. Na telefonu
        klepněte na den.
      </p>

      {hoverPreview && (
        <DayHoverPreview
          day={hoverPreview.day}
          left={hoverPreview.left}
          top={hoverPreview.top}
        />
      )}
      {selectedDay && <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />}
    </div>
  );
}
