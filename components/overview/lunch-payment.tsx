"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LunchPayment as PaymentDetails } from "@/lib/lunch-payment";
import { FundDialog } from "./fund-dialog";
import { PaymentQrCode } from "./payment-qr-code";

function CopyIcon() {
  return <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
  </svg>;
}

export function LunchPayment({ payment }: { payment: PaymentDetails }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const title = `Platba ${payment.monthName}`;

  async function copy(text: string, message: string) {
    setCopied("");
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(message);
    } catch {
      setCopyError(true);
    }
  }

  const details = [
    { label: "Číslo účtu", value: payment.account, copyValue: payment.account.replaceAll(" ", ""), copyLabel: "Zkopírovat číslo účtu", copied: "Číslo účtu zkopírováno." },
    { label: "Částka", value: payment.amountText, copyValue: (payment.amountCents / 100).toFixed(2).replace(".", ","), copyLabel: "Zkopírovat částku", copied: "Částka zkopírována." },
    { label: "Poznámka", value: payment.note, copyValue: payment.note, copyLabel: "Zkopírovat poznámku", copied: "Poznámka zkopírována." },
  ];

  return (
    <div className="space-y-2">
      <Button ref={button} type="button" disabled={payment.amountCents === 0} onClick={() => { setCopied(""); setCopyError(false); setOpen(true); }}>
        <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v6h-6v-2" />
        </svg>
        {title}
      </Button>
      {payment.amountCents === 0 && <p className="text-sm text-charcoal-light">V tomto měsíci nemáte žádné obědy k úhradě.</p>}
      {open && (
        <FundDialog title={title} onClose={() => { setOpen(false); requestAnimationFrame(() => button.current?.focus()); }}>
          {payment.payload ? (
            <div className="mb-5 rounded-xl border border-cream-dark bg-white p-2">
              <PaymentQrCode value={payment.payload} />
              <p className="pb-2 text-center text-sm text-charcoal-light">Naskenujte v bankovní aplikaci</p>
            </div>
          ) : <p className="mb-5 text-sm text-charcoal-light">Tyto údaje přesahují limit QR platby. Zkopírujte je a zadejte platbu ručně.</p>}
          <dl className="divide-y divide-cream-dark rounded-xl border border-cream-dark bg-cream/30 px-4">
            {details.map(detail => (
              <div key={detail.label} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-semibold text-charcoal-light">{detail.label}</dt>
                  <dd className="mt-1 break-words text-base font-bold tabular-nums text-charcoal select-text">{detail.value}</dd>
                </div>
                <button type="button" aria-label={detail.copyLabel} onClick={() => void copy(detail.copyValue, detail.copied)}
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-charcoal-light hover:bg-gold/10 hover:text-gold-dark focus-visible:outline-2 focus-visible:outline-gold">
                  <CopyIcon />
                </button>
              </div>
            ))}
          </dl>
          <Button type="button" className="mt-4 w-full" onClick={() => void copy(payment.clipboardText, "Platební údaje zkopírovány.")}>
            <CopyIcon /> Zkopírovat údaje
          </Button>
          {copied && <p role="status" className="mt-3 text-sm text-sage-dark">{copied}</p>}
          {copyError && <div className="mt-3 space-y-2">
            <p role="alert" className="text-sm text-red-700">Kopírování není dostupné. Označte údaje níže a zkopírujte je ručně.</p>
            <textarea readOnly aria-label="Platební údaje pro ruční kopírování" value={payment.clipboardText} rows={4}
              onFocus={event => event.currentTarget.select()} className="w-full rounded-lg border border-cream-dark bg-white p-3 text-sm" />
          </div>}
        </FundDialog>
      )}
    </div>
  );
}
