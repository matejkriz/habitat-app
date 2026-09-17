"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getDayReport, saveDayReport } from "@/app/actions/day-details";
import { Button, Input, Textarea } from "@/components/ui";
import { FundDialog } from "@/components/overview/fund-dialog";
import { parseDayDate, validateDayDetails } from "@/lib/day-details";
import { getLocalDateKey } from "@/lib/lunches";

export function ReportDialog({ initialDate, onClose }: {
  initialDate?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(() => initialDate ?? getLocalDateKey(new Date()));
  const [loaded, setLoaded] = useState<{ date: string; text?: string; original?: string; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const current = loaded?.date === date ? loaded : null;
  const ready = current?.text !== undefined;

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        parseDayDate(date);
        const report = await getDayReport(date);
        if (active) setLoaded({ date, text: report ?? "", original: report ?? "" });
      } catch {
        if (active) setLoaded({ date, error: "Report se nepodařilo načíst. Zkontrolujte datum a zkuste to znovu." });
      }
    }
    void load().finally(() => { if (active) setRetrying(false); });
    return () => { active = false; };
  }, [date, retry]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || savingRef.current || !current.text?.trim()) return;
    setError("");
    try {
      parseDayDate(date);
      validateDayDetails({ report: current.text });
      savingRef.current = true;
      setSaving(true);
      await saveDayReport(date, current.text);
      router.refresh();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Report se nepodařilo uložit.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <FundDialog title="Přidat report" busy={saving} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Input label="Datum" type="date" required value={date} disabled={saving} onChange={event => {
          setDate(event.target.value);
          setError("");
        }} />
        {current?.original && <p className="text-sm text-charcoal-light">Pro tento den už report existuje. Můžete jej doplnit nebo upravit.</p>}
        {!current && <p role="status" className="text-sm text-charcoal-light">Načítání reportu…</p>}
        {current?.error && (
          <div>
            <p role="alert" className="text-sm text-coral-dark">{current.error}</p>
            <Button type="button" variant="outline" size="sm" isLoading={retrying} onClick={() => { setRetrying(true); setRetry(value => value + 1); }}>Zkusit znovu</Button>
          </div>
        )}
        <Textarea
          label="Report"
          rows={8}
          required
          value={current?.text ?? ""}
          disabled={!ready || saving}
          onChange={event => setLoaded({ date, text: event.target.value, original: current?.original })}
          placeholder="Co jste dnes s dětmi zažili…"
        />
        {error && <p role="alert" className="text-sm text-coral-dark">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Zrušit</Button>
          <Button type="submit" isLoading={saving} disabled={!ready || !current?.text?.trim()}>Uložit report</Button>
        </div>
      </form>
    </FundDialog>
  );
}

export function AddReportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Přidat report</Button>
      {open && <ReportDialog onClose={() => setOpen(false)} />}
    </>
  );
}
