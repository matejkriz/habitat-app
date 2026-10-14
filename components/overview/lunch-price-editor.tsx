"use client";

import { useRef, useState, useTransition } from "react";
import { updateLunchPrice } from "@/app/actions/director";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseLunchPrice } from "@/lib/lunch-price";

export function LunchPriceEditor({ month, priceCents }: { month: string; priceCents: number }) {
  const [value, setValue] = useState(String(priceCents / 100));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);

  function save() {
    if (saving.current) return;
    setError("");
    setSaved(false);
    try {
      parseLunchPrice(value);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Neplatná cena oběda.");
      return;
    }
    saving.current = true;
    startTransition(async () => {
      try {
        await updateLunchPrice(month, value);
        setSaved(true);
      } catch {
        setError("Cenu se nepodařilo uložit.");
      } finally {
        saving.current = false;
      }
    });
  }

  return (
    <form onSubmit={event => { event.preventDefault(); save(); }} className="space-y-2 rounded-xl border border-cream-dark bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-56">
          <Input id="lunch-price" label="Cena jednoho obědu (Kč)" inputMode="decimal" required
            value={value} disabled={pending} aria-describedby="lunch-price-hint"
            onChange={event => { setValue(event.target.value); setSaved(false); setError(""); }} />
        </div>
        <Button type="submit" isLoading={pending}>Uložit cenu</Button>
      </div>
      <p id="lunch-price-hint" className="text-sm text-charcoal-light">
        Cena platí pro všechny děti v tomto měsíci. Další měsíc ji převezme, pokud nemá vlastní uloženou cenu.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="text-sm text-sage-dark">Cena byla uložena.</p>}
    </form>
  );
}
