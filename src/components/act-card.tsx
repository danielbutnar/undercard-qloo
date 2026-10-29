"use client";

import { useState } from "react";
import { Cover } from "@/components/chart/cover";
import {
  cardBand,
  CARD_CHECKS,
  cardClimbRule,
  cardGenresLine,
  cardPopularityLine,
  CARD_STRONGEST,
} from "@/components/chart/poster-words";
import { whySentence } from "@/components/chart/why";
import { ordinal, venueShort } from "@/components/chart/words";
import { climbsLine, locationLine } from "@/lib/agent-words";
import type { SplitLine } from "@/lib/attribution-line";
import type { FeeBand } from "@/lib/fee-bands";
import {
  formatAffinity,
  formatPopularity,
  formatPopularityRange,
} from "@/lib/format";
import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import {
  UNAVAILABLE_REASON_IDS,
  UNAVAILABLE_REASONS,
  type UnavailableReason,
} from "@/lib/unavailable";
import type { Placed } from "@/lib/venue-switch";

/** A check the act passed, ticked in its venue's colour (WS9: inline SVG, no emoji). */
function Tick() {
  return (
    <svg viewBox="0 0 18 18" className="card-tick" aria-hidden>
      <rect x="1" y="1" width="16" height="16" className="card-tick-box" />
      <path d="M4.5 9.2 L7.6 12.2 L13.5 5.8" className="card-tick-mark" />
    </svg>
  );
}

/**
 * An act's card (WS9, the layout brief's card): its photo, name and slot, the venue whose fans
 * lifted it, then "Why it's on your poster" as the three checks every act on the poster passed:
 * the climb drawn large with its places and the words behind the act's mark (Why it's here), the
 * fee range with Qloo's affinity and popularity, and the two genres it shares with the
 * headliners; then the rule that fills a slot, Qloo's own split of the act's match when the
 * first bill has it (WS7), Keep and Unavailable.
 */
