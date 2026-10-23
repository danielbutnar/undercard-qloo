"use client";

import { useEffect, useRef } from "react";
import { Tri } from "@/components/chart/band-chart";
import { Cover } from "@/components/chart/cover";
import { ordinal, venueShort } from "@/components/chart/words";
import type { Shortlist, ShortlistAct, ShortlistVenue } from "@/lib/shortlist";
import { festivalById } from "@/lib/towns";
import {
  CLIMB_KEY,
  climbWords,
  feeWords,
  genreWords,
  missingWords,
  venueWords,
} from "./words";

type Found = Extract<ShortlistAct, { status: "found" }>;

/** The climb's small ladder under the name, from its place alone up to its place with the venue. */
function Ladder({
  from,
  to,
  share,
}: {
  from: number;
  to: number;
  share: number;
}) {
  return (
    <span className="ladder" aria-hidden>
      <span>{ordinal(from)}</span>
      <span className="ladder-arrow" style={{ ["--share" as string]: share }}>
        <span className="ladder-shaft" />
        <svg viewBox="0 0 6 10" className="ladder-head">
          <path d="M0 0 6 5 0 10z" />
        </svg>
      </span>
      <span className="ladder-to">{ordinal(to)}</span>
    </span>
  );
}

/** A found act's row, in the lineup's row style: its climb, its venue's tab and three lines. */
function FoundRow({
  act,
  venues,
  feeBands,
  ranked,
}: {
  act: Found;
  venues: readonly ShortlistVenue[];
  feeBands: Parameters<typeof feeWords>[1];
  /** Acts ranked in each call, the most places an act can climb plus one. */
  ranked: number;
}) {
  const lifted =
    act.climb !== null &&
    act.climb > 0 &&
    act.best !== null &&
    act.alone !== null;
  const venue = lifted
    ? venues.find((entry) => entry.entityId === act.best?.venueId)
    : undefined;
  const hue = venue?.hue ?? null;
  return (
    <article
      aria-label={act.qlooName}
      className={`row shortlist-row ${hue !== null ? `venue-${hue}` : ""}`}
    >
      <span className="row-place row-hero" aria-hidden>
        {lifted ? (
          <>
            <Tri className="hero-tri" />
            {act.climb}
          </>
        ) : (
          "·"
        )}
      </span>
      {lifted ? (
        <Ladder
          from={act.alone!}
          to={act.best!.place}
          share={Math.min(
            1,
            Math.max(0.18, act.climb! / Math.max(1, ranked - 1)),
          )}
        />
      ) : (
        <span className="ladder" />
      )}
      <Cover
        genres={act.genres}
        id={act.entityId}
        name={act.qlooName}
        label={false}
        className="row-sleeve"
      />
      <div className="row-who">
        <h3 className="row-name">{act.qlooName}</h3>
      </div>
      <div className="shortlist-lines">
        <p className="shortlist-climb">{climbWords(act, venues)}</p>
        <p className="row-genres">{feeWords(act, feeBands)}</p>
        <p className="row-genres">{genreWords(act)}</p>
      </div>
      {venue ? (
        <span className="row-venue" aria-hidden>
          <span>{venueShort(venue.name)}</span>
        </span>
      ) : (
        <span className="row-venue row-venue-none" aria-hidden />
      )}
    </article>
  );
}

/** A name with no numbers: not found, not checked, or one of the headliners. */
function MissingRow({ act }: { act: Exclude<ShortlistAct, Found> }) {
  return (
    <article aria-label={act.name} className="row shortlist-row is-missing">
      <span className="row-place row-hero" aria-hidden>
        ·
      </span>
      <span className="ladder" />
      <span className="row-sleeve shortlist-no-sleeve" aria-hidden />
      <div className="row-who">
        <h3 className="row-name">{act.name}</h3>
      </div>
      <div className="shortlist-lines">
        <p className="row-genres">{missingWords(act)}</p>
      </div>
      <span className="row-venue row-venue-none" aria-hidden />
    </article>
  );
}

/**
 * A check's answer: the venues whose fans it read, then the rows sorted by climb (step 3), in
 * the lineup's row style: the climb large, a small ladder, the act's sleeve and its venue's tab.
 */
export function ShortlistResults({
  shortlist,
  title,
  note,
  focusKey = 0,
}: {
  shortlist: Shortlist;
  title: string;
  /** A line under the title: what these names are (Boise's example). */
  note?: string;
  /** Bumped by each check the buyer runs: the answer's heading takes focus and comes into view. */
  focusKey?: number;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusKey > 0) heading.current?.focus();
  }, [focusKey]);
  const feeBands = festivalById(shortlist.festivalId) ?? {
    feeBands: [],
  };
  const ranked = shortlist.acts.filter((act) => act.status === "found").length;
  const heads = shortlist.headliners.join(" and ");
  return (
    <section
      aria-labelledby="shortlist-results-title"
      className="shortlist-results"
    >
      <div className="panel">
        <h2
          ref={heading}
          id="shortlist-results-title"
          tabIndex={-1}
          className="panel-title shortlist-title"
        >
          {title}
        </h2>
        {note && <p className="shortlist-intro">{note}</p>}
        <p className="panel-sub">
          {shortlist.ranked
            ? `Qloo ranks your acts for ${heads}'s fans, then again with each ${shortlist.city} venue's fans added.`
            : `Qloo found none of these names, so there is nothing to rank for ${heads}'s fans.`}
        </p>
        {shortlist.ranked && (
          <ul
            aria-label="Venue fans read"
            className="venues-list shortlist-venues"
          >
            {shortlist.venues.map((venue) => (
              <li
                key={venue.entityId}
                className={`venue-toggle shortlist-venue ${venue.hue !== null ? `venue-${venue.hue}` : "is-grey"}`}
              >
                <span className="swatch" aria-hidden />
                <span className="venue-name">
                  {venueWords(venue, {
                    cap: shortlist.cap,
                    pasted: shortlist.acts.length,
                    venues: shortlist.venues.length,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="band numbers-climb">
        {shortlist.ranked && (
          <p className="numbers-key">
            <Tri />
            {CLIMB_KEY}
          </p>
        )}
        <ol aria-label="Your acts, by climb" className="rows">
          {shortlist.acts.map((act) => (
            <li key={`${act.status}:${act.name}`}>
              {act.status === "found" ? (
                <FoundRow
                  act={act}
                  venues={shortlist.venues}
                  feeBands={feeBands}
                  ranked={ranked}
                />
              ) : (
                <MissingRow act={act} />
              )}
            </li>
          ))}
        </ol>
      </div>
      {shortlist.repeats.length > 0 && (
        <p className="shortlist-note">
          Checked once:{" "}
          {shortlist.repeats
            .map((repeat) =>
              repeat.name.toLowerCase() === repeat.sameAs.toLowerCase()
                ? `${repeat.name} (listed twice)`
                : `${repeat.name} (the same act as ${repeat.sameAs})`,
            )
            .join(", ")}
          .
        </p>
      )}
    </section>
  );
}
