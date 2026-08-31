"use client";

import { useState } from "react";
import {
  deleteParentExcuse,
  editParentExcuse,
} from "@/app/actions/parent";
import {
  ExcuseEditor,
  type ExcuseEditValues,
} from "@/components/excuses/excuse-editor";
import { formatDateRange } from "@/lib/utils";

type ParentExcuse = {
  readonly id: string;
  readonly fromDate: Date;
  readonly toDate: Date;
  readonly reason: string | null;
  readonly submittedAt: Date;
};

export function ParentExcuses({ excuses: initialExcuses }: { readonly excuses: ParentExcuse[] }) {
  const [excuses, setExcuses] = useState(initialExcuses);

  const handleSave = async (id: string, values: ExcuseEditValues) => {
    const updated = await editParentExcuse(id, values);
    setExcuses((current) =>
      current.map((excuse) =>
        excuse.id === id
          ? {
              ...excuse,
              fromDate: updated.fromDate,
              toDate: updated.toDate,
              reason: updated.reason,
            }
          : excuse,
      ),
    );
  };

  const handleDelete = async (id: string) => {
    await deleteParentExcuse(id);
    setExcuses((current) => current.filter((excuse) => excuse.id !== id));
  };

  if (excuses.length === 0) {
    return <p className="py-8 text-center text-charcoal-light">Zatím nemáte žádné omluvenky.</p>;
  }

  return (
    <div className="space-y-3">
      {excuses.map((excuse) => (
        <article key={excuse.id} className="rounded-lg border border-cream-dark bg-cream p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="font-semibold text-charcoal">
                {formatDateRange(excuse.fromDate, excuse.toDate)}
              </p>
              <p className="text-sm text-charcoal-light">
                {excuse.reason || "Bez uvedeného důvodu"}
              </p>
            </div>
            <ExcuseEditor excuse={excuse} onSave={handleSave} onDelete={handleDelete} />
          </div>
        </article>
      ))}
    </div>
  );
}
