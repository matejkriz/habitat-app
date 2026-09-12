import { getTripFundOverview } from "@/app/actions/director";
import { TripFundTable } from "./trip-fund-table";

export async function TripFundOverviewSection() {
  const overview = await getTripFundOverview();
  return <TripFundTable initialOverview={overview} />;
}
