"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ExcuseDayPart } from "@/lib/types";

export type ExcuseEditValues = {
  readonly fromDate: string;
  readonly toDate: string;
  readonly dayPart: ExcuseDayPart;
  readonly reason: string;
};

type EditableExcuse = {
  readonly id: string;
  readonly fromDate: Date | string;
  readonly toDate: Date | string;
  readonly dayPart: ExcuseDayPart;
  readonly reason: string | null;
};

type ExcuseEditorProps = {
  readonly excuse: EditableExcuse;
  readonly onSave: (id: string, values: ExcuseEditValues) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
};

const toDateInputValue = (value: Date | string): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function ExcuseEditor({ excuse, onSave, onDelete }: ExcuseEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fromDate, setFromDate] = useState(() => toDateInputValue(excuse.fromDate));
  const [toDate, setToDate] = useState(() => toDateInputValue(excuse.toDate));
  const [dayPart, setDayPart] = useState<ExcuseDayPart>(excuse.dayPart);
  const [reason, setReason] = useState(excuse.reason ?? "");
  const [pendingAction, setPendingAction] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState("");
  const hasMultipleDays = Boolean(
    fromDate && toDate && fromDate !== toDate,
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setPendingAction("save");
    try {
      await onSave(excuse.id, {
        fromDate,
        toDate,
        dayPart: hasMultipleDays ? "FULL_DAY" : dayPart,
        reason,
      });
      setIsEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Změny se nepodařilo uložit.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Opravdu chcete tuto omluvenku smazat?")) {
      return;
    }

    setError("");
    setPendingAction("delete");
    try {
      await onDelete(excuse.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Omluvenku se nepodařilo smazat.");
    } finally {
      setPendingAction(null);
    }
  };

  if (!isEditing) {
    return (
      <div className="space-y-2">
        {error ? <p className="text-sm text-coral" role="alert">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Upravit
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            isLoading={pendingAction === "delete"}
            onClick={handleDelete}
          >
            Smazat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="mt-4 space-y-4 border-t border-cream-dark pt-4" onSubmit={handleSubmit}>
      {error ? <p className="text-sm text-coral" role="alert">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Od"
          type="date"
          value={fromDate}
          max={toDate}
          onChange={(event) => {
            const nextFromDate = event.target.value;
            setFromDate(nextFromDate);
            if (nextFromDate && toDate && nextFromDate !== toDate) {
              setDayPart("FULL_DAY");
            }
          }}
          required
        />
        <Input
          label="Do"
          type="date"
          value={toDate}
          min={fromDate}
          onChange={(event) => {
            const nextToDate = event.target.value;
            setToDate(nextToDate);
            if (fromDate && nextToDate && fromDate !== nextToDate) {
              setDayPart("FULL_DAY");
            }
          }}
          required
        />
      </div>
      {!hasMultipleDays ? (
        <Select
          label="Dítě bude chybět"
          value={dayPart}
          onChange={(event) => setDayPart(event.target.value as ExcuseDayPart)}
          options={[
            { value: "FULL_DAY", label: "Celý den" },
            { value: "MORNING", label: "Jen dopoledne" },
            { value: "AFTERNOON", label: "Jen odpoledne" },
          ]}
        />
      ) : null}
      <Textarea
        label="Důvod"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
          Zrušit
        </Button>
        <Button type="submit" size="sm" isLoading={pendingAction === "save"}>
          Uložit změny
        </Button>
      </div>
    </form>
  );
}
