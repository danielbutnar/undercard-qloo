import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { FestivalScreen } from "@/components/festival-screen";
import { TOWNS, townBySlug } from "@/lib/towns";
import { serverBuildStore } from "@/server/deps";
import { readFirstBill } from "@/server/first-bill";
import { townsOnShow } from "@/server/towns";

// The same brief in another town (M6d): its own saved build, read on the server and cached for
// a minute like Boise's. A town with no saved build isn't on show.
async function townPage(slug: string) {
  "use cache";
  cacheLife("minutes");
  const town = townBySlug(slug);
  if (!town || slug === "boise") return null;
  const store = serverBuildStore();
  const firstBill = await readFirstBill(store, town.festival.id);
  if (!firstBill) return null;
  return { festival: town.festival, firstBill, towns: await townsOnShow(store) };
}

export function generateStaticParams() {
  return TOWNS.slice(1).map((town) => ({ town: town.slug }));
}

export default async function TownPage({
  params,
}: {
  params: Promise<{ town: string }>;
}) {
  const page = await townPage((await params).town);
  if (!page) notFound();
  return (
    <FestivalScreen
      festival={page.festival}
      firstBill={page.firstBill}
      towns={page.towns}
    />
  );
}
