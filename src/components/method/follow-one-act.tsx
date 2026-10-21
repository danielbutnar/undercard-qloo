"use client";

import { useMemo, useState } from "react";
import {
  BandChart,
  ChartRow,
  type ChartRowData,
} from "@/components/chart/band-chart";
import { billRows } from "@/components/chart/chart-rows";
import { liftedWords, ordinal, PLAIN_BAND } from "@/components/chart/words";
import { useReducedMotion } from "@/components/use-watch";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import { formatBandRange, formatPercentile } from "@/lib/format";
import type { MethodStory } from "@/lib/method-story";
import { venueHues } from "@/lib/venue-colours";

/** The places the climb chart shows: down past the act's old place. */
const rungsFor = (was: number | null) => Math.max(20, (was ?? 20) + 1);
const LABELLED = new Set([1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);

/**
 * The act's row on the band's ranking, one rung a place: it sits at its place for the
 * headliners' fans alone, then climbs to its place with its venue's fans added. The row's
 * wrapper stays mounted between the two, so it glides (no glide under reduced motion).
 */
function ClimbChart({
  row,
  numbers,
  at,
  rungs,
}: {
  row: ChartRowData;
  numbers: "place" | "climb";
  at: number | null;
  rungs: number;
}) {
  return (
    <div
      className="how-climbchart"
      style={{
        ["--rungs" as string]: rungs,
        ["--at" as string]: (at ?? rungs) - 1,
      }}
    >
      <div className="how-rungs" aria-hidden>
        {Array.from({ length: rungs }, (_, i) => (
          <i key={i}>{LABELLED.has(i + 1) ? ordinal(i + 1) : ""}</i>
        ))}
      </div>
      <div className={`band numbers-${numbers} how-row`}>
        <ChartRow key={numbers} row={row} numbers={numbers} />
      </div>
    </div>
  );
}

/** Which venues' fans the AI agent read, and how many acts each put on the lineup. */
function AgentChoices({
  story,
  city,
  hues,
}: {
  story: MethodStory;
  city: string;
  hues: ReadonlyMap<string, number>;
}) {
  const none = story.venues.filter((venue) => venue.lifted === 0);
  return (
    <section aria-label="The AI agent's choices" className="panel how-choices">
      <h3 className="panel-title">The AI agent&apos;s choices</h3>
      <p className="panel-sub">
        {story.placesListed !== null &&
          `Qloo listed ${story.placesListed} live-music places in ${city}. `}
        The AI agent chose whose fans to read, in {story.calls} Qloo calls.
        Here is how many acts each venue&apos;s fans lifted onto the whole lineup,
        mid-size and opening:
      </p>
      <ul className="how-venues">
        {story.venues.map((venue) => (
          <li
            key={venue.entityId}
            className={`how-venue venue-${hues.get(venue.entityId) ?? 0}`}
          >
            <i className="how-swatch" aria-hidden />
            <span className="how-venue-name">{venue.name}</span>
            <span className="how-venue-lifted">
              {liftedWords(venue.lifted)}
            </span>
          </li>
        ))}
      </ul>
      {none.length > 0 && (
        <p className="panel-sub">
          {none.map((venue) => venue.name).join(" and ")}: the agent read{" "}
          {none.length === 1 ? "its" : "their"} fans too, and they moved no act
          onto the lineup.
        </p>
      )}
    </section>
  );
}

/**
 * One act through the saved build, a step at a time (M10b): its place for the headliners' fans
 * alone, its climb once its venue's fans are added, the rule's three checks, the lineup. The rows
 * and badges are the first screen's; every number is the build's.
 */
export function FollowOneAct({
  story,
  city,
  headliners,
}: {
  story: MethodStory;
  city: string;
  headliners: readonly string[];
}) {
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();
  const { act, band, place, climb, fresh } = story;
  const hues = useMemo(
    () => venueHues(story.venues, story.acts),
    [story.venues, story.acts],
  );
  const [row] = billRows(
    band,
    [act],
    story.places,
    hues,
    0,
    undefined,
    "climb",
  );
  const was = place?.was ?? null;
  const now = place?.now ?? row.place;
  const plain = PLAIN_BAND[band.id].toLowerCase();
  const venue = act.anchorVenue.name;
  // Before the venue's fans are added: its place for the headliners' fans alone, no venue yet.
  const alone: ChartRowData = {
    ...row,
    place: was,
    was: null,
    move: null,
    fresh: false,
    hue: null,
    venueShort: null,
    words: `${act.name}: ${was !== null ? ordinal(was) : "outside the top 50"} for the headliners' fans alone`,
  };
  const checks = [
    `Climbs ${MIN_LIFT} places or more: ${fresh ? "new to the top 50" : climb}`,
    `Inside the fee range (${formatBandRange(band)}): ${formatPercentile(act.popularity)}`,
    `Shares two genres with the headliners: ${act.sharedTags.map((tag) => tag.name).join(", ")}`,
  ];
  const steps = [
    {
      title: "The headliners' fans",
      text: `For the fans of ${headliners.join(" and ")} alone, Qloo ranks the ${plain} they like. ${act.name} ${was !== null ? `is ${ordinal(was)}` : "isn't in the top 50"}.`,
    },
    {
      title: `+ ${venue}'s fans`,
      text: `The AI agent chose to read the fans of ${venue}, one of ${city}'s music venues. With them added, Qloo ranks the ${plain} again: ${act.name} ${fresh ? `comes into the top 50, at ${now !== null ? ordinal(now) : "a place"}` : `climbs ${climb} places, to ${now !== null ? ordinal(now) : "a higher place"}`}.`,
    },
    {
      title: "The rule",
      text: `The app's own rule checks ${act.name} on Qloo's numbers:`,
    },
    {
      title: "The lineup",
      text: `${act.name} clears all three and goes on the lineup: each fee range's slots go to the acts that clear the rule, strongest Qloo affinity first.`,
    },
  ];
  const last = steps.length - 1;
  const open = Math.max(
    0,
    band.slots - story.acts.filter((entry) => entry.band === band.id).length,
  );

  return (
    <section aria-label="Follow one act" className="how-section how-follow">
      <h2 className="band-name">Follow one act</h2>
      <p className="how-sub">
        {act.name}, through the saved {city} build, a step at a time.
      </p>
      <ol className="how-steps">
        {steps.map((entry, index) => (
          <li key={entry.title}>
            <button
              type="button"
              className="how-step-tab"
              aria-current={index === step ? "step" : undefined}
              onClick={() => setStep(index)}
            >
              <span className="how-step-n">{index + 1}</span>
              {entry.title}
            </button>
          </li>
        ))}
      </ol>
      <div className="how-follow-body">
        <div className="how-follow-main">
          <div className="how-stage">
            <div className="how-stage-main">
              <p className="how-step-text" aria-live="polite">
                {steps[step].text}
              </p>
              {step < 2 && (
                <ClimbChart
                  row={step === 0 ? alone : row}
                  numbers={step === 0 ? "place" : "climb"}
                  at={step === 0 ? was : now}
                  rungs={rungsFor(was)}
                />
              )}
              {step === 2 && (
                <div className="band numbers-climb how-row">
                  <ChartRow row={row} numbers="climb" />
                </div>
              )}
              {step === 2 && (
                <ul aria-label="The rule's checks" className="how-checks">
                  {checks.map((check, index) => (
                    <li
                      key={check}
                      className="how-check motion-safe:animate-print-in"
                      style={{
                        animationDelay: `${(index * 0.25).toFixed(2)}s`,
                      }}
                    >
                      {check}
                    </li>
                  ))}
                </ul>
              )}
              {step === last && (
                <BandChart
                  band={band}
                  rows={billRows(
                    band,
                    story.acts,
                    story.places,
                    hues,
                    open,
                    undefined,
                    "climb",
                  )}
                  sortKey="lineup"
                  motion={!reduced}
                  numbers="climb"
                  openId={act.entityId}
                  printing={reduced ? null : "replay"}
                />
              )}
            </div>
          </div>
          <div className="how-nav">
            <button
              type="button"
              className="tool"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              Back
            </button>
            <button
              type="button"
              className="tool how-next"
              onClick={() => setStep((current) => Math.min(last, current + 1))}
              disabled={step === last}
            >
              Next step
            </button>
          </div>
        </div>
        <AgentChoices story={story} city={city} hues={hues} />
      </div>
    </section>
  );
}
