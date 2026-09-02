import Link from "next/link";
import { getLunchOverview } from "@/app/actions/director";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { LunchStatus, type LunchStatus as LunchStatusValue } from "@/lib/lunches";

export const metadata = {
  title: "Obědy",
};

type SearchParams = Promise<{ month?: string | string[] }>;

const statusStyles: Record<LunchStatusValue, string> = {
  [LunchStatus.NO_LUNCH]: "bg-[#b8b8b3]",
  [LunchStatus.PRESENT]: "bg-[#7fa173]",
  [LunchStatus.EXCUSED]: "bg-[#70a3bf]",
  [LunchStatus.KEPT]: "bg-[#9b87b8]",
  [LunchStatus.LATE]: "bg-[#e69a4a]",
  [LunchStatus.UNEXCUSED]: "bg-[#d9655c]",
};

const statusLabels: Record<LunchStatusValue, string> = {
  [LunchStatus.NO_LUNCH]: "Oběd se nepodával",
  [LunchStatus.PRESENT]: "Přišel/a",
  [LunchStatus.EXCUSED]: "Včas omluven/a",
  [LunchStatus.KEPT]: "Omluven/a, oběd neodhlášen",
  [LunchStatus.LATE]: "Pozdě omluven/a",
  [LunchStatus.UNEXCUSED]: "Neomluven/a",
};

function currentMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function safeMonth(value: string | string[] | undefined): string {
  if (typeof value !== "string") return currentMonth();

  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return currentMonth();

  const year = Number(match[1]);
  return year >= 2000 && year <= 2100 ? value : currentMonth();
}

function adjacentMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function LunchesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const month = safeMonth(params.month);
  const overview = await getLunchOverview(month);
  const monthLabel =
    overview.monthLabel.charAt(0).toUpperCase() + overview.monthLabel.slice(1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Obědy</h1>
          <p className="text-charcoal-light">
            Měsíční přehled docházky a obědů k úhradě
          </p>
        </div>

        <div className="flex items-center gap-2 self-start rounded-xl border border-cream-dark bg-white p-1.5 shadow-sm lg:self-auto">
          <Link
            href={`/reditel/obedy?month=${adjacentMonth(month, -1)}`}
            aria-label="Předchozí měsíc"
            className="grid size-9 place-items-center rounded-lg text-charcoal-light transition-colors hover:bg-cream hover:text-charcoal"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-40 px-2 text-center">
            <p className="font-bold text-charcoal">{monthLabel}</p>
            <p className="text-xs text-charcoal-light">{overview.days.length} školních dnů</p>
          </div>
          <Link
            href={`/reditel/obedy?month=${adjacentMonth(month, 1)}`}
            aria-label="Následující měsíc"
            className="grid size-9 place-items-center rounded-lg text-charcoal-light transition-colors hover:bg-cream hover:text-charcoal"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden p-0 ring-1 ring-charcoal/5">
        <div className="border-b border-cream-dark bg-[#fdfaf6] px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-charcoal">{monthLabel}</h2>
              <p className="text-sm text-charcoal-light">Volné dny jsou automaticky vynechané</p>
            </div>
            {month !== currentMonth() && (
              <Link
                href="/reditel/obedy"
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gold-dark transition-colors hover:bg-gold/10"
              >
                Aktuální měsíc
              </Link>
            )}
          </div>
        </div>

        {overview.children.length === 0 ? (
          <div className="px-6 py-20 text-center text-charcoal-light">
            {overview.childrenWithoutLunch.length > 0
              ? "Všechny aktivní děti jsou vedené bez obědů."
              : "Nejsou evidované žádné aktivní děti."}
          </div>
        ) : overview.days.length === 0 ? (
          <div className="px-6 py-20 text-center text-charcoal-light">
            Tento měsíc nemá žádné školní dny.
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 min-w-48 border-b border-r border-cream-dark bg-[#fbf7f1] px-4 py-3 text-left font-bold text-charcoal shadow-[6px_0_12px_-12px_rgba(61,61,61,0.8)]">
                    Dítě
                  </th>
                  {overview.days.map((day) => (
                    <th
                      key={day.key}
                      className="min-w-12 border-b border-r border-cream-dark bg-[#fbf7f1] px-1 py-2 text-center"
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-charcoal-light">
                        {day.weekday}
                      </span>
                      <span className="block text-base font-extrabold leading-5 text-charcoal">
                        {day.day}.
                      </span>
                    </th>
                  ))}
                  <th className="sticky right-0 z-20 min-w-24 border-b border-l border-cream-dark bg-[#f8f1e7] px-3 py-2 text-center font-bold leading-tight text-charcoal shadow-[-6px_0_12px_-12px_rgba(61,61,61,0.8)]">
                    K úhradě
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.children.map((child, rowIndex) => (
                  <tr key={child.id} className="group">
                    <th
                      scope="row"
                      className={cn(
                        "sticky left-0 z-10 border-b border-r border-cream-dark px-4 py-3 text-left shadow-[6px_0_12px_-12px_rgba(61,61,61,0.8)]",
                        rowIndex % 2 === 0 ? "bg-white" : "bg-[#fdfaf6]",
                      )}
                    >
                      <span className="block whitespace-nowrap font-bold text-charcoal">
                        {child.firstName} {child.lastName}
                      </span>
                    </th>
                    {child.statuses.map((status, dayIndex) => {
                      const day = overview.days[dayIndex];
                      const label = status ? statusLabels[status] : "Docházka nezapsána";

                      return (
                        <td
                          key={day.key}
                          className={cn(
                            "h-12 border-b border-r border-cream-dark p-1",
                            rowIndex % 2 === 0 ? "bg-white" : "bg-[#fdfaf6]",
                          )}
                        >
                          <div
                            role="img"
                            aria-label={`${day.day}.: ${label}`}
                            title={label}
                            className={cn(
                              "h-9 min-w-9 rounded-lg ring-1 ring-inset transition-transform group-hover:scale-[1.03]",
                              status
                                ? `${statusStyles[status]} ring-black/5`
                                : "bg-cream/45 ring-cream-dark",
                            )}
                          />
                        </td>
                      );
                    })}
                    <td
                      className={cn(
                        "sticky right-0 z-10 border-b border-l border-cream-dark px-3 py-2 text-center shadow-[-6px_0_12px_-12px_rgba(61,61,61,0.8)]",
                        rowIndex % 2 === 0 ? "bg-[#fcf7ef]" : "bg-[#f8f1e7]",
                      )}
                    >
                      <span className="inline-grid min-w-10 place-items-center rounded-full bg-gold/15 px-2.5 py-1 text-base font-extrabold tabular-nums text-gold-dark">
                        {child.payableLunches}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-cream-dark bg-[#fdfaf6] px-5 py-3 text-sm text-charcoal-light">
          <span className="font-semibold text-charcoal">Děti bez obědů:</span>{" "}
          {overview.childrenWithoutLunch.length > 0
            ? overview.childrenWithoutLunch
                .map((child) => `${child.firstName} ${child.lastName}`)
                .join(", ")
            : "žádné"}
        </div>
      </Card>
    </div>
  );
}
