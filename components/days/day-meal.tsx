import { cn } from "@/lib/utils";

export function DayMeal({ meal, mealCount, compact = false, layout = "inline", className }: {
  meal?: string | null;
  mealCount?: number | null;
  compact?: boolean;
  layout?: "inline" | "calendar";
  className?: string;
}) {
  if (!meal?.trim() && mealCount == null) return null;
  const isCalendar = layout === "calendar";
  const portionLabel = mealCount === 1 || (mealCount != null && mealCount >= 2 && mealCount <= 4) ? "porce" : "porcí";

  return (
    <span
      role="group"
      aria-label="Jídlo"
      className={cn(
        "flex min-w-0 items-start",
        isCalendar
          ? "@container/meal relative w-full flex-col border-t border-sage/20 pt-2 text-[11px] leading-4 text-charcoal-light sm:text-xs"
          : compact
          ? "gap-1 text-[11px] leading-4 text-charcoal-light sm:text-xs"
          : "gap-3 rounded-xl border border-sage/15 bg-sage/5 p-4 text-sm leading-relaxed text-charcoal",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        className={cn("shrink-0 text-sage-dark", isCalendar
          ? "absolute left-1/2 top-0 box-content size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-1"
          : compact ? "mt-0.5 size-3" : "mt-0.5 size-5")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 3v5a3 3 0 006 0V3M7 3v18M20 3c-3 0-5 3-5 7v3h5M20 3v18" />
      </svg>
      <span className={cn("min-w-0", isCalendar ? "flex w-full flex-col items-start" : "flex-1")}>
        {meal?.trim() && <span className={cn("block w-full break-words", isCalendar ? "line-clamp-6 whitespace-pre-line sm:line-clamp-4" : compact ? "line-clamp-2" : "whitespace-pre-wrap")}>{meal}</span>}
        {mealCount != null && (
          <span
            aria-label={`Počet objednaných jídel: ${mealCount}`}
            title={`${mealCount} ${portionLabel}`}
            className={cn("inline-flex shrink-0 whitespace-nowrap rounded-full bg-sage/15 py-0.5 font-semibold leading-4 text-sage-dark", isCalendar ? "gap-0.5 px-1 text-[10px] tracking-tight" : "px-2 text-[11px]", meal?.trim() && "mt-1")}
          >
            {isCalendar ? <><span>{mealCount}</span><span className="hidden @min-[4rem]/meal:inline">{` ${portionLabel}`}</span></> : `${mealCount} ${portionLabel}`}
          </span>
        )}
      </span>
    </span>
  );
}
