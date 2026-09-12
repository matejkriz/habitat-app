"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { setChildTripExpense } from "@/app/actions/day-details";
import { Button } from "@/components/ui/button";
import type { TripFundOverview } from "@/lib/day-details";
import { FundAmountCell } from "./fund-amount-cell";
import { TripExpenseDialog } from "./trip-expense-dialog";
import { getTripFundOverview, updateChild } from "@/app/actions/director";
import { TripFundGrid, formatTripDate } from "./trip-fund-grid";
import { getLocalDateKey } from "@/lib/lunches";

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
      <TripFundGrid overview={overview} renderDay={day => (
        <Link href={`/ucitel/dochazka?date=${getLocalDateKey(new Date(day.date))}`} className="block rounded-sm hover:text-gold-dark hover:underline focus-visible:outline-2 focus-visible:outline-gold">
          <span className="block whitespace-nowrap">{formatTripDate(day.date)}</span>
          {day.name && <span className="mt-1 block max-w-40 truncate text-xs font-normal text-charcoal-light" title={day.name}>{day.name}</span>}
        </Link>
      )} renderAmount={(amount, child, day) => (
        <FundAmountCell amount={amount} childName={`${child.firstName} ${child.lastName}`} dateLabel={day ? formatTripDate(day.date) : undefined} onSave={async next => {
          if (day) await setChildTripExpense(getLocalDateKey(new Date(day.date)), child.childId, next);
          else await updateChild(child.childId, { fundSent: next });
          await refresh();
        }} />
      )}>
        Částky upravíte kliknutím. Příjem je celková částka poslaná do fondu. Útrata se započítává jen při zapsané přítomnosti a respektuje individuální částku dítěte.
      </TripFundGrid>
      {adding && <TripExpenseDialog existingDates={overview.days.map(day => getLocalDateKey(new Date(day.date)))} onClose={() => setAdding(false)} onSaved={async () => { setAdding(false); await refresh(); }} />}
    </section>
  );
}
