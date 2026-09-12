"use client";

import { useState } from "react";
import { updateChild, type ChildWithParents } from "@/app/actions/director";
import { Button, Input } from "@/components/ui";
import { validateCrowns } from "@/lib/day-details";

const crowns = (value: number) => `${new Intl.NumberFormat("cs-CZ").format(value)} Kč`;

export function ChildFund({ child }: { child: ChildWithParents }) {
  const [fundSent, setFundSent] = useState(child.fundSent ?? null);
  const [amount, setAmount] = useState(fundSent?.toString() ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const spent = child.fundSpent ?? 0;
  const balance = (fundSent ?? 0) - spent;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError("");
    try {
      const value = amount === "" ? null : Number(amount);
      if (value !== null) validateCrowns(value);
      setSaving(true);
      await updateChild(child.id, { fundSent: value });
      setFundSent(value);
      setEditing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Fond se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 border-t border-cream-dark pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-light">Výletní fond</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-charcoal">
        <p>Posláno do fondu: {fundSent === null ? "nezadáno" : crowns(fundSent)}</p>
        <p>Útraty: {crowns(spent)}</p>
        <p className={balance < 0 ? "font-semibold text-coral-dark" : "font-semibold text-sage-dark"}>Zůstatek: {crowns(balance)}</p>
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-3 space-y-3">
          <Input id={`fund-${child.id}`} label="Posláno do fondu (Kč)" type="number" inputMode="numeric" min={0} step={1} value={amount} onChange={event => setAmount(event.target.value)} disabled={saving} hint="Celková částka, kterou rodiče dosud poslali do výletního fondu." />
          {error && <p role="alert" className="text-sm text-coral-dark">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={saving}>Uložit fond</Button>
            <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>Zrušit</Button>
          </div>
        </form>
      ) : (
        <Button type="button" size="sm" variant="ghost" className="mt-2" aria-label={`Upravit fond ${child.firstName} ${child.lastName}`} onClick={() => { setAmount(fundSent?.toString() ?? ""); setError(""); setEditing(true); }}>Upravit fond</Button>
      )}
    </div>
  );
}
