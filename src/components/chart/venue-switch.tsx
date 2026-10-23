"use client";

import type { VenueSwitchStatus } from "@/components/use-venue-switch";
import { liftedWords, venuesTitle, VENUES_STAND_FOR } from "./words";

export interface VenueLine {
  entityId: string;
  name: string;
  /** Its colour on the chart (src/lib/venue-colours.ts). */
  hue: number;
  /** Acts on the lineup its fans lifted, as the lineup stands. */
  lifted: number;
  /** "an arena", "a festival"…, when it isn't a club (M6l). */
  kind?: string;
  /** Qloo had no fan data for it (WS8): said as its sign says it. */
  noFanData?: boolean;
}

/**
 * The venue switch: each venue the AI agent read, in its colour, with the acts its fans lifted.
 * Switching one off re-forms the lineup by the same rule from the saved build (src/lib/
 * venue-switch.ts), with no Qloo or model call; switching it on brings the lineup back.
 */
const unscored = (venue: VenueLine) =>
  venue.noFanData === true && venue.lifted === 0;

export function VenueSwitch({
  city,
  venues,
  off,
  status,
  onToggle,
  onReset,
  filled,
  slots,
  placesListed,
  editable = true,
}: {
  city: string;
  venues: readonly VenueLine[];
  off: ReadonlySet<string>;
  status: VenueSwitchStatus;
  onToggle: (venueId: string) => void;
  onReset: () => void;
  filled: number;
  slots: number;
  /** Live-music places Qloo listed in the town, from the build's venue search. */
  placesListed: number | null;
  /** False while Watch plays or a refill runs: the switch waits. */
  editable?: boolean;
}) {
  const usable = status === "ready" && editable;
  return (
    <section aria-label={venuesTitle(city)} className="panel">
      <h2 className="panel-title">Switch a venue off</h2>
      <p className="panel-sub">
        The lineup re-forms by the same rule, without that venue&apos;s fans.
      </p>
      <ul className="venues-list">
        {venues.map((venue) => {
          const on = !off.has(venue.entityId);
          return (
            <li key={venue.entityId}>
              <button
                type="button"
                aria-pressed={on}
                disabled={!usable}
                onClick={() => onToggle(venue.entityId)}
                className={`venue-toggle venue-${venue.hue}`}
                aria-label={`${venue.name}: ${on ? "on" : "off"}, ${unscored(venue) ? "no fan data" : liftedWords(venue.lifted)}`}
              >
                <span className="swatch" aria-hidden />
                <span className="venue-name">
                  {venue.name}
                  {venue.kind ? ` (${venue.kind}, not a club)` : ""}
                </span>
                <span className="venue-lifted">
                  {venue.lifted > 0 && (
                    <span className="pips" aria-hidden>
                      {Array.from(
                        { length: Math.min(venue.lifted, 10) },
                        (_, i) => (
                          <i key={i} />
                        ),
                      )}
                    </span>
                  )}
                  {unscored(venue) ? "no fan data" : liftedWords(venue.lifted)}
                </span>
                <span className="rocker" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="switch-state" role="status">
        {status === "loading"
          ? "Loading the saved build's venue results…"
          : status === "unavailable"
            ? "The switch isn't available for this lineup."
            : `${filled} of ${slots} slots filled`}
        {off.size > 0 && (
          <button type="button" className="switch-reset" onClick={onReset}>
            All venues on
          </button>
        )}
      </p>
      <p className="panel-sub">
        {placesListed !== null
          ? `Qloo listed ${placesListed} ${city} live-music places; the AI agent read the fans of these ${venues.length}. `
          : ""}
        {VENUES_STAND_FOR}
      </p>
    </section>
  );
}
