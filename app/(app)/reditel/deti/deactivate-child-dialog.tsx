"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import type { ChildWithParents } from "@/app/actions/director";

export function DeactivateChildDialog({
  child, isSaving, error, onCancel, onConfirm,
}: {
  child: ChildWithParents;
  isSaving: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => {
        const target = trigger instanceof HTMLElement && trigger.isConnected
          ? trigger
          : document.getElementById(`child-toggle-${child.id}`);
        target?.focus();
      });
    };
  }, [child.id]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="deactivate-child-title"
      aria-describedby="deactivate-child-description"
      onCancel={event => {
        event.preventDefault();
        if (!isSaving) onCancel();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl bg-white p-5 text-charcoal shadow-xl backdrop:bg-charcoal/50 sm:p-6"
    >
      <h2 id="deactivate-child-title" className="text-xl font-bold">Deaktivovat dítě?</h2>
      <p id="deactivate-child-description" className="mt-3 break-words text-charcoal-light">
        Opravdu chcete dítě <strong className="text-charcoal">{child.firstName} {child.lastName}</strong> v aplikaci deaktivovat? Přesune se mezi neaktivní děti. Později ho můžete znovu aktivovat.
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-coral-dark">{error}</p>}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button ref={cancelRef} type="button" variant="outline" disabled={isSaving} onClick={onCancel}>Zrušit</Button>
        <Button type="button" variant="danger" isLoading={isSaving} onClick={onConfirm}>Deaktivovat dítě</Button>
      </div>
    </dialog>
  );
}
