"use client";

import { useId, useRef, useState, useTransition } from "react";
import {
  getCalendarSubscriptionLinks,
  revokeCalendarSubscriptionLinks,
  rotateCalendarSubscriptionLinks,
} from "@/app/actions/calendar-subscriptions";
import { Button } from "@/components/ui/button";

type SubscriptionLinks = { habitat: string; jidelnicek: string };
type Operation = "open" | "rotate" | "revoke";

const calendars = [
  { key: "habitat", name: "Habitat", description: "Společný program a události Habitatu." },
  { key: "jidelnicek", name: "Habitat jídelníček", description: "Jídla objednaná pro Habitat." },
] as const;

const linkClassName = "rounded text-sm font-semibold text-sage-dark underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

export function CalendarSubscriptions() {
  const headingId = useId();
  const [links, setLinks] = useState<SubscriptionLinks | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [operation, setOperation] = useState<Operation>("open");
  const saving = useRef(false);

  function updateLinks(nextOperation: Operation) {
    if (saving.current) return;
    if (nextOperation === "rotate" && !window.confirm(
      "Obnovit odkazy obou kalendářů? Dosavadní odkazy přestanou fungovat a oba kalendáře si budete muset přidat znovu.",
    )) return;
    if (nextOperation === "revoke" && !window.confirm(
      "Zneplatnit odkazy obou kalendářů? Vaše kalendářová aplikace už přes ně nenačte další aktualizace.",
    )) return;

    saving.current = true;
    setOperation(nextOperation);
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        if (nextOperation === "revoke") {
          await revokeCalendarSubscriptionLinks();
          setLinks(null);
          setMessage("Odkazy obou kalendářů jsou zneplatněné. Již stažené události můžete odstranit ve své kalendářové aplikaci.");
        } else {
          setLinks(await (nextOperation === "rotate"
            ? rotateCalendarSubscriptionLinks()
            : getCalendarSubscriptionLinks()));
          if (nextOperation === "rotate") {
            setMessage("Odkazy jsou obnovené. Odeberte původní odběry a přidejte oba kalendáře pomocí nových odkazů.");
          }
        }
      } catch {
        setError("Odkazy se nepodařilo změnit. Zkuste akci znovu.");
      } finally {
        saving.current = false;
      }
    });
  }

  async function copyLink(name: string, url: string) {
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(url);
      setMessage(`Odkaz na kalendář ${name} je zkopírovaný.`);
    } catch {
      setError("Kopírování se nepodařilo. Označte a zkopírujte odkaz z pole u kalendáře ručně.");
    }
  }

  return (
    <section aria-labelledby={headingId} aria-busy={pending} className="rounded-xl border border-cream-dark bg-white p-4 sm:p-5">
      <h2 id={headingId} className="font-semibold text-charcoal">Odebírat v mém kalendáři</h2>
      <p className="mt-1 text-sm text-charcoal-light">
        Přidejte si společný program a jídelníček Habitatu do svého kalendáře pouze pro čtení.
        Odběr neobsahuje docházku ani omluvenky dětí.
      </p>
      <p className="mt-1 text-sm text-charcoal-light">
        Kalendáře se aktualizují automaticky. Změny se mohou projevit se zpožděním podle vaší kalendářové aplikace.
      </p>

      {links ? (
        <div className="mt-4 space-y-4">
          {calendars.map(calendar => {
            const url = links[calendar.key];
            return (
              <div key={calendar.key} className="min-w-0 rounded-lg bg-cream/50 p-3">
                <h3 className="font-semibold text-charcoal">{calendar.name}</h3>
                <p className="mt-1 text-sm text-charcoal-light">{calendar.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <a href={url.replace(/^https?:/, "webcal:")} className={linkClassName}>Apple Kalendář</a>
                  <Button type="button" variant="ghost" size="sm" disabled={pending}
                    aria-label={`Kopírovat odkaz: ${calendar.name}`}
                    onClick={() => void copyLink(calendar.name, url)}>Kopírovat odkaz</Button>
                </div>
                <div className="mt-3 space-y-2 text-sm text-charcoal-light">
                  <details>
                    <summary className="w-fit cursor-pointer rounded font-semibold text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">Google Kalendář</summary>
                    <p className="mt-2">Zkopírujte odkaz a na počítači otevřete <a className={linkClassName}
                      href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noreferrer">přidání kalendáře z adresy URL</a>. Vložte odkaz a zvolte Přidat kalendář. Odběr se pak zobrazí i v mobilní aplikaci.</p>
                  </details>
                  <details>
                    <summary className="w-fit cursor-pointer rounded font-semibold text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">Outlook</summary>
                    <p className="mt-2">Zkopírujte odkaz. V Outlooku otevřete Kalendář → Přidat kalendář → Přihlásit se k odběru z webu a vložte odkaz.</p>
                  </details>
                </div>
                <label className="mt-3 block text-xs text-charcoal-light">
                  Odběrový odkaz pro {calendar.name}
                  <input readOnly value={url} aria-label={`Odkaz na kalendář ${calendar.name}`}
                    onFocus={event => event.currentTarget.select()}
                    className="mt-1 block w-full min-w-0 rounded border border-cream-dark bg-white px-2 py-2 text-sm text-charcoal focus:outline-2 focus:outline-gold" />
                </label>
              </div>
            );
          })}
          <p className="text-xs text-charcoal-light">Odkazy jsou osobní. Každý, kdo je získá, může číst tyto společné kalendáře. Obnovení nebo zneplatnění se týká obou vašich odkazů.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={pending} isLoading={pending && operation === "rotate"}
              onClick={() => updateLinks("rotate")}>Obnovit oba odkazy</Button>
            <Button type="button" variant="ghost" size="sm" className="text-red-700" disabled={pending} isLoading={pending && operation === "revoke"}
              onClick={() => updateLinks("revoke")}>Zneplatnit oba odkazy</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="mt-3" isLoading={pending}
          onClick={() => updateLinks("open")}>Zobrazit odběrové odkazy</Button>
      )}
      {message ? <p role="status" className="mt-3 text-sm text-sage-dark">{message}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
