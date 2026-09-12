"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getExcuseCalendarMonth } from "@/app/actions/calendar";
import { isDefaultClosedDay, toLocalDateKey } from "@/lib/school-calendar";
import { cn } from "@/lib/utils";

type ExcuseDatePickerProps = {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly min?: string;
  readonly max?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
};

const weekdays = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

const fullDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const inputDateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("cs-CZ", {
  month: "long",
  year: "numeric",
});

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function getMonthKey(value: string): string {
  const date = parseDateKey(value) ?? new Date();
  return toLocalDateKey(new Date(date.getFullYear(), date.getMonth(), 1)).slice(0, 7);
}

function parseMonthKey(monthKey: string): { year: number; monthIndex: number } {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

function shiftMonth(monthKey: string, amount: number): string {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return toLocalDateKey(new Date(year, monthIndex + amount, 1)).slice(0, 7);
}

function buildMonthDays(monthKey: string): ReadonlyArray<Date> {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => new Date(year, monthIndex, index + 1));
}

export function ExcuseDatePicker({
  label,
  name,
  value,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
}: ExcuseDatePickerProps) {
  const generatedId = useId();
  const inputId = `excuse-date-${generatedId.replace(/:/g, "")}`;
  const dialogId = `${inputId}-dialog`;
  const rootRef = useRef<HTMLDivElement>(null);
  const availabilityCache = useRef(new Map<string, ReadonlySet<string>>());
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthKey(value));
  const [availability, setAvailability] = useState<{
    readonly monthKey: string;
    readonly closedDateKeys: ReadonlySet<string>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const firstDayOffset = days.length === 0 ? 0 : (days[0].getDay() + 6) % 7;
  const selectedDate = parseDateKey(value);
  const availabilityReady = availability?.monthKey === visibleMonth;

  useEffect(() => {
    if (!isOpen) return;

    const cached = availabilityCache.current.get(visibleMonth);
    if (cached) {
      setAvailability({ monthKey: visibleMonth, closedDateKeys: cached });
      setLoadError("");
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setLoadError("");
    void getExcuseCalendarMonth(visibleMonth)
      .then((calendar) => {
        if (!active) return;
        const closedDateKeys = new Set(calendar.closedDateKeys);
        availabilityCache.current.set(visibleMonth, closedDateKeys);
        setAvailability({ monthKey: visibleMonth, closedDateKeys });
      })
      .catch(() => {
        if (!active) return;
        setLoadError("Nepodařilo se načíst dostupné dny.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, visibleMonth]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function openCalendar() {
    if (disabled) return;
    setVisibleMonth(getMonthKey(value));
    setIsOpen(true);
  }

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-charcoal">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          readOnly
          aria-autocomplete="none"
          aria-controls={dialogId}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-required={required}
          disabled={disabled}
          value={selectedDate ? inputDateFormatter.format(selectedDate) : ""}
          placeholder="Vyberte datum"
          onClick={openCalendar}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
              event.preventDefault();
              openCalendar();
            }
          }}
          className={cn(
            "h-10 w-full min-w-0 max-w-full cursor-pointer rounded-lg border-2 border-cream-dark bg-white px-3 pr-10 text-charcoal",
            "transition-colors duration-200 hover:border-sage-light focus:border-gold focus:outline-none focus:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-charcoal-light"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
          />
        </svg>
      </div>
      <input type="hidden" name={name} value={value} />

      {isOpen ? (
        <div
          id={dialogId}
          role="dialog"
          aria-label={`Kalendář ${label}`}
          aria-busy={isLoading}
          className="absolute left-0 z-50 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-xl border-2 border-cream-dark bg-white p-3 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Předchozí měsíc"
              onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-charcoal hover:bg-cream focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <p className="font-semibold capitalize text-charcoal">
              {monthFormatter.format(days[0])}
            </p>
            <button
              type="button"
              aria-label="Následující měsíc"
              onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-charcoal hover:bg-cream focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1" aria-hidden="true">
            {weekdays.map((weekday) => (
              <span key={weekday} className="py-1 text-center text-xs font-medium text-charcoal-light">
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOffset }, (_, index) => (
              <span key={`offset-${index}`} aria-hidden="true" />
            ))}
            {days.map((date) => {
              const dateKey = toLocalDateKey(date);
              const isSelected = dateKey === value;
              const isClosed =
                isDefaultClosedDay(date) ||
                (availabilityReady && availability.closedDateKeys.has(dateKey));
              const isOutsideRange = Boolean((min && dateKey < min) || (max && dateKey > max));
              const unavailable = !availabilityReady || Boolean(loadError);
              const dayDisabled = isClosed || isOutsideRange || unavailable;
              const dateLabel = fullDateFormatter.format(date);
              const ariaLabel = isClosed
                ? `${dateLabel}, Habitat je zavřený`
                : isOutsideRange
                  ? `${dateLabel}, mimo povolený rozsah`
                  : isSelected
                    ? `${dateLabel}, vybráno`
                    : dateLabel;

              return (
                <button
                  key={dateKey}
                  type="button"
                  aria-label={ariaLabel}
                  aria-pressed={isSelected}
                  disabled={dayDisabled}
                  onClick={() => {
                    onChange(dateKey);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex aspect-square min-h-9 items-center justify-center rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gold",
                    isSelected && !dayDisabled
                      ? "bg-gold font-semibold text-white"
                      : "text-charcoal hover:bg-cream",
                    isClosed &&
                      "cursor-not-allowed bg-cream/80 text-charcoal-light/50 line-through decoration-charcoal-light/50 hover:bg-cream/80",
                    (isOutsideRange || unavailable) &&
                      !isClosed &&
                      "cursor-not-allowed text-charcoal-light/35 hover:bg-transparent",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex min-h-5 items-center justify-between gap-3 text-xs text-charcoal-light">
            <span className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-cream text-[11px] line-through opacity-60">
                7
              </span>
              Zavřeno
            </span>
            {isLoading ? <span>Načítání…</span> : loadError ? <span className="text-coral">{loadError}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
