"use client";

import { useState } from "react";
import { ClimbArrow } from "@/components/chart/band-chart";
import { Cover } from "@/components/chart/cover";
import { whySentence } from "@/components/chart/why";
import { ordinal } from "@/components/chart/words";
import type { FeeBand } from "@/lib/fee-bands";
import {
  formatAffinity,
  formatBandRange,
  formatPercentile,
} from "@/lib/format";
import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import {
  UNAVAILABLE_REASON_IDS,
  UNAVAILABLE_REASONS,
  type UnavailableReason,
} from "@/lib/unavailable";
import type { Placed } from "@/lib/venue-switch";

/**
 * An act's card, opened under its row on the chart: the climb drawn large with the venue whose
 * fans lifted it, the words behind the row's marks (Why Boise), Qloo's affinity and popularity,
 * the two genres it shares with the headliners, then Keep and Unavailable.
 */
export function ActCard({
  act,
  unavailable = false,
  disabled = false,
  onUnavailable,
  onClose,
  city = "Boise",
  kept = false,
  onKeep,
  place,
  hue = null,
  note,
  band,
  image,
}: {
  act: Act;
  /** Struck through while its slot is refilled, or when no refill was found. */
  unavailable?: boolean;
  disabled?: boolean;
  /** Called with the reason the buyer picks: a radius clause, routing or the fee. */
  onUnavailable?: (act: Act, reason: UnavailableReason) => void;
  /** Shown as Close beside the name when the card is opened from the chart. */
  onClose?: () => void;
  /** The festival's town, which names the Why line. */
  city?: string;
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
}) {
  const [asking, setAsking] = useState(false);
  const lift = liftOf(act);
  const popularity = Math.round(act.popularity * 100);
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
          <p className="card-venue">
            <span className="card-swatch" aria-hidden />
            {act.anchorVenue.name} fans like it
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
      <p className="card-climb-title">Its place in Qloo&apos;s ranking</p>
      <div className="card-climb" aria-hidden>
        <span className="card-place">
          {place?.was
            ? ordinal(place.was)
            : lift?.kind === "new"
              ? "outside"
              : "–"}
          <small>
            {lift?.kind === "new" ? "the top 50" : "headliners' fans alone"}
          </small>
        </span>
        <ClimbArrow
          move={lift?.kind === "up" ? lift.places : null}
          fresh={lift?.kind === "new"}
          was={null}
        />
        <span className="card-place">
          {place
            ? ordinal(place.now)
            : lift?.kind === "new"
              ? ordinal(lift.top)
              : "–"}
          <small>with {act.anchorVenue.name}&apos;s fans</small>
        </span>
      </div>
      <p className="card-why">
        <strong>Why {city}: </strong>
        {whySentence(act, place)}
      </p>
      {act.anchorVenue.kind && (
        <p className="card-kind">
          {act.anchorVenue.name} is {act.anchorVenue.kind}, not a club.
        </p>
      )}
      <dl className="card-figures">
        <div>
          <dt>Qloo affinity</dt>
          <dd>{formatAffinity(act.affinity)}</dd>
        </div>
        <div>
          <dt>Popularity</dt>
          <dd>{formatPercentile(act.popularity)}</dd>
        </div>
        <div className="card-pop" aria-hidden>
          <span className="fee-track card-track">
            {band && (
              <span
                className="fee-lit"
                style={{
                  left: `${band.minPopularity * 100}%`,
                  width: `${(band.maxPopularity - band.minPopularity) * 100}%`,
                }}
              />
            )}
            <span className="card-pop-dot" style={{ left: `${popularity}%` }} />
          </span>
          <span className="card-pop-words">
            {band
              ? `popularity on Qloo, inside the ${band.id === "mid" ? "mid-size" : "opening"} fee range (${formatBandRange(band)})`
              : "percentile on Qloo: it stands in for the fee"}
          </span>
        </div>
      </dl>
      <ul aria-label="Tags shared with the headliners" className="card-tags">
        {act.sharedTags.map((tag) => (
          <li key={tag.id}>{tag.name}</li>
        ))}
      </ul>
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
