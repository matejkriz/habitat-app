"use client";

import { useRef, useState, useTransition } from "react";
import { updateLunchPaid } from "@/app/actions/director";

export function LunchPaidCheckbox({ childId, childName, month, paid }: {
  childId: string; childName: string; month: string; paid: boolean;
}) {
  const [checked, setChecked] = useState(paid);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);

  function save(value: boolean) {
    if (saving.current) return;
    saving.current = true;
    setError(false);
    const previous = checked;
    setChecked(value);
    startTransition(async () => {
      try {
        await updateLunchPaid(childId, month, value);
      } catch {
        setChecked(previous);
        setError(true);
      } finally {
        saving.current = false;
      }
    });
  }

  return <div className="relative">
    <label className="mx-auto grid size-11 cursor-pointer place-items-center">
      <input type="checkbox" aria-label={`Zaplaceno: ${childName}`} checked={checked} disabled={pending}
        onChange={event => save(event.target.checked)}
        className="size-5 cursor-pointer rounded accent-sage-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-wait disabled:opacity-50" />
    </label>
    {error && <p role="alert" className="mt-1 text-[10px] leading-tight text-red-700">Platbu se nepodařilo uložit.</p>}
  </div>;
}
