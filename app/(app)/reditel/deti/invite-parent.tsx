"use client";

import { useEffect, useRef, useState } from "react";
import { inviteParentToChild } from "@/app/actions/parent-invitations";
import type { ChildWithParents } from "@/app/actions/director";
import { Button, Input } from "@/components/ui";

type Parent = ChildWithParents["parents"][number];

export function InviteParent({
  child,
  onInvited,
}: {
  child: ChildWithParents;
  onInvited: (parent: Parent) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const formId = `invite-parent-${child.id}`;

  useEffect(() => {
    if (confirmation) triggerRef.current?.focus();
  }, [confirmation]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;
    setIsSending(true);
    setError("");
    setConfirmation("");

    try {
      const result = await inviteParentToChild(child.id, email);
      onInvited(result.parent);
      if (result.emailSent) {
        setConfirmation(`Pozvánka byla odeslána na ${result.parent.email || email}. Rodič je přiřazen k dítěti.`);
        setIsOpen(false);
        setEmail("");
      } else {
        setError("Rodič je přiřazen k dítěti, ale pozvánku se nepodařilo odeslat. Zkuste ji odeslat znovu.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Pozvánku se nepodařilo odeslat. Zkuste to znovu.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mt-3">
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        variant="outline"
        aria-label={`Pozvat rodiče ${child.firstName} ${child.lastName}`}
        aria-expanded={isOpen}
        aria-controls={formId}
        disabled={isSending}
        onClick={() => {
          setIsOpen(!isOpen);
          setError("");
          setConfirmation("");
        }}
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Pozvat rodiče
      </Button>

      {isOpen && (
        <form id={formId} onSubmit={send} className="mt-3 max-w-lg space-y-3 rounded-lg border border-sage/20 bg-white p-4">
          <p className="text-sm text-charcoal-light">
            Na zadaný e-mail odešleme pozvánku do Habitatu. Rodiče rovnou přiřadíme k dítěti {child.firstName} {child.lastName}.
          </p>
          <Input
            id={`${formId}-email`}
            label="E-mail rodiče"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="rodic@example.cz"
            maxLength={254}
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
            disabled={isSending}
          />
          {error && <p role="alert" className="text-sm text-coral-dark">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" isLoading={isSending} disabled={!email.trim()}>
              Odeslat pozvánku
            </Button>
            <Button type="button" size="sm" variant="ghost" aria-label="Zrušit pozvánku" disabled={isSending} onClick={() => {
              setIsOpen(false);
              triggerRef.current?.focus();
            }}>
              Zrušit
            </Button>
          </div>
        </form>
      )}
      {confirmation && <p role="status" className="mt-2 text-sm text-sage-dark">{confirmation}</p>}
    </div>
  );
}