export function ActCard({
  act,
  unavailable = false,
  disabled = false,
  onUnavailable,
  onClose,
  kept = false,
  onKeep,
  place,
  hue = null,
  note,
  band,
  image,
  split,
}: {
  act: Act;
  /** Struck through while its slot is refilled, or when no refill was found. */
  unavailable?: boolean;
  disabled?: boolean;
  /** Called with the reason the buyer picks: a radius clause, routing or the fee. */
  onUnavailable?: (act: Act, reason: UnavailableReason) => void;
  /** Shown as Close beside the name when the card is opened from the chart. */
  onClose?: () => void;
  /** The buyer keeps this act (M8c); a redraft refills every other slot. */
  kept?: boolean;
  onKeep?: (act: Act) => void;
  /** Its place now and for the headliners alone, when the build tells. */
  place?: Placed;
  /** Its venue's colour on the chart. */
  hue?: number | null;
  /** Why Keep and Unavailable are missing, when they are. */
  note?: string;
  /** The act's fee range, lit on the popularity scale. */
  band?: FeeBand;
  /** Its image on Qloo, only while ARTIST_IMAGES is on. */
  image?: string;
  /**
   * Qloo's split of its match (src/lib/attribution-line.ts), worked out on the server from the
   * Qloo cache: only for an act on the saved lineup with every venue on.
   */
  split?: SplitLine;
}) {
  const [asking, setAsking] = useState(false);
  const lift = liftOf(act);
  // The label on the row's tab ("V418"): a phone's venue line uses it so it fits in two lines.
  const short = venueShort(act.anchorVenue.name);
  return (
    <article
      aria-label={act.name}
      className={`card ${hue !== null ? `venue-${hue}` : ""} ${unavailable ? "card-gone" : ""}`}
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
          {unavailable && <p className="row-flag row-gone">Unavailable</p>}
          <h4 className="card-name">{act.name}</h4>
          {band && <p className="card-band">{cardBand(band)}</p>}
          <p className="card-venue">
            <span className="card-swatch" aria-hidden />
            {short !== act.anchorVenue.name && (
              <span className="card-venue-short">
                Climbs with {short}&apos;s fans added
              </span>
            )}
            <span className="card-venue-full">
              Climbs with {act.anchorVenue.name}&apos;s fans added
            </span>
          </p>
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
      <p className="card-checks-title">{CARD_CHECKS}</p>
      <ul aria-label="The three checks it passed" className="card-checks">
        <li className="card-check">
          <Tick />
          <div className="card-check-body">
            <p className="card-climb-title">Its place in Qloo&apos;s ranking</p>
            {/* WS12 item 3: its rank beside its climb, as the poster prints them. */}
            <div className="card-rank">
              <span className="card-rank-place">
                {place
                  ? ordinal(place.now)
                  : lift?.kind === "new"
                    ? ordinal(lift.top)
                    : "–"}
              </span>
              {lift && (
                <span className="card-rank-climb">
                  {lift.kind === "up" ? `↑${lift.places}` : "NEW"}
                </span>
              )}
              <span className="card-rank-with">
                in Qloo&apos;s ranking with {act.anchorVenue.name}&apos;s fans
                added
              </span>
            </div>
            <p className="card-rank-from">
              {place?.was
                ? `${ordinal(place.was)} for the headliners' fans alone`
                : "Outside the top 50 for the headliners' fans alone"}
            </p>
            <p className="card-why">
              <strong>Why it&apos;s here: </strong>
              {whySentence(act, place)}
            </p>
            {/* WS13.3: both climbs, the town venue's and its control's (a room in the control town with similar Qloo popularity). */}
            {act.localLift && (
              <p className="card-check-rule">{climbsLine(act)}</p>
            )}
            <p className="card-check-rule">{cardClimbRule()}</p>
          </div>
        </li>
        <li className="card-check">
          <Tick />
          <div className="card-check-body">
            <p className="card-check-text">{cardPopularityLine(band)}</p>
            <dl className="card-figures">
              <div>
                <dt>Qloo affinity</dt>
                <dd>{formatAffinity(act.affinity)}</dd>
              </div>
              <div>
                <dt>Popularity</dt>
                <dd>{formatPopularity(act.popularity)}</dd>
              </div>
              {band && (
                <p className="card-pop-words">
                  popularity on Qloo, inside the{" "}
                  {band.id === "mid" ? "mid-size" : "opening"} fee range (
                  {formatPopularityRange(band)})
                </p>
              )}
              {band && (
                <div
                  role="img"
                  aria-label={`Popularity ${formatPopularity(act.popularity)} on the ${band.id === "mid" ? "mid-size" : "opening"} tier's scale, ${formatPopularityRange(band).replace("–", " to ")}`}
                  className="card-scale"
                >
                  <span>{Math.round(band.minPopularity * 100)}</span>
                  <span className="card-scale-track">
                    <span
                      className="card-scale-dot"
                      style={{
                        left: `${Math.min(100, Math.max(0, ((act.popularity - band.minPopularity) / (band.maxPopularity - band.minPopularity)) * 100))}%`,
                      }}
                    >
                      {formatPopularity(act.popularity)}
                    </span>
                  </span>
                  <span>{Math.round(band.maxPopularity * 100)}</span>
                </div>
              )}
            </dl>
          </div>
        </li>
        <li className="card-check">
          <Tick />
          <div className="card-check-body">
            <p className="card-check-text">
              {cardGenresLine(act.sharedTags.length)}
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
      <p className="card-strongest">{CARD_STRONGEST}</p>
      {/* After the rule, outside the checks: Qloo's split as it comes, never a check that backs
          the venue the card credits. A phone names each venue by its mark, as its venue line does. */}
      {split && (
        <p className="card-split">
          {split.short !== split.line && (
            <span className="card-split-short">{split.short}</span>
          )}
          <span className="card-split-full">{split.line}</span>
        </p>
      )}
      {/* WS13.10: why the credit stands where another venue's share is larger. */}
      {split?.credit && <p className="card-credit">{split.credit}</p>}
      {/* WS13.4: Qloo's location signal, a second reading, only where Qloo answered it. */}
      {act.location && (
        <p className="card-location">{locationLine(act.location)}</p>
      )}
      {act.anchorVenue.kind && (
        <p className="card-kind">
          {act.anchorVenue.name} is {act.anchorVenue.kind}, not a club.
        </p>
      )}
      {note && <p className="card-note">{note}</p>}
      <div className="card-actions">
        {onKeep && !unavailable && !asking && (
          <button
            type="button"
            aria-pressed={kept}
            disabled={disabled}
            onClick={() => onKeep(act)}
            className="tool card-keep"
          >
            Keep
          </button>
        )}
        {onUnavailable && !unavailable && !asking && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAsking(true)}
            className="link card-unavailable"
          >
            Unavailable
          </button>
        )}
        {onUnavailable && !unavailable && asking && (
          <div
            role="group"
            aria-labelledby={`why-${act.entityId}`}
            className="card-reasons"
          >
            <p id={`why-${act.entityId}`} className="card-reasons-title">
              Why is it unavailable?
            </p>
            {UNAVAILABLE_REASON_IDS.map((reason) => (
              <button
                key={reason}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setAsking(false);
                  onUnavailable(act, reason);
                }}
                className="tool card-reason"
              >
                {UNAVAILABLE_REASONS[reason].replace(/^./, (first) =>
                  first.toUpperCase(),
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="link"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
