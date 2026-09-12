"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateCrowns } from "@/lib/day-details";
import { FundDialog } from "./fund-dialog";

const crowns = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });

export function FundAmountCell({ amount, childName, dateLabel, onSave }: {
  amount: number; childName: string; dateLabel?: string; onSave: (amount: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<"inline" | "modal" | null>(null);
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const isExpense = dateLabel !== undefined;
  const title = isExpense ? "Upravit útratu" : "Upravit příjem";
  const close = () => {
    setMode(null);
    requestAnimationFrame(() => button.current?.focus());
  };
  const editor = mode && <AmountEditor amount={amount} inline={mode === "inline"} onSave={onSave} onClose={close} onBusyChange={setBusy} />;

  return (
    <>
      {mode === "inline" ? editor : (
        <button ref={button} type="button" aria-label={`${title}: ${childName}${dateLabel ? `, ${dateLabel}` : ""}`}
          onClick={() => setMode(window.matchMedia?.("(max-width: 767px)").matches ? "modal" : "inline")}
          className="min-h-11 w-full rounded-md px-2 text-right underline decoration-charcoal/25 decoration-dotted underline-offset-4 hover:bg-gold/10 hover:decoration-gold-dark focus-visible:outline-2 focus-visible:outline-gold">
          {crowns.format(amount)}
        </button>
      )}
      {mode === "modal" && (
        <FundDialog title={title} busy={busy} onClose={close}>
          <p className="font-bold">{childName}</p>
          <p className="mb-5 mt-1 text-sm text-charcoal-light">{dateLabel ?? "Celková částka dosud poslaná do výletního fondu."}</p>
          {editor}
        </FundDialog>
      )}
    </>
  );
}

function AmountEditor({ amount, inline, onSave, onClose, onBusyChange }: {
  amount: number; inline: boolean; onSave: (amount: number) => Promise<void>;
  onClose: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [value, setValue] = useState(String(amount));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);

  async function save() {
    if (savingRef.current) return;
    setError("");
    try {
      if (value.trim() === "") throw new Error("Zadejte částku v Kč.");
      const next = Number(value);
      validateCrowns(next);
      savingRef.current = true;
      setSaving(true);
      onBusyChange(true);
      if (next !== amount) await onSave(next);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Částku se nepodařilo uložit.");
    } finally {
      savingRef.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <form className="min-w-28 space-y-2 whitespace-normal" onSubmit={event => { event.preventDefault(); void save(); }}
      onKeyDown={event => {
        if (event.key === "Escape" && !savingRef.current) { event.preventDefault(); event.stopPropagation(); onClose(); }
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); void save(); }
      }}>
      <Input autoFocus aria-label="Částka (Kč)" label={inline ? undefined : "Částka (Kč)"} type="number" inputMode="numeric" min={0} step={1} required
        value={value} disabled={saving} onFocus={event => event.currentTarget.select()} onChange={event => setValue(event.target.value)} className="px-2 text-right" />
      {error && <p role="alert" className="text-left text-xs text-red-700">{error}</p>}
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onClose} className="px-2">Zrušit</Button>
        <Button type="submit" size="sm" isLoading={saving} className="px-2">Uložit</Button>
      </div>
      {inline && <p className="text-left text-[10px] text-charcoal-light">Enter uloží · Esc zruší</p>}
    </form>
  );
}
