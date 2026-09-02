"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  Select,
  Toggle,
  Textarea,
} from "@/components/ui";
import {
  getParentChildren,
  submitExcuse,
  type ParentVisibleChild,
} from "@/app/actions/parent";
import { canStillAutoApprove, formatDeadline } from "@/lib/excuse-rules";
import {
  ExcuseDayPart,
  type ExcuseDayPart as ExcuseDayPartValue,
} from "@/lib/types";

type SubmissionSummary = {
  readonly count: number;
  readonly cancelLunch: boolean;
  readonly schoolDayCount: number;
  readonly lateDayCount: number;
  readonly onTimeDayCount: number;
  readonly automaticallyApprovedDayCount: number;
};

function automaticApprovalMessage(dayCount: number): string {
  if (dayCount === 1) {
    return "1 den omluvenky byl automaticky schválen, protože dítě neodebírá obědy.";
  }
  if (dayCount < 5) {
    return `${dayCount} dny omluvenek byly automaticky schváleny, protože děti neodebírají obědy.`;
  }
  return `${dayCount} dnů omluvenek bylo automaticky schváleno, protože děti neodebírají obědy.`;
}

function mixedLunchMessage(summary: SubmissionSummary): string {
  const canceled =
    summary.onTimeDayCount === 1
      ? "1 oběd bude odhlášen"
      : `${summary.onTimeDayCount} obědy budou odhlášeny`;
  const lateDays =
    summary.lateDayCount === 1
      ? "1 pozdně omluvený den"
      : summary.lateDayCount < 5
        ? `${summary.lateDayCount} pozdně omluvené dny`
        : `${summary.lateDayCount} pozdně omluvených dnů`;
  const charged =
    summary.lateDayCount === 1
      ? "zůstane oběd započítaný"
      : "zůstanou obědy započítané";
  return `${canceled}; za ${lateDays} ${charged} do schválení ředitelkou.`;
}

