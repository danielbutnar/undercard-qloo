import Link from "next/link";
import { compareBills } from "@/lib/compare";
import type { FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { Act } from "@/lib/lineup";

// The bill's sheet (draft-bill.tsx's SHEET), copied: that module is a client component.
const SHEET =
  "relative flex flex-col items-center border-2 border-rule bg-surface px-4 pt-5 pb-4 text-center after:pointer-events-none after:absolute after:inset-1.5 after:border after:border-rule lg:px-9";

const PLAIN_BAND: Record<FeeBandId, string> = {
  mid: "Mid-size acts",
  opener: "Opening acts",
};

type Side = {
  festival: Festival;
  acts: readonly Act[];
  venues: readonly string[];
};

const placeOf = (festival: Festival) =>
  festival.region ? `${festival.city}, ${festival.region}` : festival.city;

/** One town's lineup, each act marked as on both lineups or only in this town. */
function TownBill({
  side,
  shared,
}: {
  side: Side;
  shared: ReadonlySet<string>;
}) {
  const place = placeOf(side.festival);
  return (
    <section aria-label={place} className={`${SHEET} min-w-0`}>
      <h2 className="text-figure font-bold">{place}</h2>
      <p className="mt-1 text-label text-muted">
        From the fans of {side.venues.join(" and ")}
      </p>
      {side.festival.feeBands.map((band) => (
        <div
          key={band.id}
          className="mt-3 flex w-full flex-col items-center border-t-2 border-rule pt-2"
        >
          <h3 className="text-body font-bold">{PLAIN_BAND[band.id]}</h3>
          <ul className="mt-1 flex w-full flex-col gap-1.5">
            {side.acts
              .filter((act) => act.band === band.id)
              .map((act) => {
                const both = shared.has(act.entityId);
                return (
                  <li
                    key={act.entityId}
                    className="flex flex-wrap items-baseline justify-between gap-x-3"
                  >
                    <span className="text-body font-bold">{act.name}</span>
                    <span
                      className={
                        both
                          ? "rounded-sm border border-accent px-1 text-label font-semibold text-accent"
                          : "text-label text-muted"
                      }
                    >
                      {both
                        ? "On both lineups"
                        : `Only in ${side.festival.city}`}
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * Town against town (M9b): the same headliners and fee ranges in two towns, from their saved
 * builds, side by side. The only thing that changes is the town, so every difference comes
 * from what fans of that town's own venues like.
 */
export function CompareTowns({
  left,
  right,
  towns,
}: {
  left: Side;
  right: Side;
  /** The other towns with a saved build, to compare Boise against. */
  towns: readonly { id: string; label: string }[];
}) {
  const { shared } = compareBills(left.acts, right.acts);
  const total = right.acts.length;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b-2 border-rule px-4 py-3 lg:px-6">
        <div className="flex max-w-4xl flex-col gap-0.5">
          <h1 className="text-body">
            <strong className="font-bold">Undercard</strong>, town against town:{" "}
            {left.festival.city} against {right.festival.city}
          </h1>
          <p className="text-label text-muted">
            The same headliners ({left.festival.headliners.join(" and ")}) and fee ranges in both towns; only the town
            changes. The AI agent drafted each lineup from what fans of that
            town&apos;s own venues like, so {shared.size} of {total} acts are on
            both and {total - shared.size} differ.
          </p>
        </div>
        <Link
          href="/"
          className="self-start text-label underline underline-offset-2 hover:text-accent"
        >
          Back to the lineup
        </Link>
      </header>
      <main className="flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TownBill side={left} shared={shared} />
          <TownBill side={right} shared={shared} />
        </div>
        <nav
          aria-label="Compare with another town"
          className="flex flex-col gap-1"
        >
          <h2 className="text-body font-bold">
            Compare {left.festival.city} with another town
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {towns.map((town) => (
              <li key={town.id}>
                <Link
                  href={`/compare?b=${encodeURIComponent(town.id)}`}
                  aria-current={
                    town.id === right.festival.id ? "page" : undefined
                  }
                  className="text-label underline underline-offset-2 hover:text-accent aria-[current=page]:font-bold aria-[current=page]:no-underline"
                >
                  {town.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
