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
  Select,
} from "@/components/ui";
import { getParentChildren, submitExcuse } from "@/app/actions/parent";
import { canStillAutoApprove, formatDeadline } from "@/lib/excuse-rules";

export default function NewExcusePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedChildId = searchParams.get("child");

  const [children, setChildren] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [selectedChildId, setSelectedChildId] = useState(preselectedChildId || "");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ autoApproved: boolean } | null>(null);
  const [willAutoApprove, setWillAutoApprove] = useState<boolean | null>(null);
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    async function loadChildren() {
      try {
        const loadedChildren = await getParentChildren();
        setChildren(loadedChildren);
        if (!selectedChildId && loadedChildren.length > 0) {
          setSelectedChildId(loadedChildren[0].id);
        }
      } catch {
        setError("Nepodařilo se načíst seznam dětí.");
      }
    }
    loadChildren();
  }, [selectedChildId]);

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
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("childId", selectedChildId);
      formData.set("fromDate", fromDate);
      formData.set("toDate", toDate || fromDate);
      if (reason) formData.set("reason", reason);

      const result = await submitExcuse(formData);
      setSuccess({ autoApproved: result.excuse.autoApproved });

      // Redirect after short delay
      setTimeout(() => {
        router.push(`/rodic?child=${selectedChildId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se odeslat omluvenku.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

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
              <div className="p-3 bg-coral/10 border border-coral/20 rounded-lg text-coral text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className={`p-4 rounded-lg text-sm ${
                success.autoApproved
                  ? "bg-sage/10 border border-sage/20 text-sage-dark"
                  : "bg-gold/10 border border-gold/20 text-gold-dark"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Omluvenka odeslána</span>
                </div>
                {success.autoApproved ? (
                  <p>Omluvenka byla automaticky schválena.</p>
                ) : (
                  <p>Omluvenka byla zaznamenána jako neomluvená absence (pozdní odeslání).</p>
                )}
              </div>
            )}

            {children.length > 1 && (
              <Select
                label="Dítě"
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                options={children.map((child) => ({
                  value: child.id,
                  label: `${child.firstName} ${child.lastName}`,
                }))}
              />
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
              min={today}
              required
            />

            <Input
              label="Do"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || today}
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
                          Omluvenka bude automaticky schválena
                        </p>
                        <p className="text-sm text-charcoal-light mt-1">
                          Odesláno včas (do {deadline})
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-gold-dark">
                          Omluvenka bude zaznamenána jako neomluvená
                        </p>
                        <p className="text-sm text-charcoal-light mt-1">
                          Termín pro automatické schválení již uplynul ({deadline}).
                          Bětka může omluvenku dodatečně schválit.
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
