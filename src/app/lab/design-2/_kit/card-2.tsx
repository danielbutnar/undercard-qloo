"use client";

import { Cover } from "@/components/chart/cover";
import { signName } from "@/components/chart/town-scene";
import { whySentence } from "@/components/chart/why";
import { ordinal } from "@/components/chart/words";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { SplitLine } from "@/lib/attribution-line";
import type { FeeBand } from "@/lib/fee-bands";
import { formatAffinity } from "@/lib/format";
import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import type { Placed } from "@/lib/venue-switch";
import { ticketStamps } from "@/components/chart/setlist-words";

const TIER = { mid: "Mid-size act", opener: "Opening act" } as const;
const RANGE = { mid: "mid-size", opener: "opening" } as const;

/** A check the act passed, ticked in its venue's colour. */
function Tick() {
  return (
    <svg viewBox="0 0 18 18" className="card-tick" aria-hidden>
      <rect x="1" y="1" width="16" height="16" className="card-tick-box" />
      <path d="M4.5 9.2 L7.6 12.2 L13.5 5.8" className="card-tick-mark" />
    </svg>
  );
}

/**
 * The act card, finished (WS12 item 3): the actions pinned (WS8, kept); its rank beside its
 * climb, as the poster prints them ("5th ↑14"), "with <venue>'s fans added"; its popularity on
 * its own tier's scale (80 to 92), not on 0 to 100; and, once WS13.3 lands, both climbs and the
 * local lift between them (`control`: step 0 shows only where that line goes).
 */
export function Card2({
  act,
  band,
  place,
  hue,
  image,
  split,
  control = false,
  onClose,
}: {
  act: Act;
  band: FeeBand;
  place?: Placed;
  hue: number | null;
  image?: string;
  split?: SplitLine;
  control?: boolean;
  onClose?: () => void;
}) {
  const lift = liftOf(act);
  const stamps = ticketStamps(act, band);
  const { value, min, max } = stamps.popularity;
  const at = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const venue = signName(act.anchorVenue.name);
  const climb =
    lift?.kind === "up" ? `↑${lift.places}` : lift?.kind === "new" ? "NEW" : "";
  return (
    <article
      aria-label={act.name}
      className={`card d2-card ${hue !== null ? `venue-${hue}` : ""}`}
    >
      <div className="card-head">
        <Cover
          image={image}
          genres={act.sharedTags.map((tag) => tag.name)}
          id={act.entityId}
          name={act.name}
          label
          className="card-sleeve"
        />
        <div className="min-w-0">
          <h4 className="card-name">{act.name}</h4>
          <p className="d2-card-tier">{TIER[act.band]}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the card"
            className="card-close"
          >
            Close
          </button>
        )}
      </div>

      {/* Rank beside climb, as the poster prints them. */}
      <div className="d2-card-rank">
        <span className="d2-card-place">
          {place
            ? ordinal(place.now)
            : lift?.kind === "new"
              ? ordinal(lift.top)
              : "–"}
        </span>
        {climb && <span className="d2-card-climb">{climb}</span>}
        <span className="d2-card-with">
          in Qloo&apos;s ranking with {venue}&apos;s fans added
        </span>
      </div>
      <p className="d2-card-from">
        {place?.was
          ? `${ordinal(place.was)} for the headliners' fans alone`
          : "Outside the top 50 for the headliners' fans alone"}
      </p>
      {control && (
        <div className="d2-card-control">
          <p>
            <strong>{climb}</strong> with {venue}&apos;s fans ·{" "}
            <strong className="d2-card-pending">↑?</strong> with a matched venue
            abroad
          </p>
          <p className="d2-card-lift">
            Local lift <strong className="d2-card-pending">?</strong> · the bar
            is {MIN_LIFT}
          </p>
          <p className="d2-card-pending-note">
            Step 0: where WS13.3&apos;s second climb goes. Its numbers come with
            WS13.
          </p>
        </div>
      )}
      <p className="card-why">
        <strong>Why it&apos;s here: </strong>
        {whySentence(act, place)}
      </p>

      <p className="card-checks-title">Why it&apos;s on your poster</p>
      <ul
        aria-label="The three checks it passed"
        className="card-checks d2-card-checks"
      >
        <li className="card-check">
          <Tick />
          <p className="card-check-text">
            {lift?.kind === "new"
              ? "New in Qloo's top 50"
              : `Climbs ${lift?.kind === "up" ? lift.places : 0} places`}
            ; the bar is {MIN_LIFT}
          </p>
        </li>
        <li className="card-check">
          <Tick />
          <div className="card-check-body">
            <p className="card-check-text">
              Popularity <strong>{value}</strong>, inside the {RANGE[act.band]}{" "}
              range: our stand-in for fee
            </p>
            {/* The tier's own scale: its two edges, the act's place between them. */}
            <div className="d2-card-scale" aria-hidden>
              <span>{min}</span>
              <span className="d2-card-track">
                <span className="d2-card-dot" style={{ left: `${at}%` }}>
                  {value}
                </span>
              </span>
              <span>{max}</span>
            </div>
          </div>
        </li>
        <li className="card-check">
          <Tick />
          <div className="card-check-body">
            <p className="card-check-text">
              Shares two genres with the headliners
            </p>
            <ul
              aria-label="Tags shared with the headliners"
              className="card-tags"
            >
              {act.sharedTags.map((tag) => (
                <li key={tag.id}>{tag.name}</li>
              ))}
            </ul>
          </div>
        </li>
      </ul>
      <p className="d2-card-affinity">
        Qloo affinity <strong>{formatAffinity(act.affinity)}</strong>: of the
        acts that pass all three, the strongest match fills each slot first.
      </p>
      {split && <p className="card-split">{split.line}</p>}
      <div className="card-actions">
        <button type="button" className="tool card-keep">
          Keep
        </button>
        <button type="button" className="link card-unavailable">
          Unavailable
        </button>
      </div>
    </article>
  );
}
