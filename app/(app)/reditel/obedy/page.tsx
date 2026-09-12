import { redirect } from "next/navigation";

export default async function LunchesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const { month } = await searchParams;
  const query = typeof month === "string" ? `?month=${encodeURIComponent(month)}` : "";
  redirect(`/reditel${query}#obedy`);
}
