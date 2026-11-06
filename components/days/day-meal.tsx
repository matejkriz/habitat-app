import { cn } from "@/lib/utils";

export function DayMeal({ meal, mealCount, compact = false, className }: {
  meal?: string | null;
  mealCount?: number | null;
  compact?: boolean;
  className?: string;
}) {
  if (!meal?.trim() && mealCount == null) return null;

  return (
    <span
      role="group"
      aria-label="Jídlo"
      className={cn(
        "flex min-w-0 items-start",
        compact
          ? "gap-1 text-[11px] leading-4 text-charcoal-light sm:text-xs"
          : "gap-3 rounded-xl border border-sage/15 bg-sage/5 p-4 text-sm leading-relaxed text-charcoal",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        className={cn("shrink-0 text-sage-dark", compact ? "mt-0.5 size-3" : "mt-0.5 size-5")}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 3v5a3 3 0 006 0V3M7 3v18M20 3c-3 0-5 3-5 7v3h5M20 3v18" />
      </svg>
      <span className="min-w-0 flex-1">
        {meal?.trim() && <span className={cn("block break-words", compact ? "line-clamp-2" : "whitespace-pre-wrap")}>{meal}</span>}
        {mealCount != null && (
          <span
            aria-label={`Počet objednaných jídel: ${mealCount}`}
            className={cn("inline-flex rounded-full bg-sage/15 px-2 py-0.5 text-[11px] font-semibold leading-4 text-sage-dark", meal?.trim() && "mt-1")}
          >
            {mealCount} {mealCount === 1 || (mealCount >= 2 && mealCount <= 4) ? "porce" : "porcí"}
          </span>
        )}
      </span>
    </span>
  );
}
