"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ToastMessage = { title: string; description: string; tone: "success" | "warning" };
export const TOAST_DURATION_MS = 15000;

const ToastContext = createContext<((message: ToastMessage) => void) | null>(null);

export function useToast(): (message: ToastMessage) => void {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("useToast must be used within ToastProvider");
  return showToast;
}

function Toast({ message, onDismiss }: { message: ToastMessage; onDismiss: () => void }) {
  const titleId = useId();
  const remaining = useRef(TOAST_DURATION_MS);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(
    () => typeof document !== "undefined" && document.visibilityState === "hidden",
  );
  const paused = hovered || focused || documentHidden;

  useEffect(() => {
    const updateVisibility = () => setDocumentHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const timeout = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timeout);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, onDismiss]);

  return (
    <article
      aria-labelledby={titleId}
      className="habitat-toast"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div
        aria-hidden="true"
        className="toast-lifetime"
        data-tone={message.tone}
        style={{ animationDuration: `${TOAST_DURATION_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
      />
      <div className="relative flex min-w-0 items-start gap-3">
        <svg
          aria-hidden="true"
          className={cn("mt-0.5 size-6 shrink-0", message.tone === "success" ? "text-sage-dark" : "text-gold-dark")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
        >
          {message.tone === "success" ? <>
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 2.5 2.5L16 9" />
          </> : <>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 4.1 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0Z" />
            <path strokeLinecap="round" d="M12 9v4m0 3h.01" />
          </>}
        </svg>
        <div className="min-w-0 py-0.5">
          <h3 id={titleId} className="font-bold leading-6 text-charcoal">{message.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-charcoal-light">{message.description}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Zavřít oznámení"
        onClick={onDismiss}
        className="relative grid size-11 shrink-0 place-items-center rounded-lg text-charcoal-light"
      >
        <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
    </article>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<(ToastMessage & { id: number }) | null>(null);
  const nextId = useRef(0);
  const showToast = useCallback((next: ToastMessage) => {
    setMessage({ ...next, id: ++nextId.current });
  }, []);
  const dismiss = useCallback(() => setMessage(null), []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="habitat-toast-region">
        {message && <Toast key={message.id} message={message} onDismiss={dismiss} />}
      </div>
    </ToastContext.Provider>
  );
}
