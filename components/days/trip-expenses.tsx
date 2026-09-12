"use client";

import { useEffect, useState } from "react";
import { getDayTripExpenses, setChildTripExpense } from "@/app/actions/day-details";
import { Button, Input } from "@/components/ui";
import { validateCrowns, type ChildTripExpense } from "@/lib/day-details";

export function TripExpenses({ dateKey, defaultExpense, revision = 0 }: {
  dateKey: string; defaultExpense: number | null; revision?: number;
}) {
  const [rows, setRows] = useState<ChildTripExpense[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    getDayTripExpenses(dateKey).then(data => {
      if (current) { setRows(data); setError(""); }
    }).catch(() => { if (current) setError("Útraty dětí se nepodařilo načíst."); });
    return () => { current = false; };
  }, [dateKey, defaultExpense, revision, retry]);

  return (
    <section className="mt-5 border-t border-cream-dark pt-4" aria-label="Útraty jednotlivých dětí">
      <h3 className="font-semibold text-charcoal">Útraty jednotlivých dětí</h3>
      <p className="mt-1 text-sm text-charcoal-light">Podle uložené docházky. Neupravené částky se řídí výchozí útratou dne.</p>
      {error ? <div role="alert" className="mt-3 text-sm text-coral-dark">{error} <Button type="button" size="sm" variant="ghost" onClick={() => setRetry(value => value + 1)}>Zkusit znovu</Button></div>
        : rows === null ? <p role="status" className="mt-3 text-sm text-charcoal-light">Načítání útrat…</p>
        : rows.length === 0 ? <p className="mt-3 text-sm text-charcoal-light">Nejprve uložte docházku přítomných dětí.</p>
        : <table className="mt-3 w-full table-fixed text-left text-sm">
          <thead><tr className="text-charcoal-light"><th className="w-2/5 pb-2 font-medium">Dítě</th><th className="pb-2 font-medium">Útrata (Kč)</th></tr></thead>
          <tbody>{rows.map(row => <ExpenseRow key={`${dateKey}-${row.childId}-${row.override}-${defaultExpense}`} row={row} dateKey={dateKey} defaultExpense={defaultExpense ?? 0} />)}</tbody>
        </table>}
    </section>
  );
}

function ExpenseRow({ row, dateKey, defaultExpense }: { row: ChildTripExpense; dateKey: string; defaultExpense: number }) {
  const [override, setOverride] = useState(row.override);
  const effectiveAmount = override ?? defaultExpense;
  const [amount, setAmount] = useState(String(row.override ?? defaultExpense));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(value: number | null) {
    if (saving) return;
    setError("");
    try {
      if (value !== null) validateCrowns(value);
      setSaving(true);
      await setChildTripExpense(dateKey, row.childId, value);
      setOverride(value);
      setAmount(String(value ?? defaultExpense));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Útratu se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  return <tr className="border-t border-cream-dark align-top">
    <th scope="row" className="break-words py-3 pr-2 font-medium text-charcoal">{row.name}</th>
    <td className="py-3">
      <form onSubmit={event => { event.preventDefault(); if (amount !== "") void save(Number(amount)); }}>
        <div className="flex items-center gap-1">
          <Input aria-label={`Útrata ${row.name} (Kč)`} type="number" inputMode="numeric" min={0} step={1} required value={amount} disabled={saving} onChange={event => setAmount(event.target.value)} className="min-w-0 px-2" />
          <Button type="submit" size="sm" variant="outline" className="shrink-0 px-2" aria-label={`Uložit útratu ${row.name}`} isLoading={saving} disabled={amount === "" || Number(amount) === effectiveAmount}>Uložit</Button>
        </div>
      </form>
      {override !== null && <button type="button" disabled={saving} className="mt-2 text-left text-xs font-medium text-gold-dark underline disabled:opacity-50" aria-label={`Obnovit výchozí částku ${row.name}`} onClick={() => void save(null)}>Obnovit výchozí částku</button>}
      {error && <p role="alert" className="mt-1 text-xs text-coral-dark">{error}</p>}
    </td>
  </tr>;
}
