import { ExcuseDayPart, type ExcuseDayPart as ExcuseDayPartValue } from "@/lib/types";
import { cn } from "@/lib/utils";

type DayPartSelectorProps = {
  readonly value: ExcuseDayPartValue;
  readonly onChange: (value: ExcuseDayPartValue) => void;
  readonly name?: string;
  readonly className?: string;
};

const dayPartOptions = [
  {
    value: ExcuseDayPart.FULL_DAY,
    label: "Celý den",
    description: "ráno i odpoledne",
    activeHalves: [true, true],
  },
  {
    value: ExcuseDayPart.MORNING,
    label: "Dopoledne",
    description: "jen první část dne",
    activeHalves: [true, false],
  },
  {
    value: ExcuseDayPart.AFTERNOON,
    label: "Odpoledne",
    description: "jen druhá část dne",
    activeHalves: [false, true],
  },
] as const;

export function DayPartSelector({
  value,
  onChange,
  name = "dayPart",
  className,
}: DayPartSelectorProps) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-2 block text-sm font-medium text-charcoal">
        Dítě bude chybět
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {dayPartOptions.map((option, index) => (
          <label
            key={option.value}
            className={cn(
              "relative min-w-0 cursor-pointer touch-manipulation select-none",
              index === 0 && "col-span-2 sm:col-span-1",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-label={option.label}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-cream-dark bg-white p-2.5 pr-8 text-center",
                "transition-[background-color,border-color,box-shadow,transform] duration-150",
                "hover:border-sage-light hover:bg-cream/40 active:scale-[0.99]",
                "peer-checked:border-charcoal peer-checked:bg-gold/10 peer-checked:shadow-sm",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2",
                "sm:min-h-20 sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:py-2.5 sm:pr-8 sm:text-left",
                index === 0 && "min-h-20 flex-row text-left",
              )}
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-11 shrink-0 grid-cols-2 gap-1 rounded-lg border border-cream-dark bg-cream p-1.5"
              >
                {option.activeHalves.map((isActive, halfIndex) => (
                  <span
                    key={halfIndex}
                    className={cn(
                      "rounded-[0.25rem] bg-cream-dark",
                      isActive && "bg-gold shadow-sm",
                    )}
                  />
                ))}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight text-charcoal">
                  {option.label}
                </span>
                <span
                  aria-hidden="true"
                  className="mt-1 block text-[0.6875rem] leading-tight text-charcoal-light"
                >
                  {option.description}
                </span>
              </span>
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-2 grid h-5 w-5 scale-75 place-items-center rounded-full bg-charcoal text-xs font-black text-white opacity-0 transition-[opacity,transform] duration-150 peer-checked:scale-100 peer-checked:opacity-100"
            >
              ✓
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
