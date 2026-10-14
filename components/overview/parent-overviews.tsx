import { getParentLunchOverview, getParentTripFundOverview } from "@/app/actions/parent-overviews";
import { LunchOverviewView, safeLunchMonth } from "./lunch-overview-view";
import { TripFundGrid } from "./trip-fund-grid";
import { getLunchPayment, getPreviousLunchPaymentMonth, isLunchMonthClosed } from "@/lib/lunch-payment";
import type { LunchOverview } from "@/lib/lunch-overview";
import { LunchPayment } from "./lunch-payment";

export async function ParentLunchSection({ month, childId, calendarMonth }: {
  month?: string; childId: string; calendarMonth: string;
}) {
  const overview = await getParentLunchOverview(safeLunchMonth(month));
  const now = new Date();
  const closed = isLunchMonthClosed(overview, now);
  const previous = closed ? null : await getParentLunchOverview(getPreviousLunchPaymentMonth(now));
  const paymentOverview = closed ? overview : previous && isLunchMonthClosed(previous, now) ? previous : null;
  return <div className="space-y-4">
    <LunchOverviewView overview={overview} basePath="/rodic" monthParam="lunchMonth" extraParams={{ child: childId, month: calendarMonth }} />
    {!closed && <p className="text-sm text-charcoal-light">Obědy se platí za předchozí měsíc zpětně.</p>}
    {paymentOverview && <ParentLunchPayment overview={paymentOverview} />}
  </div>;
}

function ParentLunchPayment({ overview }: { overview: LunchOverview }) {
  const paidChildren = overview.children.filter(child => child.paid);
  const allPaid = paidChildren.length > 0 && overview.children.every(child => child.paid || child.payableLunches === 0);
  if (allPaid) return (
    <p role="status" className="flex items-center gap-2 rounded-xl border border-sage/30 bg-sage/10 px-4 py-3 font-semibold text-sage-dark">
      <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
      </svg>
      Obědy za {overview.monthLabel} máte zaplacené.
    </p>
  );
  return <div className="space-y-2">
    {paidChildren.length > 0 && <p className="text-sm text-sage-dark">
      Zaplaceno za: {paidChildren.map(child => `${child.firstName} ${child.lastName}`).join(", ")}.
    </p>}
    <LunchPayment key={overview.month} payment={getLunchPayment(overview)} />
  </div>;
}

export async function ParentTripFundSection() {
  const overview = await getParentTripFundOverview();
  return (
    <section aria-labelledby="trip-fund-title" className="min-w-0 space-y-4">
      <div>
        <h2 id="trip-fund-title" className="text-xl font-bold text-charcoal">Výletní fond</h2>
        <p className="text-charcoal-light">Příjmy a útraty vašich dětí za celé evidované období. Všechny částky jsou v Kč.</p>
      </div>
      <TripFundGrid overview={overview}>
        Příjem je celková částka poslaná do fondu. Útrata se započítává jen při zapsané přítomnosti a respektuje individuální částku dítěte.
      </TripFundGrid>
    </section>
  );
}
