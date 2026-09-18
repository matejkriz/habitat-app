"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateExtraFundPersonPatch } from "@/lib/day-details";
import { FundDialog } from "./fund-dialog";

export function ExtraFundPersonDialog({ person, onClose, onSave }: {
  person: { personId?: string; name: string };
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(person.name);
  const [error, setError] = useState("");
  const [saving, startTransition] = useTransition();
  const savingRef = useRef(false);

  function save() {
    if (savingRef.current) return;
    setError("");
    try {
      const validated = validateExtraFundPersonPatch({ name });
      savingRef.current = true;
      startTransition(async () => {
        try { await onSave(validated.name!); }
        catch (error) { setError(error instanceof Error ? error.message : "Osobu se nepodařilo uložit."); }
        finally { savingRef.current = false; }
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Zadejte jméno osoby.");
    }
  }

  return (
    <FundDialog title={person.personId ? "Upravit jméno osoby" : "Přidat extra osobu"} busy={saving} onClose={onClose}>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); save(); }}>
        <Input label="Jméno osoby" autoFocus required maxLength={160} value={name} disabled={saving} onChange={event => setName(event.target.value)} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Zrušit</Button>
          <Button type="submit" isLoading={saving}>Uložit</Button>
        </div>
      </form>
    </FundDialog>
  );
}
