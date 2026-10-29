"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ChecksList } from "@/components/chart/checks";
import { HeadlinerList } from "@/components/chart/poster";
import { climbMark } from "@/components/chart/poster-words";
import { Ticket } from "@/components/chart/ticket";
import { TownScene, type SceneVenue } from "@/components/chart/town-scene";
import { useReveal } from "@/components/chart/use-reveal";
import { CONTROL_LINE, ordinal, PLAIN_BAND } from "@/components/chart/words";
import { Cover } from "@/components/chart/cover";
import { plusRetries } from "@/lib/agent-words";
import type { Festival } from "@/lib/festival";
import { formatPopularityRange } from "@/lib/format";
import { actsInBand, type Act } from "@/lib/lineup";
import { evidenceHref } from "@/lib/method";
import type { MethodStory } from "@/lib/method-story";
import { venueHues } from "@/lib/venue-colours";

/** One scene: its number, its title and line, and the landing's objects playing it. */
function Scene({
  n,
  title,
  line,
  children,
}: {
  n: number;
  title: string;
  line: ReactNode;
  children: ReactNode;
}) {
  const reveal = useReveal<HTMLElement>(0.3);
  return (
    <section
      ref={reveal}
      id={`scene-${n}`}
      aria-label={`Scene ${n}: ${title}`}
      className="dc-scene"
    >
      <div className="dc-caption">
        <span className="dc-n" aria-hidden>
          {n}
        </span>
        <h2 className="dc-title">{title}</h2>
        <div className="dc-line">{line}</div>
      </div>
      <div className="dc-stage">{children}</div>
    </section>
  );
}

/**
 * The places a short ranking column shows: the top three, the act's place and its neighbours,
 * and where it came from; null marks a fold over the places between (WS12 fix 2: the act shows
 * in the first view however far down it starts).
 */
export function rankRows(at: number, from: number | null): (number | null)[] {
  const keep = new Set<number>([1, 2, 3]);
  for (const place of [at, from])
    if (place !== null)
      for (const near of [place - 1, place, place + 1])
        if (near >= 1 && near <= 50) keep.add(near);
  const sorted = [...keep].sort((a, b) => a - b);
  return sorted.flatMap((place, index) =>
    index > 0 && place - sorted[index - 1] > 1 ? [null, place] : [place],
  );
}

