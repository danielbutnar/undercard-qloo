"use client";

import type { CSSProperties } from "react";
import type { FeeBand } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { Act } from "@/lib/lineup";
import type { Placed } from "@/lib/venue-switch";
import { Cover } from "./cover";
import { ticketStamps, type TwoClimbs } from "./setlist-words";
import { signName } from "./town-scene";
import { useReveal } from "./use-reveal";
import { feeRangeWords, ordinal, PLAIN_BAND } from "./words";

const TIER = { mid: "Mid-size act", opener: "Opening act" } as const;

/**
 * The door check's ticket (WS12 items 1 and 2): one act's ticket for the festival, its rank and
 * climb on the stub in its venue's colour (the only place the colour goes: the stamps are ink),
 * stamped three times: its climb against the bar, or its local lift with both climbs once
 * WS13.3's data carries them (`climbs`); its Qloo popularity on its tier's own scale; the two
 * genres it shares with the headliners. The stamps remount for each act, so they land again.
 */
export function Ticket({
  act,
  band,
  place,
  hue,
  image,
  festival,
  climbs,
}: {
  act: Act;
  band: FeeBand;
  place?: Placed;
  hue: number | null;
  image?: string;
  festival: Pick<Festival, "name" | "city">;
  climbs?: TwoClimbs | null;
}) {
  const stamps = ticketStamps(act, band, climbs);
  const venue = signName(act.anchorVenue.name);
  const { value, min, max } = stamps.popularity;
  const at = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const climb =
    stamps.climb?.kind === "up"
      ? `↑${stamps.climb.places}`
      : stamps.climb?.kind === "new"
        ? "NEW"
        : "–";
  const climbWords =
    stamps.climb?.kind === "new"
      ? "new in Qloo's top 50"
      : `climbs ${stamps.climb?.kind === "up" ? stamps.climb.places : 0} places`;
  const { local } = stamps;
  const first = local
    ? {
        big: `↑${local.lift}`,
        label: `Climb: a local lift of ${local.lift} places, the bar is ${stamps.bar}; ${local.venue} with ${venue}'s fans, ${local.control} with a matched venue abroad`,
      }
    : {
        big: climb,
        label: `Climb: ${climbWords}, the bar is ${stamps.bar}`,
      };
  return (
    <article
      aria-label={`${act.name}'s ticket`}
      className={`ticket ${hue !== null ? `venue-${hue}` : "is-grey"}`}
    >
      <div className="ticket-main">
        <p className="ticket-fest">
          {festival.name} · {festival.city}
        </p>
        <div className="ticket-act">
          <Cover
            image={image}
            genres={act.sharedTags.map((tag) => tag.name)}
            id={act.entityId}
            name={act.name}
            label={false}
            className="ticket-photo"
          />
          <div className="min-w-0">
            <p className="ticket-name">{act.name}</p>
            <p className="ticket-tier">
              {TIER[act.band]}
              <br />
              with {venue}&apos;s fans added
            </p>
          </div>
        </div>
      </div>
      <div className="ticket-stub" aria-hidden>
        <span className="ticket-rank">{place ? ordinal(place.now) : "–"}</span>
        <span className="ticket-climb">{climb}</span>
      </div>
      <ul
        key={act.entityId}
        aria-label="The three checks it passed"
        className="stamps"
      >
        <li
          aria-label={first.label}
          className="stamp stamp-climb"
          style={{ "--i": 0 } as CSSProperties}
        >
          <span className="stamp-big">{first.big}</span>
          {local ? (
            <>
              <span className="stamp-small">
                local lift
                <br />
                the bar is {stamps.bar}
              </span>
              <span className="stamp-fine">
                ↑{local.venue} with {venue}&apos;s fans
                <br />↑{local.control} with a matched venue abroad
              </span>
            </>
          ) : (
            <span className="stamp-small">
              {climbWords}
              <br />
              the bar is {stamps.bar}
            </span>
          )}
        </li>
        <li
          aria-label={`Popularity: ${value} on Qloo, inside ${min}–${max}`}
          className="stamp stamp-pop"
          style={{ "--i": 1 } as CSSProperties}
        >
          <span className="stamp-big">{value}</span>
          <span className="stamp-scale" aria-hidden>
            <span>{min}</span>
            <span className="stamp-track">
              <span className="stamp-dot" style={{ left: `${at}%` }} />
            </span>
            <span>{max}</span>
          </span>
          <span className="stamp-small">
            popularity, inside{" "}
            <span className="nowrap">
              {min}–{max}
            </span>
          </span>
        </li>
        <li
          aria-label={`Genres: ${stamps.genres[0]} and ${stamps.genres[1]}, shared with the headliners`}
          className="stamp stamp-genres"
          style={{ "--i": 2 } as CSSProperties}
        >
          <span className="stamp-genre">{stamps.genres[0]}</span>
          <span className="stamp-genre">{stamps.genres[1]}</span>
          <span className="stamp-small">
            shared with
            <br />
            the headliners
          </span>
        </li>
      </ul>
    </article>
  );
}

/**
 * The door check (WS12 item 1), under the poster where How an act gets on stood: the ticket of
 * the act pointed at on the poster (the first act until then), the rule that fills a slot, and
 * each fee range in words.
 */
export function DoorCheck({
  festival,
  act,
  place,
  hue,
  image,
  climbs,
}: {
  festival: Festival;
  act: Act;
  place?: Placed;
  hue: number | null;
  image?: string;
  climbs?: TwoClimbs | null;
}) {
  const reveal = useReveal<HTMLElement>();
  const band = festival.feeBands.find((entry) => entry.id === act.band);
  if (!band) return null;
  return (
    <section
      ref={reveal}
      aria-labelledby="door-check-title"
      className="door-check"
    >
      <h2 id="door-check-title" className="backstage-title">
        The door check
      </h2>
      <p className="backstage-lede">
        Every act on your poster got past these three checks.
        <span className="wide-only">
          {" "}
          Point at an act on the poster for its ticket.
        </span>
      </p>
      <Ticket
        act={act}
        band={band}
        place={place}
        hue={hue}
        image={image}
        festival={festival}
        climbs={climbs}
      />
      <p className="door-rule">
        Of the acts that pass all three, the strongest Qloo match fills each
        slot first.
      </p>
      <ul aria-label="Fee ranges" className="door-ranges">
        {festival.feeBands.map((entry) => (
          <li key={entry.id}>
            <strong>{PLAIN_BAND[entry.id]}:</strong> {feeRangeWords(entry)}
          </li>
        ))}
      </ul>
    </section>
  );
}
