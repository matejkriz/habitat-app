"use client";

import { useState, useEffect } from "react";
import { getExcuses, updateExcuse } from "@/app/actions/director";
import {
  Card,
  CardContent,
  Button,
  Badge,
  Select,
} from "@/components/ui";
import { formatShortDate, formatDate } from "@/lib/utils";

interface Excuse {
  id: string;
  fromDate: Date;
  toDate: Date;
  reason: string | null;
  autoApproved: boolean;
  submittedAt: Date;
  child: {
    id: string;
    firstName: string;
    lastName: string;
  };
  submittedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export default function ExcuseManagementPage() {
  const [excuses, setExcuses] = useState<Excuse[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadExcuses() {
      setIsLoading(true);
      try {
        const options =
          filter === "pending"
            ? { pendingOnly: true }
            : filter === "approved"
            ? { autoApprovedOnly: true }
            : undefined;
        const data = await getExcuses(options);
        setExcuses(data);
      } catch (error) {
        console.error("Failed to load excuses:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadExcuses();
  }, [filter]);

  const handleApprove = async (excuseId: string, approve: boolean) => {
    setUpdatingId(excuseId);
    try {
      await updateExcuse(excuseId, approve);
      // Update local state
      setExcuses((prev) =>
        prev.map((e) =>
          e.id === excuseId ? { ...e, autoApproved: approve } : e
        )
      );
    } catch (error) {
      console.error("Failed to update excuse:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Omluvenky</h1>
          <p className="text-charcoal-light">Správa a schvalování omluvenek</p>
        </div>

        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          options={[
            { value: "all", label: "Všechny omluvenky" },
            { value: "pending", label: "Ke schválení" },
            { value: "approved", label: "Schválené" },
          ]}
          className="w-[200px]"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
            </div>
          ) : excuses.length === 0 ? (
            <p className="text-charcoal-light text-center py-12">
              {filter === "pending"
                ? "Žádné omluvenky ke schválení"
                : filter === "approved"
                ? "Žádné schválené omluvenky"
                : "Žádné omluvenky"}
            </p>
          ) : (
            <div className="space-y-4">
              {excuses.map((excuse) => (
                <div
                  key={excuse.id}
                  className="p-4 bg-cream rounded-lg border border-cream-dark"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-charcoal">
                          {excuse.child.firstName} {excuse.child.lastName}
                        </h3>
                        <Badge
                          variant={excuse.autoApproved ? "excused" : "unexcused"}
                        >
                          {excuse.autoApproved ? "Schváleno" : "Neschváleno"}
                        </Badge>
                      </div>
                      <p className="text-sm text-charcoal-light">
                        <span className="font-medium">Období:</span>{" "}
                        {formatShortDate(excuse.fromDate)} -{" "}
                        {formatShortDate(excuse.toDate)}
                      </p>
                      {excuse.reason && (
                        <p className="text-sm text-charcoal-light">
                          <span className="font-medium">Důvod:</span>{" "}
                          {excuse.reason}
                        </p>
                      )}
                      <p className="text-xs text-charcoal-light">
                        Odesláno: {formatDate(excuse.submittedAt)} •{" "}
                        {excuse.submittedBy.name || excuse.submittedBy.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!excuse.autoApproved && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleApprove(excuse.id, true)}
                          isLoading={updatingId === excuse.id}
                        >
                          Schválit
                        </Button>
                      )}
                      {excuse.autoApproved && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(excuse.id, false)}
                          isLoading={updatingId === excuse.id}
                        >
                          Zrušit schválení
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
