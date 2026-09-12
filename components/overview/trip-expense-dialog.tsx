"use client";

import { useEffect, useRef, useState } from "react";
import { createTripExpense, getDayTripExpenses } from "@/app/actions/day-details";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseDayDate, validateCrowns, type ChildTripExpense } from "@/lib/day-details";
import { getLocalDateKey } from "@/lib/lunches";
import { FundDialog } from "./fund-dialog";

export function TripExpenseDialog({ existingDates, onSaved, onClose }: {
  existingDates: string[]; onSaved: () => Promise<void>; onClose: () => void;
}) {
  const [date, setDate] = useState(() => getLocalDateKey(new Date()));
  const [expense, setExpense] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState<{ date: string; rows?: ChildTripExpense[]; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const duplicate = existingDates.includes(date);
  const rows = loaded?.date === date ? loaded.rows : undefined;
  const loadError = loaded?.date === date ? loaded.error : undefined;

  useEffect(() => {
    if (duplicate) return;
    let current = true;
    async function load() {
      try {
        parseDayDate(date);
        const rows = await getDayTripExpenses(date);
        if (current) setLoaded({ date, rows });
      } catch {
        if (current) setLoaded({ date, error: "Přítomné děti se nepodařilo načíst. Zkontrolujte datum a zkuste to znovu." });
      }
    }
    void load();
    return () => { current = false; };
  }, [date, duplicate, retry]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (savingRef.current || duplicate || !rows) return;
    setError("");
    try {
      parseDayDate(date);
      if (expense.trim() === "") throw new Error("Zadejte výchozí částku.");
      const amount = Number(expense);
      validateCrowns(amount);
      const individual = rows.flatMap(row => {
        const value = overrides[row.childId];
        if (value === undefined || value.trim() === "") return [];
        const next = Number(value);
        validateCrowns(next);
        return next === amount ? [] : [{ childId: row.childId, amount: next }];
      });
      savingRef.current = true;
      setSaving(true);
      await createTripExpense(date, amount, individual);
      await onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Útratu se nepodařilo uložit.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <FundDialog title="Přidat útratu" busy={saving} onClose={onClose}>
      <form onSubmit={save} className="space-y-5">
        <fieldset disabled={saving} className="min-w-0 space-y-4">
          <Input label="Datum výletu" type="date" required value={date} onChange={event => { setDate(event.target.value); setOverrides({}); setError(""); }} />
          <Input label="Výchozí částka (Kč)" type="number" inputMode="numeric" min={0} step={1} required value={expense} onChange={event => setExpense(event.target.value)} hint="Částka na každé přítomné dítě." />
          {duplicate ? <p role="alert" className="text-sm text-red-700">Pro tento den už je útrata zadaná. Upravte ji v tabulce nebo v detailu dne.</p>
            : loadError ? <div role="alert" className="text-sm text-red-700">{loadError}<Button type="button" variant="ghost" size="sm" onClick={() => { setLoaded(null); setRetry(value => value + 1); }}>Zkusit znovu</Button></div>
            : !rows ? <p role="status" className="text-sm text-charcoal-light">Načítání přítomných dětí…</p>
            : rows.length === 0 ? <p className="text-sm text-charcoal-light">Pro tento den zatím není zapsané žádné přítomné dítě. Výchozí částku můžete uložit už teď; započítá se až podle uložené docházky.</p>
            : <div className="space-y-3 border-t border-cream-dark pt-4">
              <h3 className="font-semibold">Individuální částky</h3>
              <p className="text-sm text-charcoal-light">Přítomné děti podle uložené docházky. Prázdné pole použije výchozí částku.</p>
              {rows.map(row => <div key={row.childId} className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3">
                <label htmlFor={`trip-amount-${row.childId}`} className="break-words text-sm font-medium">{row.name}</label>
                <Input id={`trip-amount-${row.childId}`} aria-label={`Útrata ${row.name} (Kč)`} type="number" inputMode="numeric" min={0} step={1}
                  value={overrides[row.childId] ?? expense} placeholder={expense || "0"} onChange={event => setOverrides(current => ({ ...current, [row.childId]: event.target.value }))} className="text-right" />
              </div>)}
            </div>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Zrušit</Button>
          <Button type="submit" isLoading={saving} disabled={duplicate || !rows || expense.trim() === ""}>Uložit útratu</Button>
        </div>
      </form>
    </FundDialog>
  );
}
