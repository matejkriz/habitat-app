"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import type { ParentCalendarDay, ParentCalendarStatus } from "@/lib/parent-calendar";
import type { ChildGender } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AttendanceCalendarProps {
  readonly childId: string;
  readonly childName: string;
  readonly childGender: ChildGender | null;
  readonly month: string;
  readonly days: ReadonlyArray<ParentCalendarDay>;
}

const WEEKDAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

type StatusDetails = Record<
  ParentCalendarStatus,
  { label: string; shortLabel: string; className: string; dotClassName: string }
>;

function getStatusDetails(gender: ChildGender | null): StatusDetails {
  const presentLabel = gender === "FEMALE" ? "Přišla" : gender === "MALE" ? "Přišel" : "Přítomnost zapsána";
  const excusedLabel = gender === "FEMALE" ? "Omluvena" : gender === "MALE" ? "Omluven" : "Omluva přijata";
  const lateExcuseLabel = gender === "FEMALE" ? "Omluvena pozdě" : gender === "MALE" ? "Omluven pozdě" : "Pozdní omluva";

  return {
  EXPECTED: {
    label: "Přijde",
    shortLabel: "Přijde",
    className: "bg-sage/10 text-sage-dark hover:bg-sage/20",
    dotClassName: "bg-sage",
  },
  PARTIAL: {
    label: "Částečná omluvenka",
    shortLabel: "Část dne",
    className: "bg-gold/15 text-gold-dark hover:bg-gold/25",
    dotClassName: "bg-gold",
  },
  PRESENT: {
    label: presentLabel,
    shortLabel: presentLabel,
    className: "bg-sage/20 text-sage-dark hover:bg-sage/30",
    dotClassName: "bg-sage-dark",
  },
  EXCUSED: {
    label: excusedLabel,
    shortLabel: excusedLabel,
    className: "bg-info/12 text-[#527b91] hover:bg-info/20",
    dotClassName: "bg-info",
  },
  PENDING: {
    label: lateExcuseLabel,
    shortLabel: lateExcuseLabel,
    className: "bg-gold/15 text-gold-dark hover:bg-gold/25",
    dotClassName: "bg-gold",
  },
  UNEXCUSED: {
    label: "Bez omluvy",
    shortLabel: "Bez omluvy",
    className: "bg-coral/20 text-coral-dark hover:bg-coral/30",
    dotClassName: "bg-coral-dark",
  },
  MISSING: {
    label: "Docházka nezapsána",
    shortLabel: "Bez záznamu",
    className: "bg-cream-dark/45 text-charcoal-light hover:bg-cream-dark/65",
    dotClassName: "bg-charcoal/45",
  },
  CLOSED: {
    label: "Volno",
    shortLabel: "Volno",
    className: "bg-[#f3f3f1] text-[#92928d] opacity-65",
    dotClassName: "bg-[#b6b6b0]",
  },
  };
}

function monthDate(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fullDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day));
}

export function AttendanceCalendar({ childId, childName, childGender, month, days }: AttendanceCalendarProps) {
  const router = useRouter();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const statusDetails = getStatusDetails(childGender);
  const firstDay = monthDate(month);
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
  const title = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(
    firstDay,
  );

  const openExcuse = (date: string) => {
    router.push(`/rodic/omluvenka?child=${encodeURIComponent(childId)}&date=${date}`);
  };

  const moveMonth = (offset: number) => {
    const nextMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + offset, 1);
    router.push(`/rodic?child=${encodeURIComponent(childId)}&month=${monthKey(nextMonth)}`);
  };

  const startLongPress = (date: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      navigator.vibrate?.(12);
      openExcuse(date);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  return (
    <Card className="overflow-hidden p-0" aria-labelledby="attendance-calendar-title">
      <div className="flex flex-col gap-4 border-b border-cream-dark px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-gold-dark">
            Docházka · {childName}
          </p>
          <h2 id="attendance-calendar-title" className="text-2xl font-bold capitalize text-charcoal">
            {title}
          </h2>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="grid size-11 place-items-center rounded-full border border-cream-dark bg-white text-charcoal transition hover:border-gold hover:bg-gold/10"
            aria-label="Předchozí měsíc"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="grid size-11 place-items-center rounded-full border border-cream-dark bg-white text-charcoal transition hover:border-gold hover:bg-gold/10"
            aria-label="Následující měsíc"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="px-2 py-3 sm:px-5 sm:py-5">
        <div className="mb-1 grid grid-cols-7" aria-hidden="true">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="py-2 text-center text-[11px] font-bold uppercase tracking-wide text-charcoal-light sm:text-xs">
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2" aria-label={title}>
          {Array.from({ length: leadingEmptyDays }, (_, index) => (
            <div key={`empty-${index}`} className="min-h-16 sm:min-h-24" aria-hidden="true" />
          ))}
          {days.map((day) => {
            const baseDetails = statusDetails[day.status];
            const partialLabel =
              day.status === "PARTIAL"
                ? day.absencePart === "MORNING"
                  ? "Chybí dopoledne"
                  : "Chybí odpoledne"
                : null;
            const details = partialLabel
              ? { ...baseDetails, label: partialLabel, shortLabel: partialLabel }
              : baseDetails;
            const disabled = day.status === "CLOSED";
            return (
              <button
                key={day.date}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (longPressTriggered.current) {
                    longPressTriggered.current = false;
                    return;
                  }
                  openExcuse(day.date);
                }}
                onPointerDown={() => startLongPress(day.date)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(event) => event.preventDefault()}
                aria-label={`${fullDateLabel(day.date)}, ${details.label}${disabled ? "" : ", zadat omluvenku"}`}
                className={cn(
                  "relative flex min-h-16 touch-manipulation select-none flex-col items-center justify-between rounded-lg p-1.5 text-left transition active:scale-[0.97] sm:min-h-24 sm:items-stretch sm:p-2.5",
                  details.className,
                  disabled && "cursor-default active:scale-100",
                  day.isToday && "ring-2 ring-gold ring-offset-2",
                )}
              >
                <span className="text-sm font-extrabold sm:text-base">{day.dayNumber}</span>
                <span className="flex flex-col items-center gap-1 sm:items-start">
                  <span className={cn("size-2 rounded-full sm:hidden", details.dotClassName)} />
                  <span className="hidden text-[11px] font-bold leading-tight sm:block">
                    {details.shortLabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-cream-dark bg-cream/50 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {(Object.entries(statusDetails) as Array<
            [ParentCalendarStatus, (typeof statusDetails)[ParentCalendarStatus]]
          >).map(([status, details]) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal-light">
              <span className={cn("size-2 rounded-full", details.dotClassName)} />
              {details.label}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
