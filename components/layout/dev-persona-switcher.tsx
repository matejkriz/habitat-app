"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchDevPersona } from "@/app/actions/dev-persona";
import {
  DEV_PERSONAS,
  getDevPersona,
  isDevPersonaId,
  type DevPersonaId,
} from "@/lib/dev-persona";

interface DevPersonaSwitcherProps {
  currentPersonaId: DevPersonaId;
}

const roleLabels = {
  PARENT: "rodič",
  TEACHER: "učitel",
  DIRECTOR: "ředitel",
} as const;

export function DevPersonaSwitcher({
  currentPersonaId,
}: DevPersonaSwitcherProps) {
  const router = useRouter();
  const [selectedPersonaId, setSelectedPersonaId] =
    useState<DevPersonaId>(currentPersonaId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedPersonaId(currentPersonaId);
  }, [currentPersonaId]);

  const handleChange = (value: string) => {
    if (!isDevPersonaId(value)) return;

    const previousPersonaId = selectedPersonaId;
    const persona = getDevPersona(value);
    setSelectedPersonaId(value);
    setError(null);

    startTransition(async () => {
      try {
        await switchDevPersona(value);
        router.push(persona.homePath);
        router.refresh();
      } catch {
        setSelectedPersonaId(previousPersonaId);
        setError("Přepnutí selhalo");
      }
    });
  };

  return (
    <div className="relative flex items-center gap-2 rounded-xl border-2 border-coral bg-[#fff8e8] px-2 py-1 shadow-[3px_3px_0_0_rgba(224,107,91,0.25)]">
      <span className="hidden lg:inline-flex rounded-md bg-charcoal px-2 py-1 font-mono text-[10px] font-bold tracking-[0.16em] text-white">
        DEV PERSONA
      </span>
      <label htmlFor="dev-persona" className="sr-only">
        Testovací identita
      </label>
      <select
        id="dev-persona"
        aria-label="Testovací identita"
        value={selectedPersonaId}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        className="h-8 max-w-32 cursor-pointer rounded-lg border border-coral/40 bg-white px-2 text-xs font-bold text-charcoal outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:cursor-wait disabled:opacity-60 sm:max-w-48"
      >
        {DEV_PERSONAS.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.label} · {roleLabels[persona.role]}
          </option>
        ))}
      </select>
      {error && (
        <span
          role="status"
          className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-md bg-coral px-2 py-1 text-[10px] font-bold text-white"
        >
          {error}
        </span>
      )}
    </div>
  );
}
