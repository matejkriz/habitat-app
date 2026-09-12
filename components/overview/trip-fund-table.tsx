"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { setChildTripExpense } from "@/app/actions/day-details";
import { Button } from "@/components/ui/button";
import type { TripFundOverview } from "@/lib/day-details";
import { FundAmountCell } from "./fund-amount-cell";
import { TripExpenseDialog } from "./trip-expense-dialog";
import { getTripFundOverview, updateChild } from "@/app/actions/director";
import { Card } from "@/components/ui/card";
import { getLocalDateKey } from "@/lib/lunches";
import { cn } from "@/lib/utils";

const crowns = new Intl.NumberFormat("cs-CZ", {
  style: "currency", currency: "CZK", maximumFractionDigits: 0,
});
const dateLabel = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric", month: "numeric", year: "numeric",
});

export function TripFundTable({ initialOverview }: { initialOverview: TripFundOverview }) {
  const [previousOverview, setPreviousOverview] = useState(initialOverview);
  const [overview, setOverview] = useState(initialOverview);
  const [adding, setAdding] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const request = useRef(0);
  if (previousOverview !== initialOverview) {
    setPreviousOverview(initialOverview);
    setOverview(initialOverview);
  }

  async function refresh() {
    const current = ++request.current;
    try {
      const next = await getTripFundOverview();
      if (current === request.current) { setOverview(next); setRefreshError(""); }
    } catch {
      if (current === request.current) setRefreshError("Změna je uložená, ale přehled se nepodařilo obnovit.");
    }
  }

  return (
    <section aria-labelledby="trip-fund-title" className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="trip-fund-title" className="text-xl font-bold text-charcoal">Výletní fond</h2>
          <p className="text-charcoal-light">Příjmy a útraty za celé evidované období. Všechny částky jsou v Kč.</p>
        </div>
        <Button type="button" className="self-start sm:shrink-0" onClick={() => setAdding(true)}>Přidat útratu</Button>
      </div>
      {refreshError && <div role="alert" className="text-sm text-red-700">{refreshError} <Button type="button" variant="ghost" size="sm" onClick={() => void refresh()}>Obnovit přehled</Button></div>}
      <Card className="overflow-hidden p-0 ring-1 ring-charcoal/5">
        {overview.children.length === 0 ? (
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
                      <Link href={`/ucitel/dochazka?date=${getLocalDateKey(new Date(day.date))}`} className="block rounded-sm hover:text-gold-dark hover:underline focus-visible:outline-2 focus-visible:outline-gold">
                        <span className="block whitespace-nowrap">{dateLabel.format(day.date)}</span>
                        {day.name && <span className="mt-1 block max-w-40 truncate text-xs font-normal text-charcoal-light" title={day.name}>{day.name}</span>}
                      </Link>
                    </th>
                  ))}
                  <th scope="col" className="sticky right-0 top-0 z-30 min-w-20 border-b border-l border-cream-dark bg-[#f8f1e7] py-3 pl-1 pr-2 md:min-w-28 md:px-3 text-right text-charcoal shadow-[-6px_0_12px_-12px_rgba(61,61,61,0.8)]">Zůstatek</th>
                </tr>
              </thead>
              <tbody>
                {overview.children.map((child, index) => {
                  const background = index % 2 === 0 ? "bg-white" : "bg-[#fdfaf6]";
                  return (
                    <tr key={child.childId}>
                      <th scope="row" className={cn("whitespace-nowrap border-b border-r border-cream-dark px-4 py-3 text-left font-bold text-charcoal md:sticky md:left-0 md:z-10", background)}>{child.firstName} {child.lastName}</th>
                      <td className={cn("border-b border-r border-cream-dark px-1 py-1 text-right text-charcoal", background)}>
                        <FundAmountCell amount={child.fundSent ?? 0} childName={`${child.firstName} ${child.lastName}`} onSave={async amount => {
                          await updateChild(child.childId, { fundSent: amount });
                          await refresh();
                        }} />
                      </td>
                      {child.amounts.map((amount, dayIndex) => (
                        <td key={overview.days[dayIndex].date} className={cn("border-b border-r border-cream-dark px-1 py-1 text-right text-charcoal", background)}>
                          {amount === null ? <span aria-label="Bez účtované útraty" className="px-2 text-charcoal-light">—</span> : (
                            <FundAmountCell amount={amount} childName={`${child.firstName} ${child.lastName}`} dateLabel={dateLabel.format(overview.days[dayIndex].date)} onSave={async next => {
                              await setChildTripExpense(getLocalDateKey(new Date(overview.days[dayIndex].date)), child.childId, next);
                              await refresh();
                            }} />
                          )}
                        </td>
                      ))}
                      <td className={cn("sticky right-0 z-10 whitespace-nowrap border-b border-l border-cream-dark py-3 pl-1 pr-2 text-right font-bold md:px-3 shadow-[-6px_0_12px_-12px_rgba(61,61,61,0.8)]", index % 2 === 0 ? "bg-[#fcf7ef]" : "bg-[#f8f1e7]", child.fundBalance < 0 ? "text-red-700" : "text-charcoal")}>
                        {crowns.format(child.fundBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-cream-dark bg-[#fdfaf6] px-5 py-3 text-sm text-charcoal-light">
          Částky upravíte kliknutím. Příjem je celková částka poslaná do fondu. Útrata se započítává jen při zapsané přítomnosti a respektuje individuální částku dítěte.
        </p>
      </Card>
      {adding && <TripExpenseDialog existingDates={overview.days.map(day => getLocalDateKey(new Date(day.date)))} onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await refresh(); }} />}
    </section>
  );
}
