"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FestivalScreen } from "@/components/festival-screen";
import {
  CHECKED_TOWNS,
  checkedTownLabel,
  type CheckedTown,
} from "@/lib/checked-towns";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { Quilt } from "@/components/chart/sleeve";
import { TopBar } from "@/components/chart/top-bar";
import "./chart/chart.css";
import { checkedFestival } from "@/lib/towns";
import {
  FREE_TEXT_TOWNS,
  YourBriefSchema,
  yourFestival,
  type YourBrief,
} from "@/lib/your-festival";

/** What's wrong with a brief, in plain words, the town first. */
function problemWith(values: {
  city: string;
  region: string;
  first: string;
  second: string;
}) {
  const parsed = YourBriefSchema.safeParse({
    city: values.city,
    region: values.region,
    headliners: [values.first, values.second],
  });
  if (parsed.success) return null;
  const paths = parsed.error.issues.map((issue) => issue.path[0]);
  if (paths.includes("city"))
    return "Give a town's name, such as Duluth or Reykjavík: letters, spaces, dots, hyphens and apostrophes.";
  if (paths.includes("region"))
    return "Give the town's state or country, such as Vermont or England, so Qloo finds the right town.";
  if (!values.first.trim() || !values.second.trim())
    return "Give both headliners.";
  return "Two different headliners, please.";
}

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** The headliners are still the demo's, in either order. */
function demoHeadliners({ first, second }: { first: string; second: string }) {
  const [a, b] = SAGEBRUSH_SOUND.headliners;
  return (
    (same(first, a) && same(second, b)) || (same(first, b) && same(second, a))
  );
}

/**
 * "Your festival" (M6f): a judge's own town and two headliners. The agent runs live for them
 * with Sagebrush Sound's crowd and fee bands, under the same per-IP limit, and nothing is saved.
 */
export function YourFestival({
  linked = null,
  freeText = FREE_TEXT_TOWNS,
}: {
  /**
   * A pre-filled link's values (M6h), read on the server. They only fill the form: mail clients
   * and link previews open links by themselves, so only the visitor's press starts the agent.
   */
  linked?: {
    city: string;
    region: string;
    first: string;
    second: string;
  } | null;
  /** A free-text town below the checked towns; on only while M6j's re-measure keeps it. */
  freeText?: boolean;
} = {}) {
  const [values, setValues] = useState(
    linked ?? {
      city: "",
      region: "",
      // The demo's headliners, so a checked town runs in one click; both can be changed.
      first: SAGEBRUSH_SOUND.headliners[0],
      second: SAGEBRUSH_SOUND.headliners[1],
    },
  );
  const fromLink = linked !== null;
  const [problem, setProblem] = useState<string | null>(null);
  const [brief, setBrief] = useState<YourBrief | null>(null);
  const [run, setRun] = useState(0);
  const [town, setTown] = useState<CheckedTown | null>(null);

  if (town)
    return (
      <FestivalScreen
        festival={checkedFestival(town)}
        checked={{ onBack: () => setTown(null) }}
      />
    );

  if (brief)
    return (
      <FestivalScreen
        key={run}
        festival={yourFestival(brief, `yours-draft-${run}`)}
        custom={{
          brief,
          onEdit: () => setBrief(null),
          onPick: (town) => {
            setBrief(null);
            runTown(town);
          },
        }}
      />
    );

  function start(next: typeof values) {
    const found = problemWith(next);
    setProblem(found);
    if (found) return;
    setRun((n) => n + 1);
    setBrief(
      YourBriefSchema.parse({
        city: next.city,
        region: next.region,
        headliners: [next.first, next.second],
      }),
    );
  }

  // A checked town (M6k): with the demo's headliners, one click replays its saved build (M6m);
  // with headliners of the judge's own, it runs the agent live, as before.
  function runTown(town: CheckedTown) {
    const next = { ...values, city: town.city, region: town.region };
    setValues(next);
    if (demoHeadliners(next)) {
      setProblem(null);
      setTown(town);
    } else start(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    start(values);
  }

  const field = (
    id: "city" | "region" | "first" | "second",
    label: string,
    placeholder: string,
  ) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-row">
        {(id === "first" || id === "second") && (
          <Quilt name={values[id] || label} className="field-quilt" />
        )}
        <input
          name={id}
          value={values[id]}
          placeholder={placeholder}
          autoComplete="off"
          maxLength={id === "city" || id === "region" ? 60 : 80}
          onChange={(event) =>
            setValues((current) => ({ ...current, [id]: event.target.value }))
          }
          className="field-input"
        />
      </span>
    </label>
  );

  return (
    <div className="chart-app stage-bg">
      <TopBar yours={false} />
      <main className="yours">
        <form
          onSubmit={submit}
          noValidate
          aria-labelledby="your-festival-title"
          className="yours-form"
        >
          <div className="yours-lead">
            <h1 id="your-festival-title" className="compare-title">
              Your festival
            </h1>
            <p className="compare-what">
              Two booked headliners, then a town. The AI agent reads that
              town&apos;s own music venues through Qloo, a taste-data service
              that maps what fans of one artist, venue or film also like, and
              drafts the undercard, with Sagebrush Sound&apos;s crowd (aged
              25–34) and fee ranges.
            </p>
            {fromLink && (
              <p className="whatif mt-3">
                {freeText
                  ? "Filled in from your link. Check it, then press Draft my undercard to run it."
                  : "Filled in from your link. Pick your town below to run it."}
              </p>
            )}
          </div>
          <div className="panel yours-heads">
            {field("first", "First headliner", "Such as Khruangbin")}
            {field("second", "Second headliner", "Such as Japanese Breakfast")}
          </div>
          <section aria-labelledby="checked-towns-title" className="panel">
            <h2 id="checked-towns-title" className="panel-title">
              Towns Undercard has already read
            </h2>
            <p className="panel-sub">
              Each has a saved build that fills both bands with these
              headliners. One click replays it, with the live run next to it;
              change a headliner and the click runs the agent live instead.
            </p>
            <ul
              aria-label="Towns Undercard has already read"
              className="town-grid yours-towns mt-3"
            >
              {CHECKED_TOWNS.map((town) => (
                <li key={`${town.city}|${town.region}`}>
                  <button
                    type="button"
                    onClick={() => runTown(town)}
                    aria-label={checkedTownLabel(town)}
                    className="town-button"
                  >
                    <span className="town-city">{town.city}</span>
                    <span className="town-where">
                      {town.region === town.country
                        ? town.country
                        : `${town.region}, ${town.country}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {problem && (
            <p role="alert" className="panel alert">
              {problem}
            </p>
          )}
          {freeText && (
            <section aria-labelledby="free-town-title" className="panel yours-free">
              <h2 id="free-town-title" className="panel-title">
                Or name another town
              </h2>
              <div className="yours-free-fields">
                {field("city", "Town", "Such as Duluth")}
                {field("region", "State or country", "Such as Minnesota")}
              </div>
              <button type="submit" className="watch yours-go">
                <span className="watch-play" aria-hidden>
                  <svg viewBox="0 0 20 20">
                    <path d="M4 2v16l14-8z" />
                  </svg>
                </span>
                Draft my undercard
              </button>
            </section>
          )}
          <p className="yours-note">
            Your own headliners or town run live: about 15 seconds and up to 12
            Qloo calls, limited to 5 runs a day from your address. Nothing is
            saved, and Sagebrush Sound&apos;s lineup stays as it is.
          </p>
          <Link href="/" className="link yours-back">
            Back to Sagebrush Sound
          </Link>
        </form>
      </main>
    </div>
  );
}
