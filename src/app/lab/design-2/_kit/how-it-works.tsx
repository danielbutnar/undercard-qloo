"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Cover } from "@/components/chart/cover";
import { HeadlinerList } from "@/components/chart/poster";
import { climbMark } from "@/components/chart/poster-words";
import {
  TownScene,
  signName,
  type SceneVenue,
} from "@/components/chart/town-scene";
import { ordinal, PLAIN_BAND } from "@/components/chart/words";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { ArtistImages } from "@/lib/artist-images";
import type { Festival } from "@/lib/festival";
import { formatPopularityRange } from "@/lib/format";
import { actsInBand, type Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import type { Placed } from "@/lib/venue-switch";
import type { LabStory } from "./data";
import { Ticket } from "./ticket";
import { useReveal } from "./use-reveal";

/** One scene of the director's cut: its number, its line, and the landing's objects playing it. */
function Scene({
  n,
  title,
  line,
  children,
  wide = false,
}: {
  n: number;
  title: ReactNode;
  line: ReactNode;
  children: ReactNode;
  /** The stage takes the scene's whole width under the caption. */
  wide?: boolean;
}) {
  const reveal = useReveal<HTMLElement>(0.3);
  return (
    <section
      ref={reveal}
      aria-labelledby={`d2-scene-${n}`}
      className={`d2-scene ${wide ? "is-wide" : ""}`}
    >
      <div className="d2-scene-caption">
        <span className="d2-scene-n" aria-hidden>
          {n}
        </span>
        <h2 id={`d2-scene-${n}`} className="d2-scene-title">
          {title}
        </h2>
        <p className="d2-scene-line">{line}</p>
      </div>
      <div className="d2-scene-stage">{children}</div>
    </section>
  );
}

/**
 * Qloo's ranking for one tier as a column of poster strips: every place an anonymous grey strip,
 * the act's own strip at `at`, in its venue's colour once its venue's fans are in (`lit`), and,
 * when it climbed, a ghost where it was with the climb drawn beside the column.
 */
function RankingColumn({
  act,
  image,
  at,
  from,
  lit,
  hue,
  rows,
}: {
  act: Act;
  image?: string;
  at: number;
  from: number | null;
  lit: boolean;
  hue: number | null;
  rows: number;
}) {
  const ROW = 31;
  const y = (place: number) => (place - 1) * ROW + ROW / 2;
  return (
    <div className="d2-rank-wrap" style={{ height: rows * ROW }}>
      <ol
        className="d2-rank"
        aria-label={`Qloo's ranking, ${act.name} ${ordinal(at)}`}
      >
        {Array.from({ length: rows }, (_, index) => index + 1).map((place) =>
          place === at ? (
            <li
              key={place}
              className={`d2-rank-act ${lit && hue !== null ? `venue-${hue}` : "is-plain"}`}
            >
              <span className="d2-rank-place">{ordinal(place)}</span>
              <Cover
                image={image}
                genres={act.sharedTags.map((tag) => tag.name)}
                id={act.entityId}
                name={act.name}
                label={false}
                className="d2-rank-photo"
              />
              <span className="d2-rank-name">{act.name}</span>
              {lit && from !== null && (
                <span className="d2-rank-climb">↑{from - at}</span>
              )}
            </li>
          ) : (
            <li
              key={place}
              className={`d2-rank-slot ${from === place && lit ? "is-ghost" : ""}`}
            >
              <span className="d2-rank-place">{ordinal(place)}</span>
              {from === place && lit && (
                <span className="d2-rank-ghost-name">{act.name} was here</span>
              )}
            </li>
          ),
        )}
      </ol>
      {lit && from !== null && from > at && (
        <svg
          className="d2-rank-arrow"
          viewBox={`0 0 60 ${rows * ROW}`}
          style={{ height: rows * ROW }}
          aria-hidden
        >
          <path
            d={`M52 ${y(from)} C 6 ${y(from) - 24}, 6 ${y(at) + 24}, 48 ${y(at)}`}
          />
          <path d={`M37 ${y(at) - 9} L 48 ${y(at)} L 36 ${y(at) + 8}`} />
        </svg>
      )}
    </div>
  );
}

/** A small poster: the headliners, then each tier's strips, the followed act flying into its slot. */
function MiniPoster({
  festival,
  acts,
  places,
  hues,
  followed,
  headlinerImages,
  headlinerIds,
}: {
  festival: Festival;
  acts: readonly Act[];
  places: Readonly<Record<string, Placed>>;
  hues: Readonly<Record<string, number | null>>;
  followed: string;
  headlinerImages?: ArtistImages;
  headlinerIds?: ReadonlyMap<string, string>;
}) {
  return (
    <div className="poster-sheet d2-mini-poster">
      <p className="poster-name">{festival.name}</p>
      <HeadlinerList
        headliners={festival.headliners}
        images={headlinerImages}
        ids={headlinerIds}
      />
      <span className="poster-rule-line" aria-hidden />
      {festival.feeBands.map((band) => (
        <section key={band.id} className={`poster-band poster-band-${band.id}`}>
          <div className="poster-band-head">
            <h3 className="poster-band-name">{PLAIN_BAND[band.id]}</h3>
          </div>
          <ul className="poster-acts">
            {actsInBand(acts, band.id).map((act) => {
              const hue = hues[act.anchorVenue.entityId] ?? null;
              const place = places[act.entityId];
              return (
                <li key={act.entityId}>
                  <article
                    className={`poster-act ${hue !== null ? `venue-${hue}` : ""} ${act.entityId === followed ? "d2-flying" : ""}`}
                  >
                    <span className="poster-act-name">
                      {act.name}
                      <span className="poster-climb" aria-hidden>
                        {place && (
                          <span className="poster-rank">
                            {ordinal(place.now)}{" "}
                          </span>
                        )}
                        {climbMark(act)}
                      </span>
                    </span>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * How it works as the director's cut of Watch (WS12 item 2), on the saved Boise build: four
 * full-width scenes made of the landing's own objects, following the act that leads the build
 * (read from the build, never named in code): the ranking as a column of poster strips, the town
 * with that venue lit and its switch, the door check's ticket, and the strip onto the poster.
 */
export function DirectorsCut({
  festival,
  acts,
  places,
  images,
  headlinerImages,
  headliners,
  story,
}: {
  festival: Festival;
  acts: readonly Act[];
  places: Readonly<Record<string, Placed>>;
  images?: ArtistImages;
  headlinerImages?: ArtistImages;
  /** The headliners as the build found them on Qloo, for their photos. */
  headliners?: readonly { entityId: string; name: string }[];
  story: LabStory;
}) {
  const act = acts.find((entry) => entry.entityId === story.firstId);
  const [on, setOn] = useState(true);
  if (!act) return null;
  const band = festival.feeBands.find((entry) => entry.id === act.band)!;
  const place = places[act.entityId];
  const lift = liftOf(act);
  const was = place?.was ?? null;
  const now = place?.now ?? (lift?.kind === "new" ? lift.top : 1);
  const rows = Math.min(50, Math.max(now, was ?? now) + 1);
  const venue = act.anchorVenue;
  const venueName = signName(venue.name);
  const hue = story.hues[venue.entityId] ?? null;
  const slot = actsInBand(acts, band.id).findIndex(
    (entry) => entry.entityId === act.entityId,
  );
  const [first, second] = festival.headliners;
  const headlinerIds = new Map(
    headliners?.map((entry) => [entry.name, entry.entityId]),
  );
  const lifted = (id: string) =>
    acts.filter((entry) => entry.anchorVenue.entityId === id).length;
  const standing: SceneVenue[] = story.venues
    .map((entry, index) => ({ entry, index, count: lifted(entry.entityId) }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ entry, count }) => ({
      entityId: entry.entityId,
      name: entry.name,
      hue: count > 0 ? (story.hues[entry.entityId] ?? null) : null,
      lifted: count,
      off: entry.entityId === venue.entityId && !on,
      unread: false,
      noFanData: story.noFanData.includes(entry.entityId),
    }));

  return (
    <div className="d2-cut">
      <Scene
        n={1}
        title="The headliners' fans alone"
        line={
          <>
            For fans of {first} and {second}, Qloo ranks {act.name}{" "}
            <strong>{was ? ordinal(was) : "outside its top 50"}</strong> among{" "}
            {PLAIN_BAND[band.id].toLowerCase()}. {was ? was - 1 : 50} acts are
            ahead of {act.name}.
          </>
        }
      >
        <div className="d2-scene-two">
          <div className="poster-sheet d2-heads">
            <p className="d2-heads-label">The fans of</p>
            <HeadlinerList
              headliners={festival.headliners}
              images={headlinerImages}
              ids={headlinerIds}
            />
            <p className="d2-heads-label">and no venue&apos;s fans yet</p>
          </div>
          <RankingColumn
            act={act}
            image={images?.[act.entityId]}
            at={was ?? rows}
            from={null}
            lit={false}
            hue={hue}
            rows={rows}
          />
        </div>
      </Scene>

      <Scene
        n={2}
        title={<>+ {venueName}&apos;s fans</>}
        line={
          on ? (
            <>
              Add the fans of {venueName}, one of {festival.city}&apos;s music
              venues, and Qloo ranks {act.name} <strong>{ordinal(now)}</strong>
              {was ? <>: a climb of {was - now} places</> : null}. Switch the
              venue off and the climb goes with it.
            </>
          ) : (
            <>
              Without {venueName}&apos;s fans, {act.name} stays{" "}
              {was ? ordinal(was) : "outside the top 50"}: no climb, so no slot.
              Switch it back on.
            </>
          )
        }
        wide
      >
        <div className="d2-scene-two">
          <div className="d2-scene-town">
            <TownScene
              seedKey={festival.id}
              venues={standing}
              selected={on ? venue.entityId : null}
              focusOn={null}
              interactive={false}
            />
            <button
              type="button"
              aria-pressed={on}
              onClick={() => setOn((value) => !value)}
              className={`d2-switch ${hue !== null ? `venue-${hue}` : ""}`}
            >
              <span className="d2-switch-swatch" aria-hidden />
              {venueName}&apos;s fans
              <span className="d2-switch-state">{on ? "On" : "Off"}</span>
            </button>
          </div>
          <RankingColumn
            act={act}
            image={images?.[act.entityId]}
            at={on ? now : (was ?? rows)}
            from={on ? was : null}
            lit={on}
            hue={hue}
            rows={rows}
          />
        </div>
      </Scene>

      <Scene
        n={3}
        title="The door check"
        line={
          <>
            To get on, an act needs a climb of {MIN_LIFT} places or more, a Qloo
            popularity inside its tier ({formatPopularityRange(band)}) and two
            genres shared with the headliners. {act.name} passes all three.
          </>
        }
      >
        <div className="d2-scene-ticket">
          <Ticket
            act={act}
            band={band}
            place={place}
            hue={hue}
            image={images?.[act.entityId]}
            festival={festival}
          />
        </div>
      </Scene>

      <Scene
        n={4}
        title="Onto the poster"
        line={
          <>
            Of the acts that pass all three, the strongest Qloo match takes each
            slot first: {act.name} takes {PLAIN_BAND[band.id].toLowerCase()}{" "}
            slot {slot + 1} of {band.slots}.
          </>
        }
      >
        <MiniPoster
          festival={festival}
          acts={acts}
          places={places}
          hues={story.hues}
          followed={act.entityId}
          headlinerImages={headlinerImages}
          headlinerIds={headlinerIds}
        />
      </Scene>
    </div>
  );
}

const PASSES = [
  {
    id: "agent",
    role: "The AI agent",
    does: (calls: number) => `Plans the ${calls} Qloo calls`,
    access: "Chooses which venues to read, and in what order",
  },
  {
    id: "qloo",
    role: "Qloo",
    does: () => "Knows the taste",
    access: "Ranks the acts each crowd likes, with and without a venue's fans",
  },
  {
    id: "rule",
    role: "The rule",
    does: () => "Picks the acts",
    access: `A climb of ${MIN_LIFT} or more, inside the fee range, two genres shared`,
  },
] as const;

/** Who does what (WS12 item 2) as three backstage passes on lanyards. */
export function BackstagePasses({
  festival,
  calls,
}: {
  festival: Festival;
  calls: number;
}) {
  const reveal = useReveal<HTMLElement>();
  return (
    <section ref={reveal} aria-labelledby="d2-who" className="d2-who">
      <h2 id="d2-who" className="d2-h2">
        Who does what
      </h2>
      <ul className="d2-passes">
        {PASSES.map((pass, index) => (
          <li
            key={pass.id}
            className={`d2-pass d2-pass-${pass.id}`}
            style={{ "--i": index } as CSSProperties}
          >
            <svg className="d2-lanyard" viewBox="0 0 120 84" aria-hidden>
              <path className="d2-strap" d="M6 0 L54 70 M114 0 L66 70" />
              <rect className="d2-clip" x="50" y="64" width="20" height="18" />
            </svg>
            <div className="d2-pass-card">
              <span className="d2-pass-slot" aria-hidden />
              <p className="d2-pass-event">{festival.name} · crew</p>
              <p className="d2-pass-role">{pass.role}</p>
              <p className="d2-pass-does">{pass.does(calls)}</p>
              <p className="d2-pass-access">{pass.access}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TESTED = [
  {
    id: "shown",
    verdict: "Shown",
    number: "29 of 29",
    line: "towns where the AI agent drafted a full lineup from the town's own venues, and listed every Qloo call it made.",
  },
  {
    id: "partly",
    verdict: "Partly shown",
    number: "20 of 30",
    line: "real festivals where the acts booked showed more lift from the town's venues than random acts of their tier. Another country's venues did it at 18.",
  },
  {
    id: "not",
    verdict: "Not shown",
    number: "–",
    line: "that the town's crowd knows these acts, or that they would sell tickets, take the slot or fit a budget.",
  },
] as const;

/** What was tested (WS12 item 2, WS14.3's words to come) as three rubber stamps. */
export function TestedStamps() {
  const reveal = useReveal<HTMLElement>();
  return (
    <section ref={reveal} aria-labelledby="d2-tested" className="d2-tested">
      <h2 id="d2-tested" className="d2-h2">
        What was tested
      </h2>
      <ul className="d2-verdicts">
        {TESTED.map((entry, index) => (
          <li
            key={entry.id}
            className={`d2-verdict d2-verdict-${entry.id}`}
            style={{ "--i": index } as CSSProperties}
          >
            <span className="d2-verdict-stamp">{entry.verdict}</span>
            <span className="d2-verdict-number">{entry.number}</span>
            <span className="d2-verdict-line">{entry.line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