export default function NewExcusePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedChildId = searchParams.get("child");
  const preselectedDate = searchParams.get("date") || "";

  const [children, setChildren] = useState<ParentVisibleChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState(preselectedChildId || "");
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState(preselectedDate);
  const [toDate, setToDate] = useState(preselectedDate);
  const [reason, setReason] = useState("");
  const [dayPart, setDayPart] = useState<ExcuseDayPartValue>(
    ExcuseDayPart.FULL_DAY,
  );
  const [cancelLunch, setCancelLunch] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SubmissionSummary | null>(null);
  const [willAutoApprove, setWillAutoApprove] = useState<boolean | null>(null);
  const [deadline, setDeadline] = useState("");
  const selectedChildren = children.filter((child) =>
    selectedChildIds.includes(child.id),
  );
  const someSelectedChildrenDoNotTakeLunch = selectedChildren.some(
    (child) => child.doesNotTakeLunch,
  );
  const allSelectedChildrenDoNotTakeLunch =
    selectedChildren.length > 0 &&
    selectedChildren.every((child) => child.doesNotTakeLunch);
  const shouldCancelLunch =
    dayPart === ExcuseDayPart.AFTERNOON
      ? false
      : allSelectedChildrenDoNotTakeLunch || cancelLunch;

  useEffect(() => {
    async function loadChildren() {
      try {
        const loadedChildren = await getParentChildren();
        setChildren([...loadedChildren]);
        if (loadedChildren.length > 0) {
          const fallbackChild =
            loadedChildren.find((child) => child.id === preselectedChildId) ??
            loadedChildren[0];
          setSelectedChildId(fallbackChild.id);
          setSelectedChildIds([fallbackChild.id]);
        }
      } catch {
        setError("Nepodařilo se načíst seznam dětí.");
      }
    }
    loadChildren();
  }, [preselectedChildId]);

  useEffect(() => {
    if (fromDate) {
      const from = new Date(fromDate);
      const canAutoApprove = canStillAutoApprove(from);
      setWillAutoApprove(canAutoApprove);
      setDeadline(formatDeadline(from));
    } else {
      setWillAutoApprove(null);
      setDeadline("");
    }
  }, [fromDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(null);

    if (selectedChildIds.length === 0) {
      setError("Vyberte alespoň jedno dítě.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("childId", selectedChildId);
      selectedChildIds.forEach((childId) => formData.append("childIds", childId));
      formData.set("fromDate", fromDate);
      formData.set("toDate", toDate || fromDate);
      formData.set("dayPart", dayPart);
      formData.set(
        "cancelLunch",
        String(shouldCancelLunch),
      );
      if (reason) formData.set("reason", reason);

      const result = await submitExcuse(formData);
      setSuccess({
        count: result.excuses.length,
        ...result.summary,
      });

      // Redirect after short delay
      setTimeout(() => {
        router.push(`/rodic?child=${selectedChildIds[0] ?? selectedChildId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se odeslat omluvenku.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Nová omluvenka
          </CardTitle>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div
                className="p-3 bg-coral/10 border border-coral/20 rounded-lg text-coral text-sm"
                role="alert"
              >
                {error}
              </div>
            )}

            {success && (
              <div className={`p-4 rounded-lg text-sm ${
                success.lateDayCount === 0
                  ? "bg-sage/10 border border-sage/20 text-sage-dark"
                  : "bg-gold/10 border border-gold/20 text-gold-dark"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">
                    {success.count > 1 ? "Omluvenky odeslány" : "Omluvenka odeslána"}
                  </span>
                </div>
                {success.schoolDayCount === 0 ? (
                  <p>V zadaném období nejsou žádné školní dny.</p>
                ) : !success.cancelLunch ? (
                  <p>
                    {success.count > 1
                      ? "Omluvenky není potřeba schvalovat. Obědy nebudou odhlášeny."
                      : "Omluvenku není potřeba schvalovat. Oběd nebude odhlášen."}
                  </p>
                ) : success.automaticallyApprovedDayCount ===
                  success.schoolDayCount ? (
                  <p>
                    {automaticApprovalMessage(
                      success.automaticallyApprovedDayCount,
                    )}
                  </p>
                ) : success.automaticallyApprovedDayCount > 0 ? (
                  <div className="space-y-1">
                    <p>
                      {automaticApprovalMessage(
                        success.automaticallyApprovedDayCount,
                      )}
                    </p>
                    {success.lateDayCount === 0 ? (
                      <p>
                        {success.onTimeDayCount === 1
                          ? "Za ostatní den bude oběd odhlášen."
                          : `Za ostatních ${success.onTimeDayCount} dnů budou obědy odhlášeny.`}
                      </p>
                    ) : success.onTimeDayCount === 0 ? (
                      <p>
                        {success.lateDayCount === 1
                          ? "Za ostatní pozdně omluvený den zůstane oběd započítaný do schválení ředitelkou."
                          : `Za ostatních ${success.lateDayCount} pozdně omluvených dnů zůstanou obědy započítané do schválení ředitelkou.`}
                      </p>
                    ) : (
                      <p>{mixedLunchMessage(success)}</p>
                    )}
                  </div>
                ) : success.lateDayCount === 0 ? (
                  <p>
                    {success.count > 1
                      ? `Omluvenky pro ${success.count} děti byly odeslány včas – obědy budou odhlášeny.`
                      : "Omluvenka byla odeslána včas – oběd bude odhlášen."}
                  </p>
                ) : success.onTimeDayCount === 0 ? (
                  <p>
                    {success.count > 1
                      ? `Omluvenky pro ${success.count} děti byly odeslány pozdě – obědy nebudou automaticky odhlášeny.`
                      : "Omluvenka byla odeslána pozdě – oběd nebude automaticky odhlášen."}
                  </p>
                ) : (
                  <p>{mixedLunchMessage(success)}</p>
                )}
              </div>
            )}

            {children.length > 1 && (
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-charcoal">
                  Děti
                </legend>
                <div className="space-y-2 rounded-lg border-2 border-cream-dark bg-white p-3">
                  {children.map((child) => {
                    return (
                      <label
                        key={child.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-cream"
                      >
                        <input
                          type="checkbox"
                          name="childIds"
                          value={child.id}
                          checked={selectedChildIds.includes(child.id)}
                          onChange={(event) => {
                            setSelectedChildIds((current) =>
                              event.target.checked
                                ? [...current, child.id]
                                : current.filter((id) => id !== child.id),
                            );
                          }}
                          className="h-5 w-5 rounded border-cream-dark accent-gold"
                        />
                        <span className="font-medium text-charcoal">
                          {child.firstName}
                        </span>
                        {child.doesNotTakeLunch && (
                          <span className="text-xs font-medium text-charcoal-light">
                            bez obědů
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-sm text-charcoal-light">
                  Můžete zapsat stejné období jednomu nebo více dětem.
                </p>
              </fieldset>
            )}

            <Input
              label="Od"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                if (!toDate || e.target.value > toDate) {
                  setToDate(e.target.value);
                }
              }}
              required
            />

            <Input
              label="Do"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate}
              required
            />

            <Select
              label="Dítě bude chybět"
              value={dayPart}
              onChange={(event) =>
                setDayPart(event.target.value as ExcuseDayPartValue)
              }
              options={[
                { value: ExcuseDayPart.FULL_DAY, label: "Celý den" },
                { value: ExcuseDayPart.MORNING, label: "Jen dopoledne" },
                { value: ExcuseDayPart.AFTERNOON, label: "Jen odpoledne" },
              ]}
            />

            {dayPart === ExcuseDayPart.MORNING ? (
              <p className="text-sm text-charcoal-light">
                Dítě bude chybět dopoledne a přijde až odpoledne. Volba platí pro
                všechny zadané dny.
              </p>
            ) : dayPart === ExcuseDayPart.AFTERNOON ? (
              <div className="rounded-lg border border-sage/20 bg-sage/10 px-4 py-3 text-sm">
                <p className="text-charcoal-light">
                  Dítě bude ve škole dopoledne, odpoledne bude chybět.
                </p>
                <p className="mt-1 font-semibold text-sage-dark">
                  {allSelectedChildrenDoNotTakeLunch
                    ? selectedChildren.length > 1
                      ? "Vybrané děti neodebírají obědy."
                      : "Dítě neodebírá obědy."
                    : "Oběd zůstává přihlášený."}
                </p>
                {fromDate !== toDate ? (
                  <p className="mt-1 text-xs text-charcoal-light">
                    Volba platí pro všechny zadané dny.
                  </p>
                ) : null}
              </div>
            ) : null}

            <Textarea
              label="Důvod (volitelné)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Např. nemoc, rodinné důvody..."
              rows={3}
            />

            {!allSelectedChildrenDoNotTakeLunch &&
            dayPart !== ExcuseDayPart.AFTERNOON ? (
              <div className="rounded-lg border-2 border-cream-dark bg-white p-4">
                <Toggle
                  id="cancel-lunch"
                  role="switch"
                  checked={cancelLunch}
                  onChange={(event) => setCancelLunch(event.target.checked)}
                  label="Odhlásit oběd"
                  description={
                    cancelLunch
                      ? "Oběd se odhlásí podle běžných pravidel."
                      : "Oběd zůstane přihlášený a omluvenku není potřeba schvalovat."
                  }
                />
              </div>
            ) : null}

            {/* Auto-approval info */}
            {fromDate && (
              <div className={`p-4 rounded-lg ${
                !shouldCancelLunch || willAutoApprove || allSelectedChildrenDoNotTakeLunch
                  ? "bg-sage/10 border border-sage/20"
                  : "bg-gold/10 border border-gold/20"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    !shouldCancelLunch || willAutoApprove || allSelectedChildrenDoNotTakeLunch
                      ? "bg-sage/20"
                      : "bg-gold/20"
                  }`}>
                    {!shouldCancelLunch || willAutoApprove || allSelectedChildrenDoNotTakeLunch ? (
                      <svg className="w-4 h-4 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    {!shouldCancelLunch ? (
                      <>
                        <p className="font-semibold text-sage-dark">
                          Oběd nebude odhlášen
                        </p>
                        <p className="text-sm text-charcoal-light mt-1">
                          Omluvenku není potřeba schvalovat. Oběd zůstane přihlášený.
                        </p>
                      </>
                    ) : allSelectedChildrenDoNotTakeLunch ? (
                      <>
                        <p className="font-semibold text-sage-dark">
                          Omluvenka bude automaticky schválena
                        </p>
                        <p className="text-sm text-charcoal-light mt-1">
                          {selectedChildren.length > 1
                            ? "Vybrané děti neodebírají obědy."
                            : "Dítě neodebírá obědy."}
                        </p>
                      </>
                    ) : !willAutoApprove && someSelectedChildrenDoNotTakeLunch ? (
                      <>
                        <p className="font-semibold text-gold-dark">
                          Část omluvenek se schválí automaticky
                        </p>
                        <p className="text-sm text-charcoal-light mt-1">
                          Děti bez obědů se schválí automaticky. U ostatních už
                          termín pro odhlášení oběda uplynul ({deadline}).
                        </p>
                      </>
                    ) : willAutoApprove ? (
                      <>
                        <p className="font-semibold text-sage-dark">
                          Omluvenka bude odeslána včas
                        </p>
                        <p className="text-sm text-charcoal-light mt-1">
                          Oběd bude automaticky odhlášen (termín do {deadline})
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-gold-dark">
                          Omluvenka bude odeslána pozdě
                        </p>
                        <p className="text-sm text-charcoal-light mt-1">
                          Termín pro odhlášení oběda již uplynul ({deadline}).
                          Bětka může oběd dodatečně odhlásit.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="p-4 bg-cream rounded-lg">
              <h4 className="font-semibold text-charcoal text-sm mb-2">
                Pravidla pro omluvenky
              </h4>
              <ul className="text-sm text-charcoal-light space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-gold">•</span>
                  Pro automatické odhlášení oběda odešlete omluvenku nejpozději do 9:00 den před absencí
                </li>
              </ul>
            </div>
          </CardContent>

          <CardFooter className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Zrušit
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={!selectedChildId || !fromDate || !toDate || !!success}
              className="flex-1"
            >
              Odeslat omluvenku
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
