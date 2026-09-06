"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createDirectorExcuse,
  deleteExcuse,
  editExcuse,
  getExcuseChildren,
  getExcuses,
  type ExcuseChild,
  updateExcuse,
} from "@/app/actions/director";
import {
  ExcuseEditor,
  type ExcuseEditValues,
} from "@/components/excuses/excuse-editor";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
  Select,
  Toggle,
  Textarea,
} from "@/components/ui";
import type { ExcuseRangeState } from "@/lib/excuse-coverage";
import type { ExcuseDayPart } from "@/lib/types";
import { formatDate, formatDateRange } from "@/lib/utils";

interface Excuse {
  id: string;
  fromDate: Date;
  toDate: Date;
  reason: string | null;
  dayPart: ExcuseDayPart;
  cancelLunch: boolean;
  rangeState: ExcuseRangeState;
  submittedAt: Date;
  child: {
    id: string;
    firstName: string;
    lastName: string;
    doesNotTakeLunch: boolean;
  };
  submittedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

const rangeStateBadge: Record<
  ExcuseRangeState,
  { readonly variant: "excused" | "unexcused"; readonly label: string }
> = {
  ON_TIME: { variant: "excused", label: "Včas" },
  LATE: { variant: "unexcused", label: "Pozdě" },
  LATE_APPROVED: { variant: "excused", label: "Pozdě – schváleno" },
};

export default function ExcuseManagementPage() {
  const [excuses, setExcuses] = useState<Excuse[]>([]);
  const [children, setChildren] = useState<ExcuseChild[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "settled">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isChildrenLoading, setIsChildrenLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createFromDate, setCreateFromDate] = useState("");
  const [createToDate, setCreateToDate] = useState("");
  const [createCancelLunch, setCreateCancelLunch] = useState(true);
  const [createDayPart, setCreateDayPart] =
    useState<ExcuseDayPart>("FULL_DAY");
  const [notice, setNotice] = useState("");
  const hasMultipleCreateDays = Boolean(
    createFromDate &&
      createToDate &&
      createFromDate !== createToDate,
  );

  const loadExcuses = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const options =
        filter === "pending"
          ? { pendingOnly: true }
          : filter === "settled"
            ? { settledOnly: true }
            : undefined;
      const data = await getExcuses(options);
      setExcuses([...data]);
    } catch (error) {
      console.error("Failed to load excuses:", error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadExcuses();
  }, [loadExcuses]);

  useEffect(() => {
    async function loadChildren() {
      try {
        const data = await getExcuseChildren();
        setChildren([...data]);
      } catch (error) {
        console.error("Failed to load children for excuses:", error);
        setCreateError("Nepodařilo se načíst seznam dětí.");
      } finally {
        setIsChildrenLoading(false);
      }
    }

    void loadChildren();
  }, []);