/** Qloo's ranking for one tier as a short column of poster strips. */
function RankingColumn({
  act,
  image,
  at,
  from,
  lit,
  hue,
}: {
  act: Act;
  image?: string;
  at: number;
  from: number | null;
  lit: boolean;
  hue: number | null;
}) {
  const rows = rankRows(at, lit ? from : null);
  const ROW = 34;
  const y = (place: number) => rows.indexOf(place) * ROW + ROW / 2;
  return (
    <div className="dc-rank-wrap" style={{ height: rows.length * ROW }}>
      <ol
        aria-label={`Qloo's ranking: ${act.name} ${ordinal(at)}`}
        className="dc-rank"
      >
        {rows.map((place, index) =>
          place === null ? (
            <li key={`fold-${index}`} className="dc-rank-fold">
              …
            </li>
          ) : place === at ? (
            <li
              key={place}
              className={`dc-rank-act ${lit && hue !== null ? `venue-${hue}` : "is-plain"}`}
            >
              <span className="dc-rank-place">{ordinal(place)}</span>
              <Cover
                image={image}
                genres={act.sharedTags.map((tag) => tag.name)}
                id={act.entityId}
                name={act.name}
                label={false}
                className="dc-rank-photo"
              />
              <span className="dc-rank-name">{act.name}</span>
              {lit && from !== null && (
                <span className="dc-rank-climb">↑{from - at}</span>
              )}
            </li>
          ) : (
            <li
              key={place}
              className={`dc-rank-slot ${lit && from === place ? "is-ghost" : ""}`}
            >
              <span className="dc-rank-place">{ordinal(place)}</span>
              {lit && from === place && (
                <span className="dc-rank-ghost">{act.name} was here</span>
              )}
            </li>
          ),
        )}
      </ol>
      {lit && from !== null && from > at && (
        <svg
          className="dc-rank-arrow"
          viewBox={`0 0 60 ${rows.length * ROW}`}
          style={{ height: rows.length * ROW }}
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

/**
 * How it works as the director's cut of Watch (WS12 item 2), on the saved build: four
 * full-width scenes made of the landing's own objects, following the act that leads the build
 * (from the story, never named in code): Qloo's ranking as a column of poster strips, the town
 * with that venue lit and its switch, the door check's ticket, and the strip onto the poster.
 * `choices` is the AI agent's account of the venues it read (scene 2).
 */
export function DirectorsCut({
  festival,
  story,
  choices,
}: {
  festival: Festival;
  story: MethodStory;
  choices?: ReactNode;
}) {
  const [on, setOn] = useState(true);
  // A step's old link (/method?step=N, review fix) still lands on its scene.
  useEffect(() => {
    const step = Number(
      new URLSearchParams(window.location.search).get("step"),
    );
    if (Number.isInteger(step) && step >= 1 && step <= 4)
      document
        .getElementById(`scene-${step}`)
        ?.scrollIntoView?.({ block: "start" });
  }, []);
  const { act, band, place } = story;
  const was = place?.was ?? null;
  const now = place?.now ?? 1;
  const venue = act.anchorVenue;
  const ranked = venueHues(story.venues, story.acts);
  const hueOf = (id: string) =>
    story.acts.some((entry) => entry.anchorVenue.entityId === id)
      ? (ranked.get(id) ?? null)
      : null;
  const hue = hueOf(venue.entityId);
  const image = story.images?.[act.entityId];
  const slot = actsInBand(story.acts, band.id).findIndex(
    (entry) => entry.entityId === act.entityId,
  );
  const [first, second] = festival.headliners;
  const standing: SceneVenue[] = story.venues
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.lifted - a.entry.lifted || a.index - b.index)
    .map(({ entry }) => ({
      entityId: entry.entityId,
      name: entry.name,
      hue: entry.lifted > 0 ? hueOf(entry.entityId) : null,
      lifted: entry.lifted,
      off: entry.entityId === venue.entityId && !on,
      unread: false,
      noFanData: story.noFanData?.includes(entry.entityId) ?? false,
    }));
  const tier = PLAIN_BAND[band.id].toLowerCase();

  return (
    <div className="dc-cut">
      <Scene
        n={1}
        title="The headliners' fans alone"
        line={
          <p>
            For fans of {first} and {second}, Qloo ranks {act.name}{" "}
            <strong>{was ? ordinal(was) : "outside its top 50"}</strong> among{" "}
            {tier}.
          </p>
        }
      >
        <div className="dc-two">
          <div className="poster-sheet dc-heads">
            <p className="dc-heads-label">The fans of</p>
            <HeadlinerList headliners={festival.headliners} />
            <p className="dc-heads-label">and no venue&apos;s fans yet</p>
          </div>
          <RankingColumn
            act={act}
            image={image}
            at={was ?? 50}
            from={null}
            lit={false}
            hue={hue}
          />
        </div>
      </Scene>

      <Scene
        n={2}
        title={`+ ${venue.name}'s fans`}
        line={
          <>
            <p>
              {on ? (
                <>
                  Add the fans of {venue.name}, one of {festival.city}&apos;s
                  music venues, and Qloo ranks {act.name}{" "}
                  <strong>{ordinal(now)}</strong>
                  {was ? `: a climb of ${was - now} places` : ""}.
                </>
              ) : (
                <>
                  Without {venue.name}&apos;s fans, {act.name} stays{" "}
                  {was ? ordinal(was) : "outside the top 50"}: no climb, so no
                  slot.
                </>
              )}
            </p>
            {choices}
          </>
        }
      >
        <div className="dc-two">
          <div className="dc-town">
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
              className={`dc-switch ${hue !== null ? `venue-${hue}` : ""}`}
            >
              <span className="dc-switch-swatch" aria-hidden />
              {venue.name}&apos;s fans
              <span className="dc-switch-state">{on ? "On" : "Off"}</span>
            </button>
          </div>
          <RankingColumn
            act={act}
            image={image}
            at={on ? now : (was ?? 50)}
            from={on ? was : null}
            lit={on}
            hue={hue}
          />
        </div>
      </Scene>

      <Scene
        n={3}
        title="The door check"
        line={
          // Daniel, 2026-10-29 (WS18 item 1): the three checks in the card's words, then the
          // control's one line where the venue abroad first appears.
          <>
            <p>To get on, an act passes three checks:</p>
            <ChecksList local={Boolean(act.localLift)} className="dc-checks" />
            {act.localLift && <p>{CONTROL_LINE}</p>}
            <p>
              {act.name} passes all three. Its tier&apos;s range is{" "}
              {formatPopularityRange(band)} out of 100.
            </p>
          </>
        }
      >
        <div className="dc-ticket">
          <Ticket
            act={act}
            band={band}
            place={place ?? undefined}
            hue={hue}
            image={image}
            festival={festival}
          />
        </div>
      </Scene>

      <Scene
        n={4}
        title="Onto the poster"
        line={
          <p>
            Of the acts that pass all three, the strongest Qloo match takes each
            slot first: {act.name} takes {tier} slot {slot + 1} of {band.slots}.
          </p>
        }
      >
        <div className="poster-sheet dc-poster">
          <p className="poster-name">{festival.name}</p>
          <HeadlinerList headliners={festival.headliners} />
          <span className="poster-rule-line" aria-hidden />
          {festival.feeBands.map((entry) => (
            <section
              key={entry.id}
              className={`poster-band poster-band-${entry.id}`}
            >
              <div className="poster-band-head">
                <h3 className="poster-band-name">{PLAIN_BAND[entry.id]}</h3>
              </div>
              <ul className="poster-acts">
                {actsInBand(story.acts, entry.id).map((each) => {
                  const shade = hueOf(each.anchorVenue.entityId);
                  const placed = story.places[each.entityId];
                  return (
                    <li key={each.entityId}>
                      <article
                        aria-label={each.name}
                        className={`poster-act ${shade !== null ? `venue-${shade}` : ""} ${each.entityId === act.entityId ? "dc-flying" : ""}`}
                      >
                        <span className="poster-act-name">
                          {each.name}
                          <span className="poster-climb" aria-hidden>
                            {placed && (
                              <span className="poster-rank">
                                {ordinal(placed.now)}{" "}
                              </span>
                            )}
                            {climbMark(each)}
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
      </Scene>
    </div>
  );
}

const PASSES = [
  {
    id: "agent",
    role: "The AI agent",
    does: (calls: number, retries = 0) =>
      `plans the ${calls} Qloo calls${plusRetries(retries)}`,
    access: "Chooses which venues to read, and in what order",
  },
  {
    id: "qloo",
    role: "Qloo",
    does: () => "knows the taste",
    access: "Ranks the acts each crowd likes, with and without a venue's fans",
  },
  {
    id: "rule",
    role: "The rule",
    does: () => "picks the acts",
    // Daniel, 2026-10-29 (WS18 item 1): the three checks, never a list of four conditions.
    access: "The three checks, then the strongest Qloo match for each slot",
  },
] as const;

/** Who does what (WS12 item 2) as three backstage passes on lanyards, from one rail. */
export function BackstagePasses({
  festival,
  calls,
  retries = 0,
  children,
}: {
  festival: Festival;
  calls: number;
  /** The build's retries, said beside its calls (Daniel, 2026-10-28, 19:20). */
  retries?: number;
  children?: ReactNode;
}) {
  const reveal = useReveal<HTMLElement>();
  return (
    <section ref={reveal} aria-labelledby="dc-who" className="dc-who">
      <h2 id="dc-who" className="dc-heading">
        Who does what
      </h2>
      {children}
      <ul className="dc-passes">
        {PASSES.map((pass, index) => (
          <li
            key={pass.id}
            aria-label={`${pass.role}: ${pass.does(calls, retries)}`}
            className={`dc-pass dc-pass-${pass.id}`}
            style={{ "--i": index } as CSSProperties}
          >
            <svg className="dc-lanyard" viewBox="0 0 120 84" aria-hidden>
              <path className="dc-strap" d="M6 0 L54 70 M114 0 L66 70" />
              <rect className="dc-clip" x="50" y="64" width="20" height="18" />
            </svg>
            <div className="dc-pass-card">
              <span className="dc-pass-slot" aria-hidden />
              <p className="dc-pass-event">{festival.name} · crew</p>
              <p className="dc-pass-role">{pass.role}</p>
              <p className="dc-pass-does">
                {pass
                  .does(calls, retries)
                  .replace(/^./, (c) => c.toUpperCase())}
              </p>
              <p className="dc-pass-access">{pass.access}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What was tested (WS12 item 2) as rubber stamps. Section 37 is SHOWN in Daniel's words; the
 * other stamps' words wait for WS14.3 (placeholders from today's page); a NOT SHOWN stamp says
 * what isn't shown in words, never a dash.
 */
const TESTED: readonly {
  id: "shown" | "partly" | "not";
  verdict: string;
  big: string;
  line: string;
  /** The test's section of docs/evidence.md, by its heading. */
  section: string;
  /** "How we tested", where Daniel gave its words. */
  how?: string;
}[] = [
  {
    id: "shown",
    verdict: "Shown",
    big: "244 of 290",
    // Daniel, 2026-10-29 (WS18 item 1): Undercard drafts, it doesn't book; the clause on the
    // bills on show stands on the 29 2.0 builds, 290 of 290 (WS18b's check, no call).
    line: "244 of the 290 acts Undercard 1.0 drafted (its bills of 17 and 18 October) climbed at least 5 places more with the town venue that put them on the bill than with a music venue abroad of similar Qloo popularity; the bills on show now hold only acts that pass that test.",
    section:
      "37. The control test across the 29 towns, written before any call",
  },
  {
    id: "partly",
    verdict: "Partly shown",
    big: "20 of 30",
    line: "real festivals where the acts booked showed more lift from the town's venues than random acts of their tier; another country's venues did it at 18.",
    section: "34. Two controls for the premise test, written before any call",
  },
  {
    // Section 38 (Daniel, 29 October): said plainly, at the same weight as the other two.
    id: "not",
    verdict: "Not shown",
    big: "3 vs 11",
    line: "At 33 real festivals, Undercard's shortlists held 3 of the acts the festivals actually booked; the AI model alone held 11. Neither test bar was met.",
    section:
      "38. An outside yardstick at real festivals, written before any call",
    // Daniel's words of 29 October (11:05), "fee bands" said as the glossary's "fee ranges"
    // (WS18 item 1: one tier word everywhere).
    how: "All three shortlists had the same headliners and the same brief, and a hit is any act on the festival's lineup except its headliners. 6 of the model's 11 hits are acts outside the fee ranges Undercard is given; inside them, the model held 5, Undercard 3 and Undercard with another country's venues 2. The model may also recall real lineups from its training. Asked for an undercard in 29 towns (section 31), the same model put 204 of the 268 picks Qloo found above the top of those fee ranges. Against Undercard with another country's venues, Undercard won 3 festivals to 2, which doesn't meet that bar either.",
  },
];

/**
 * What was tested (WS12 item 2) as rubber stamps, in Daniel's words of 29 October: section 37
 * SHOWN, the premise test's second round PARTLY SHOWN, and section 38 NOT SHOWN, each with its
 * number, its sentence and a link to its section of docs/evidence.md. `method` is the method
 * fold under them (the 29 towns' line); `children` follow it.
 */
export function TestedStamps({
  method,
  children,
}: {
  method?: ReactNode;
  children?: ReactNode;
}) {
  const reveal = useReveal<HTMLElement>();
  return (
    <section ref={reveal} aria-labelledby="dc-tested" className="dc-tested">
      <h2 id="dc-tested" className="dc-heading">
        What was tested
      </h2>
      <ul className="dc-verdicts">
        {TESTED.map((entry, index) => (
          <li
            key={entry.id}
            className={`dc-verdict dc-verdict-${entry.id}`}
            style={{ "--i": index } as CSSProperties}
          >
            <span className="dc-verdict-stamp">{entry.verdict}</span>
            <span className="verdict-number dc-verdict-number">
              {entry.big}
            </span>
            <span className="dc-verdict-line">{entry.line}</span>
            {entry.how && (
              <details className="dc-verdict-how">
                <summary>How we tested</summary>
                <p>{entry.how}</p>
              </details>
            )}
            <a
              href={evidenceHref(entry.section)}
              className="link dc-verdict-source"
            >
              Evidence, section {entry.section.split(".")[0]}
            </a>
          </li>
        ))}
      </ul>
      {method && (
        <details className="dc-method">
          <summary>The method</summary>
          {method}
        </details>
      )}
      {children}
    </section>
  );
}
