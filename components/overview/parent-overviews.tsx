import { getParentLunchOverview, getParentTripFundOverview } from "@/app/actions/parent-overviews";
import { LunchOverviewView, safeLunchMonth } from "./lunch-overview-view";
import { TripFundGrid } from "./trip-fund-grid";

export async function ParentLunchSection({ month, childId, calendarMonth }: {
  month?: string; childId: string; calendarMonth: string;
}) {
  const overview = await getParentLunchOverview(safeLunchMonth(month));
  return <LunchOverviewView overview={overview} basePath="/rodic" monthParam="lunchMonth" extraParams={{ child: childId, month: calendarMonth }} />;
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