  const handleApprove = async (excuseId: string, approve: boolean) => {
    setUpdatingId(excuseId);
    try {
      await updateExcuse(excuseId, approve);
      await loadExcuses(false);
    } catch (error) {
      console.error("Failed to update excuse:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEdit = async (excuseId: string, values: ExcuseEditValues) => {
    await editExcuse(excuseId, values);
    await loadExcuses(false);
  };

  const handleDelete = async (excuseId: string) => {
    await deleteExcuse(excuseId);
    await loadExcuses(false);
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError("");
    setNotice("");
    setIsCreating(true);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set(
        "dayPart",
        hasMultipleCreateDays ? "FULL_DAY" : createDayPart,
      );
      formData.set("cancelLunch", String(createCancelLunch));
      const result = await createDirectorExcuse(formData);
      if (!result.success) {
        setCreateError(result.error);
        return;
      }

      await loadExcuses(false);
      setShowCreateForm(false);
      setCreateFromDate("");
      setCreateToDate("");
      setCreateCancelLunch(true);
      setCreateDayPart("FULL_DAY");
      setNotice(
        createCancelLunch
          ? "Omluvenka byla uložena a rovnou schválena."
          : "Omluvenka byla uložena. Oběd nebude odhlášen.",
      );
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Omluvenku se nepodařilo uložit.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Omluvenky</h1>
          <p className="text-charcoal-light">Správa a schvalování omluvenek</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            onClick={() => {
              setCreateError("");
              setCreateFromDate("");
              setCreateToDate("");
              setCreateCancelLunch(true);
              setCreateDayPart("FULL_DAY");
              setNotice("");
              setShowCreateForm(true);
            }}
            disabled={showCreateForm}
          >
            Přidat omluvenku
          </Button>
          <Select
            aria-label="Filtr omluvenek"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            options={[
              { value: "all", label: "Všechny omluvenky" },
              { value: "pending", label: "Ke schválení" },
              { value: "settled", label: "Vyřízené" },
            ]}
            className="sm:w-[200px]"
          />
        </div>
      </div>

      {showCreateForm ? (
        <Card>
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle>Nová omluvenka</CardTitle>
              <p className="text-sm text-charcoal-light">
                Omluvenka zadaná ředitelkou se schválí okamžitě bez ohledu na datum.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {createError ? (
                <p
                  className="rounded-lg border border-coral/20 bg-coral/10 p-3 text-sm text-coral"
                  role="alert"
                >
                  {createError}
                </p>
              ) : null}
              <Select
                label="Dítě"
                name="childId"
                required
                disabled={isChildrenLoading || children.length === 0}
                options={[
                  {
                    value: "",
                    label: isChildrenLoading
                      ? "Načítání dětí…"
                      : children.length === 0
                        ? "Žádné aktivní dítě"
                        : "Vyberte dítě",
                  },
                  ...children.map((child) => ({
                    value: child.id,
                    label: `${child.lastName} ${child.firstName}`,
                  })),
                ]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Od"
                  name="fromDate"
                  type="date"
                  value={createFromDate}
                  onChange={(event) => {
                    const nextFromDate = event.target.value;
                    const nextToDate =
                      nextFromDate &&
                      (!createToDate || createToDate < nextFromDate)
                        ? nextFromDate
                        : createToDate;
                    setCreateFromDate(nextFromDate);
                    setCreateToDate(nextToDate);
                    if (
                      nextFromDate &&
                      nextToDate &&
                      nextFromDate !== nextToDate
                    ) {
                      setCreateDayPart("FULL_DAY");
                    }
                  }}
                  required
                />
                <Input
                  label="Do"
                  name="toDate"
                  type="date"
                  value={createToDate}
                  min={createFromDate || undefined}
                  onChange={(event) => {
                    const nextToDate = event.target.value;
                    setCreateToDate(nextToDate);
                    if (
                      createFromDate &&
                      nextToDate &&
                      createFromDate !== nextToDate
                    ) {
                      setCreateDayPart("FULL_DAY");
                    }
                  }}
                  required
                />
              </div>
              {!hasMultipleCreateDays ? (
                <Select
                  label="Dítě bude chybět"
                  name="dayPart"
                  value={createDayPart}
                  onChange={(event) =>
                    setCreateDayPart(event.target.value as ExcuseDayPart)
                  }
                  options={[
                    { value: "FULL_DAY", label: "Celý den" },
                    { value: "MORNING", label: "Jen dopoledne" },
                    { value: "AFTERNOON", label: "Jen odpoledne" },
                  ]}
                />
              ) : null}
              {!hasMultipleCreateDays && createDayPart === "MORNING" ? (
                <p className="text-sm text-charcoal-light">
                  Dítě přijde až odpoledne.
                </p>
              ) : !hasMultipleCreateDays && createDayPart === "AFTERNOON" ? (
                <p className="text-sm text-charcoal-light">
                  Dítě bude ve škole dopoledne, odpoledne bude chybět.
                </p>
              ) : null}
              <div className="rounded-lg border-2 border-cream-dark bg-white p-4">
                <Toggle
                  id="director-cancel-lunch"
                  role="switch"
                  checked={createCancelLunch}
                  onChange={(event) =>
                    setCreateCancelLunch(event.target.checked)
                  }
                  label="Odhlásit oběd"
                  description={
                    createCancelLunch
                      ? "Oběd bude odhlášen."
                      : "Oběd zůstane přihlášený."
                  }
                />
              </div>
              <Textarea
                label="Důvod (volitelné)"
                name="reason"
                placeholder="Např. nemoc, rodinné důvody…"
                rows={3}
              />
            </CardContent>
            <CardFooter className="justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateError("");
                  setCreateFromDate("");
                  setCreateToDate("");
                  setCreateCancelLunch(true);
                  setCreateDayPart("FULL_DAY");
                }}
                disabled={isCreating}
              >
                Zrušit
              </Button>
              <Button
                type="submit"
                isLoading={isCreating}
                disabled={isChildrenLoading || children.length === 0}
              >
                Uložit omluvenku
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}

      {notice ? (
        <p
          className="rounded-lg border border-sage/20 bg-sage/10 p-3 text-sm text-sage-dark"
          role="status"
        >
          {notice}
        </p>
      ) : null}

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
                : filter === "settled"
                ? "Žádné vyřízené omluvenky"
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
                        <Badge variant={rangeStateBadge[excuse.rangeState].variant}>
                          {!excuse.cancelLunch &&
                          excuse.rangeState === "LATE_APPROVED"
                            ? "Bez schválení"
                            : rangeStateBadge[excuse.rangeState].label}
                        </Badge>
                      </div>
                      <p className="text-sm text-charcoal-light">
                        <span className="font-medium">Období:</span>{" "}
                        {formatDateRange(excuse.fromDate, excuse.toDate)}
                      </p>
                      <p className="text-sm text-charcoal-light">
                        <span className="font-medium">Část dne:</span>{" "}
                        {excuse.dayPart === "MORNING"
                          ? "jen dopoledne"
                          : excuse.dayPart === "AFTERNOON"
                            ? "jen odpoledne"
                            : "celý den"}
                      </p>
                      {excuse.reason && (
                        <p className="text-sm text-charcoal-light">
                          <span className="font-medium">Důvod:</span>{" "}
                          {excuse.reason}
                        </p>
                      )}
                      <p className="text-sm text-charcoal-light">
                        <span className="font-medium">Požadavek na oběd:</span>{" "}
                        {excuse.child.doesNotTakeLunch
                          ? "dítě obědy neodebírá"
                          : excuse.cancelLunch
                            ? "odhlásit"
                            : "ponechat přihlášený"}
                      </p>
                      <p className="text-xs text-charcoal-light">
                        Odesláno: {formatDate(excuse.submittedAt)} •{" "}
                        {excuse.submittedBy.name || excuse.submittedBy.email}
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <div className="flex items-center gap-2">
                        {excuse.rangeState === "LATE" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleApprove(excuse.id, true)}
                            isLoading={updatingId === excuse.id}
                          >
                            Schválit
                          </Button>
                        )}
                        {excuse.rangeState === "LATE_APPROVED" &&
                          !excuse.child.doesNotTakeLunch &&
                          excuse.cancelLunch && (
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
                      <ExcuseEditor
                        excuse={excuse}
                        onSave={handleEdit}
                        onDelete={handleDelete}
                      />
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
