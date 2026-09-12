import { getLunchOverview } from "@/app/actions/director";
import { LunchOverviewView, safeLunchMonth } from "./lunch-overview-view";

export async function LunchOverviewSection({ month }: { month?: string | string[] }) {
  const overview = await getLunchOverview(safeLunchMonth(month));
  return <LunchOverviewView overview={overview} />;
}
