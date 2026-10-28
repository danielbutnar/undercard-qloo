"use client";

import type { CSSProperties } from "react";
import { Cover } from "@/components/chart/cover";
import { signName } from "@/components/chart/town-scene";
import { ordinal } from "@/components/chart/words";
import type { FeeBand } from "@/lib/fee-bands";
import type { Act } from "@/lib/lineup";
import type { Placed } from "@/lib/venue-switch";
import { ticketStamps } from "@/components/chart/setlist-words";

const TIER = { mid: "Mid-size act", opener: "Opening act" } as const;

/**
 * The door check's ticket (WS12 items 1 and 2): one act's ticket for the festival, its rank and
 * climb on the stub in its venue's colour, stamped three times: its climb against the bar (its
 * local lift once WS13.3 lands), its Qloo popularity on its tier's own scale, and the two genres
 * it shares with the headliners. The stamps remount for each act, so they land again.
 */
export function Ticket({
  act,
  band,
  place,
  hue,
  image,
  festival,
}: {
  act: Act;
  band: FeeBand;
  place?: Placed;
  hue: number | null;
  image?: string;
  festival: { name: string; city: string };
}) {
  const stamps = ticketStamps(act, band);
  const { value, min, max } = stamps.popularity;
  const at = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const climb =
    stamps.climb?.kind === "up"
      ? `↑${stamps.climb.places}`
      : stamps.climb?.kind === "new"
        ? "NEW"
        : "–";
  const venue = signName(act.anchorVenue.name);
  return (
    <article
      aria-label={`${act.name}'s ticket`}
      className={`d2-ticket ${hue !== null ? `venue-${hue}` : "is-grey"}`}
    >
      <div className="d2-ticket-main">
        <p className="d2-ticket-fest">
          {festival.name} · {festival.city}
        </p>
        <div className="d2-ticket-act">
          <Cover
            image={image}
            genres={act.sharedTags.map((tag) => tag.name)}
            id={act.entityId}
            name={act.name}
            label={false}
            className="d2-ticket-photo"
          />
          <div className="min-w-0">
            <p className="d2-ticket-name">{act.name}</p>
            <p className="d2-ticket-tier">
              {TIER[act.band]}
              <br />
              with {venue}&apos;s fans added
            </p>
          </div>
        </div>
      </div>
      <div className="d2-ticket-stub" aria-hidden>
        <span className="d2-ticket-rank">
          {place ? ordinal(place.now) : "–"}
        </span>
        <span className="d2-ticket-climb">{climb}</span>
      </div>
      <ul
        key={act.entityId}
        aria-label="The three checks it passed"
        className="d2-stamps"
      >
        <li
          className="d2-stamp d2-stamp-climb"
          style={{ "--i": 0 } as CSSProperties}
        >
          <span className="d2-stamp-big">{climb}</span>
          <span className="d2-stamp-small">
            {stamps.climb?.kind === "new"
              ? "new in Qloo's top 50"
              : `climbs ${stamps.climb?.kind === "up" ? stamps.climb.places : 0} places`}
            <br />
            the bar is {stamps.bar}
          </span>
        </li>
        <li
          className="d2-stamp d2-stamp-pop"
          style={{ "--i": 1 } as CSSProperties}
        >
          <span className="d2-stamp-big">{value}</span>
          <span className="d2-stamp-scale" aria-hidden>
            <span className="d2-stamp-end">{min}</span>
            <span className="d2-stamp-track">
              <span className="d2-stamp-dot" style={{ left: `${at}%` }} />
            </span>
            <span className="d2-stamp-end">{max}</span>
          </span>
          <span className="d2-stamp-small">
            popularity, inside{" "}
            <span className="d2-nowrap">
              {min}–{max}
            </span>
          </span>
        </li>
        <li
          className="d2-stamp d2-stamp-genres"
          style={{ "--i": 2 } as CSSProperties}
        >
          <span className="d2-stamp-genre">{stamps.genres[0]}</span>
          <span className="d2-stamp-genre">{stamps.genres[1]}</span>
          <span className="d2-stamp-small">
            shared with
            <br />
            the headliners
          </span>
        </li>
      </ul>
    </article>
  );
}
