import Link from "next/link";
import { Sleeve } from "@/components/chart/sleeve";
import { TopBar } from "@/components/chart/top-bar";
import { compareBills } from "@/lib/compare";
import type { FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { Act } from "@/lib/lineup";
import { venueHues } from "@/lib/venue-colours";
import "./chart/chart.css";

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

/**
 * Shared and town-only acts as a picture: two lineups as two circles, the acts on both where
 * they overlap.
 */
function Overlap({
  left,
  right,
  shared,
  total,
}: {
  left: string;
  right: string;
  shared: number;
  total: number;
}) {
  const only = total - shared;
  return (
    <svg
      viewBox="0 0 460 230"
      role="img"
      aria-label={`${shared} acts on both lineups, ${only} only in ${left} and ${only} only in ${right}`}
      className="overlap"
    >
      <defs>
        <clipPath id="overlap-left">
          <circle cx="165" cy="95" r="88" />
        </clipPath>
      </defs>
      <circle cx="165" cy="95" r="88" className="overlap-left" />
      <circle cx="295" cy="95" r="88" className="overlap-left" />
      <circle
        cx="295"
        cy="95"
        r="88"
        clipPath="url(#overlap-left)"
        className="overlap-both"
      />
      <circle cx="165" cy="95" r="88" className="overlap-ring" />
      <circle cx="295" cy="95" r="88" className="overlap-ring" />
      <text x="120" y="110" textAnchor="middle" className="overlap-n">
        {only}
      </text>
      <text x="230" y="110" textAnchor="middle" className="overlap-n">
        {shared}
      </text>
      <text x="340" y="110" textAnchor="middle" className="overlap-n">
        {only}
      </text>
      <text x="120" y="212" textAnchor="middle" className="overlap-l">
        only {left}
      </text>
      <text x="230" y="212" textAnchor="middle" className="overlap-l">
        on both
      </text>
      <text x="340" y="212" textAnchor="middle" className="overlap-l">
        only {right}
      </text>
    </svg>
  );
}

/** One town's lineup, each act marked as on both lineups or only in this town. */
function TownChart({
  side,
  shared,
}: {
  side: Side;
  shared: ReadonlySet<string>;
}) {
  const place = placeOf(side.festival);
  const hues = venueHues(
    side.acts.map((act) => act.anchorVenue),
    side.acts,
  );
  return (
    <section aria-label={place} className="town-chart">
      <h2 className="town-chart-name">{place}</h2>
      <p className="town-chart-venues">
        From the fans of{" "}
        {side.venues.map((name, index) => (
          <span key={name}>
            {index > 0 && (index === side.venues.length - 1 ? " and " : ", ")}
            {name}
          </span>
        ))}
      </p>
      {side.festival.feeBands.map((band) => (
        <div key={band.id} className="town-band">
          <h3 className="town-band-name">{PLAIN_BAND[band.id]}</h3>
          <ul className="rows">
            {side.acts
              .filter((act) => act.band === band.id)
              .map((act) => {
                const both = shared.has(act.entityId);
                return (
                  <li
                    key={act.entityId}
                    className={`town-act venue-${hues.get(act.anchorVenue.entityId) ?? 0} ${both ? "is-both" : ""}`}
                  >
                    <Sleeve
                      genres={act.sharedTags.map((tag) => tag.name)}
                      id={act.entityId}
                      label={false}
                      className="town-sleeve"
                    />
                    <span className="town-act-who">
                      <span className="town-act-name">{act.name}</span>
                      <span className="town-act-genres">
                        {act.sharedTags.map((tag) => tag.name).join(" · ")}
                      </span>
                    </span>
                    <span className={both ? "town-both" : "town-only"}>
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
    <div className="chart-app stage-bg">
      <TopBar>
        <Link href="/">Back to the lineup</Link>
      </TopBar>
      <main className="compare">
        <div className="compare-lead">
          <div>
            <h1 className="compare-title">
              {left.festival.city} against {right.festival.city}
            </h1>
            <p className="compare-what">
              The same headliners ({left.festival.headliners.join(" and ")}) and
              fee ranges in both towns; only the town changes. Undercard drafted
              each lineup from what fans of that town&apos;s own venues like, so{" "}
              {shared.size} of {total} acts are on both and{" "}
              {total - shared.size} differ.
            </p>
          </div>
          <Overlap
            left={left.festival.city}
            right={right.festival.city}
            shared={shared.size}
            total={total}
          />
        </div>
        <div className="compare-towns">
          <TownChart side={left} shared={shared} />
          <TownChart side={right} shared={shared} />
        </div>
        <nav aria-label="Compare with another town" className="panel">
          <h2 className="panel-title">
            Compare {left.festival.city} with another town
          </h2>
          <p className="town-links">
            {towns.map((town) => (
              <Link
                key={town.id}
                href={`/compare?b=${encodeURIComponent(town.id)}`}
                aria-current={
                  town.id === right.festival.id ? "page" : undefined
                }
                className="town-link"
              >
                {town.label}
              </Link>
            ))}
          </p>
        </nav>
      </main>
    </div>
  );
}
