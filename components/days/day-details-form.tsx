"use client";

import { useState, type ReactNode } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { saveDayDetails } from "@/app/actions/day-details";
import { DAY_NAME_MAX_LENGTH, validateDayDetails, type DayDetails, type DayDetailsPatch } from "@/lib/day-details";

export function DayDetailsForm({ dateKey, initialDetails, showReport = false, onSaved, children }: {
  dateKey: string;
  initialDetails: DayDetails;
  showReport?: boolean;
  onSaved: (details: DayDetails) => void;
  children?: ReactNode;
}) {
  const [saved, setSaved] = useState(initialDetails);
  const [name, setName] = useState(initialDetails.name ?? "");
  const [expense, setExpense] = useState(initialDetails.expense?.toString() ?? "");
  const [report, setReport] = useState(initialDetails.report ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const dirty = name !== (saved.name ?? "") || expense !== (saved.expense?.toString() ?? "") || (showReport && report !== (saved.report ?? ""));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSaving || !dirty) return;
    setError("");
    setSuccess(false);
    const patch: DayDetailsPatch = {
      ...(name === (saved.name ?? "") ? {} : { name: name.trim() || null }),
      ...(expense === (saved.expense?.toString() ?? "") ? {} : { expense: expense === "" ? null : Number(expense) }),
      ...(!showReport || report === (saved.report ?? "") ? {} : { report: report || null }),
    };
    try {
      validateDayDetails(patch);
      setIsSaving(true);
      await saveDayDetails(dateKey, patch);
      const next = { ...saved, ...patch };
      setSaved(next);
      setName(next.name ?? "");
      setExpense(next.expense?.toString() ?? "");
      setSuccess(true);
      onSaved(next);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Podrobnosti se nepodařilo uložit.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset disabled={isSaving} className="min-w-0 space-y-4">
        <Textarea label="Jméno dne" value={name} onChange={event => setName(event.target.value)} maxLength={DAY_NAME_MAX_LENGTH} rows={2} className="min-h-20" placeholder="Např. Jarmark nebo výlet na Karlštejn" />
        <Input label="Útrata na dítě (Kč)" type="number" inputMode="numeric" min={0} step={1} value={expense} onChange={event => setExpense(event.target.value)} placeholder="Nezadáno" hint="Odečte se z fondu každého dítěte s uloženou přítomností v tento den." />
        {showReport && <Textarea label="Report" value={report} onChange={event => setReport(event.target.value)} rows={8} placeholder="Poznámky k průběhu dne…" />}
      </fieldset>
      {children}
      {error && <p role="alert" className="text-sm text-coral-dark">{error}</p>}
      {success && !dirty && <p role="status" className="text-sm text-sage-dark">Podrobnosti uloženy.</p>}
      <Button type="submit" disabled={!dirty} isLoading={isSaving}>Uložit podrobnosti</Button>
    </form>
  );
}
