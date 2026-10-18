import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { CompareTowns } from "@/components/compare-towns";
import { CHECKED_TOWNS, checkedTownLabel } from "@/lib/checked-towns";
import { DEFAULT_COMPARE } from "@/lib/compare";
import { checkedFestival, festivalById } from "@/lib/towns";
import { serverBuildStore } from "@/server/deps";
import { readFirstBill } from "@/server/first-bill";

// Town against town (M9b): two saved builds of the same brief, read on the server and cached
// for a minute like the first screen. Boise is always the left side.
async function side(festivalId: string) {
  "use cache";
  cacheLife("minutes");
  const festival = festivalById(festivalId);
  if (!festival) return null;
  const bill = await readFirstBill(serverBuildStore(), festival.id);
  if (!bill) return null;
  const venues = [
    ...new Set(bill.acts.map((act) => act.anchorVenue.name)),
  ];
  return { festival, acts: bill.acts, venues };
}

// The other town comes from the URL, so a navigation waits for its lineup.
export const instant = false;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const { b } = await searchParams;
  const right = await side(typeof b === "string" ? b : DEFAULT_COMPARE.b);
  const left = await side(DEFAULT_COMPARE.a);
  if (!left || !right || right.festival.id === left.festival.id) notFound();
  const towns = CHECKED_TOWNS.map((town) => ({
    id: checkedFestival(town).id,
    label: checkedTownLabel(town),
  })).filter((town) => town.id !== DEFAULT_COMPARE.a);
  return <CompareTowns left={left} right={right} towns={towns} />;
}
