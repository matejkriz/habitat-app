"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function FundDialog({ title, children, busy = false, onClose }: {
  title: string; children: ReactNode; busy?: boolean; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={event => {
      event.preventDefault();
      if (!busy) onClose();
    }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-hidden rounded-2xl border-0 bg-white p-0 text-left text-charcoal shadow-2xl backdrop:bg-charcoal/45">
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-cream-dark px-5 py-3">
          <h2 id={titleId} className="text-xl font-bold">{title}</h2>
          <button type="button" aria-label="Zavřít" disabled={busy} onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full text-xl hover:bg-cream focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-50">×</button>
        </header>
        <div className="overflow-y-auto overscroll-contain p-5">{children}</div>
      </div>
    </dialog>
  );
}
