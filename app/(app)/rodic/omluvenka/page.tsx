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
  Textarea,
} from "@/components/ui";
import {
  getParentChildren,
  submitExcuse,
  type ParentVisibleChild,
} from "@/app/actions/parent";
import { canStillAutoApprove, formatDeadline } from "@/lib/excuse-rules";

type SubmissionSummary = {
  readonly count: number;
  readonly schoolDayCount: number;
  readonly lateDayCount: number;
  readonly onTimeDayCount: number;
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SubmissionSummary | null>(null);
  const [willAutoApprove, setWillAutoApprove] = useState<boolean | null>(null);
  const [deadline, setDeadline] = useState("");

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

            <Textarea
              label="Důvod (volitelné)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Např. nemoc, rodinné důvody..."
              rows={3}
            />

            {/* Auto-approval info */}
            {fromDate && (
              <div className={`p-4 rounded-lg ${
                willAutoApprove
                  ? "bg-sage/10 border border-sage/20"
                  : "bg-gold/10 border border-gold/20"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    willAutoApprove ? "bg-sage/20" : "bg-gold/20"
                  }`}>
                    {willAutoApprove ? (
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
                    {willAutoApprove ? (
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
                  Pro automatické schválení odešlete omluvenku nejpozději do 9:00 den před absencí
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold">•</span>
                  Pozdě odeslané omluvenky jsou zaznamenány, ale Bětka je musí dodatečně schválit
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
