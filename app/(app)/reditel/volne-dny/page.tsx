"use client";

import { useState, useEffect } from "react";
import { getClosedDays, addClosedDay, removeClosedDay } from "@/app/actions/director";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
} from "@/components/ui";
import { formatDateWithWeekday } from "@/lib/utils";

interface ClosedDay {
  id: string;
  date: Date;
  description: string | null;
}

export default function ClosedDaysPage() {
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await getClosedDays();
        setClosedDays(data);
      } catch (error) {
        console.error("Failed to load closed days:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsAdding(true);

    try {
      const closedDay = await addClosedDay(newDate, newDescription || undefined);
      setClosedDays((prev) =>
        [...prev, closedDay].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
      );
      setNewDate("");
      setNewDescription("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nepodařilo se přidat volný den."
      );
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await removeClosedDay(id);
      setClosedDays((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      console.error("Failed to delete closed day:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  // Separate past and upcoming
  const upcomingDays = closedDays.filter(
    (d) => new Date(d.date) >= new Date(today)
  );
  const pastDays = closedDays
    .filter((d) => new Date(d.date) < new Date(today))
    .reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Volné dny</h1>
        <p className="text-charcoal-light">
          Správa prázdnin, svátků a mimořádných volných dnů
        </p>
      </div>

      {/* Info box */}
      <div className="p-4 bg-sage/10 border border-sage/20 rounded-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-sage mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-charcoal-light">
            <p className="font-medium text-charcoal mb-1">Automaticky zavřené dny</p>
            <p>
              Pátky, soboty a neděle jsou automaticky považovány za zavřené dny.
              Zde můžete přidat další volné dny, jako jsou prázdniny nebo svátky.
            </p>
          </div>
        </div>
      </div>

      {/* Add new closed day */}
      <Card>
        <CardHeader>
          <CardTitle>Přidat volný den</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            {error && (
              <div className="p-3 bg-coral/10 border border-coral/20 rounded-lg text-coral text-sm">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Datum"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={today}
                required
              />
              <Input
                label="Popis (volitelné)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Např. Vánoční prázdniny"
              />
            </div>

            <Button type="submit" isLoading={isAdding}>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Přidat volný den
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Upcoming closed days */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gold"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Nadcházející volné dny
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-gold border-t-transparent rounded-full" />
            </div>
          ) : upcomingDays.length === 0 ? (
            <p className="text-charcoal-light text-center py-8">
              Žádné nadcházející volné dny
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingDays.map((day) => (
                <div
                  key={day.id}
                  className="flex items-center justify-between p-3 bg-cream rounded-lg"
                >
                  <div>
                    <p className="font-medium text-charcoal">
                      {formatDateWithWeekday(day.date)}
                    </p>
                    {day.description && (
                      <p className="text-sm text-charcoal-light">
                        {day.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(day.id)}
                    isLoading={deletingId === day.id}
                  >
                    <svg
                      className="w-4 h-4 text-coral"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past closed days (collapsed) */}
      {pastDays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-charcoal-light">
              Minulé volné dny ({pastDays.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastDays.slice(0, 10).map((day) => (
                <div
                  key={day.id}
                  className="flex items-center justify-between p-3 bg-cream/50 rounded-lg opacity-60"
                >
                  <div>
                    <p className="font-medium text-charcoal">
                      {formatDateWithWeekday(day.date)}
                    </p>
                    {day.description && (
                      <p className="text-sm text-charcoal-light">
                        {day.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {pastDays.length > 10 && (
                <p className="text-sm text-charcoal-light text-center py-2">
                  ... a dalších {pastDays.length - 10} dnů
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
