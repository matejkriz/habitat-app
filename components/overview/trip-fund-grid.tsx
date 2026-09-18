import type { ReactNode } from "react";
import type { DaySummary, ExtraFundPerson, TripFundOverview } from "@/lib/day-details";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const crowns = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
const dateLabel = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
export const formatTripDate = (date: number) => dateLabel.format(date);

type FundRow = TripFundOverview["children"][number] | ExtraFundPerson;

export function TripFundGrid({ overview, renderAmount, renderDay, renderName, addPerson, showTotals = false, children }: {
  overview: TripFundOverview;
  renderAmount?: (amount: number, child: FundRow, day?: DaySummary) => ReactNode;
  renderDay?: (day: DaySummary) => ReactNode;
  renderName?: (person: ExtraFundPerson) => ReactNode;
  addPerson?: ReactNode;
  showTotals?: boolean;
  children: ReactNode;
}) {
  const rows: FundRow[] = [...overview.children, ...(overview.extraPeople ?? [])];
  const totals = [
    rows.reduce((sum, row) => sum + (row.fundSent ?? 0), 0),
    ...overview.days.map((_, index) => rows.reduce((sum, row) => sum + (row.amounts[index] ?? 0), 0)),
    rows.reduce((sum, row) => sum + row.fundBalance, 0),
  ];
  return (
      <Card className="overflow-hidden p-0 ring-1 ring-charcoal/5">
        {rows.length === 0 && !addPerson ? (
          <p className="px-6 py-12 text-center text-charcoal-light">Nejsou evidované žádné děti.</p>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain max-md:max-h-[calc(100dvh-8rem)] max-md:overflow-y-auto">
            <table aria-label="Výletní fond" className="w-max min-w-full border-separate border-spacing-0 text-sm tabular-nums">
              <thead>
                <tr>
                  <th scope="col" className="sticky top-0 z-30 min-w-48 border-b border-r border-cream-dark bg-[#fbf7f1] px-4 py-3 text-left text-charcoal md:left-0">Dítě</th>
                  <th scope="col" className="sticky top-0 z-20 min-w-24 border-b border-r border-cream-dark bg-[#fbf7f1] px-3 py-3 text-right text-charcoal">Příjem</th>
                  {overview.days.map(day => (
                    <th key={day.date} scope="col" className="sticky top-0 z-20 min-w-32 max-w-44 border-b border-r border-cream-dark bg-[#fbf7f1] px-3 py-3 text-center text-charcoal">
                      {renderDay ? renderDay(day) : <>
                        <span className="block whitespace-nowrap">{formatTripDate(day.date)}</span>
                        {day.name && <span className="mt-1 block max-w-40 truncate text-xs font-normal text-charcoal-light" title={day.name}>{day.name}</span>}
                      </>}
                    </th>
                  ))}
                  <th scope="col" className="sticky right-0 top-0 z-30 min-w-20 border-b border-l border-cream-dark bg-[#f8f1e7] py-3 pl-1 pr-2 md:min-w-28 md:px-3 text-right text-charcoal shadow-[-6px_0_12px_-12px_rgba(61,61,61,0.8)]">Zůstatek</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((child, index) => {
                  const isExtra = "personId" in child;
                  const background = index % 2 === 0 ? "bg-white" : "bg-[#fdfaf6]";
                  return (
                    <tr key={isExtra ? `extra:${child.personId}` : `child:${child.childId}`} className={isExtra && index === overview.children.length ? "[&>th]:border-t-[3px] [&>td]:border-t-[3px] [&>th]:border-t-charcoal/35 [&>td]:border-t-charcoal/35" : undefined}>
                      <th scope="row" className={cn("whitespace-nowrap border-b border-r border-cream-dark px-4 py-3 text-left font-bold text-charcoal md:sticky md:left-0 md:z-10", background, isExtra && renderName && "py-1")}>{isExtra ? renderName?.(child) ?? child.name : `${child.firstName} ${child.lastName}`}</th>
                      <td className={cn("border-b border-r border-cream-dark px-1 py-1 text-right text-charcoal", background)}>
                        {renderAmount ? renderAmount(child.fundSent ?? 0, child) : <span className="block px-2 py-3">{crowns.format(child.fundSent ?? 0)}</span>}
                      </td>
                      {child.amounts.map((amount, dayIndex) => (
                        <td key={overview.days[dayIndex].date} className={cn("border-b border-r border-cream-dark px-1 py-1 text-right text-charcoal", background)}>
                          {amount === null ? <span aria-label="Bez účtované útraty" className="px-2 text-charcoal-light">—</span> :
                            renderAmount ? renderAmount(amount, child, overview.days[dayIndex]) : <span className="block px-2 py-3">{crowns.format(amount)}</span>}
                        </td>
                      ))}
                      <td className={cn("sticky right-0 z-10 whitespace-nowrap border-b border-l border-cream-dark py-3 pl-1 pr-2 text-right font-bold md:px-3 shadow-[-6px_0_12px_-12px_rgba(61,61,61,0.8)]", index % 2 === 0 ? "bg-[#fcf7ef]" : "bg-[#f8f1e7]", child.fundBalance < 0 ? "text-red-700" : "text-charcoal")}>
                        {crowns.format(child.fundBalance)}
                      </td>
                    </tr>
                  );
                })}
                {addPerson && <tr><td colSpan={overview.days.length + 3} className="border-b border-cream-dark bg-white px-4 py-2">{addPerson}</td></tr>}
              </tbody>
              {showTotals && <tfoot>
                <tr className="font-bold text-charcoal">
                  <th scope="row" className="border-t-2 border-r border-sage/40 bg-[#e8eee2] px-4 py-4 text-left md:sticky md:left-0 md:z-10">Celkem</th>
                  {totals.map((amount, index) => <td key={index} className={cn("whitespace-nowrap border-t-2 border-r border-sage/40 bg-[#e8eee2] px-3 py-4 text-right", index === totals.length - 1 && "sticky right-0 z-10 border-l shadow-[-6px_0_12px_-12px_rgba(61,61,61,0.8)]", amount < 0 && "text-red-700")}>{crowns.format(amount)}</td>)}
                </tr>
              </tfoot>}
            </table>
          </div>
        )}
        <p className="border-t border-cream-dark bg-[#fdfaf6] px-5 py-3 text-sm text-charcoal-light">
          {children}
        </p>
      </Card>
  );
}
