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
import { checkedFestival } from "@/lib/towns";
import {
  FREE_TEXT_TOWNS,
  YourBriefSchema,
  yourFestival,
  type YourBrief,
} from "@/lib/your-festival";

const FIELD =
  "rounded-sm border-2 border-rule bg-page px-3 py-2 text-body text-ink focus:outline-2 focus:outline-offset-2 focus:outline-accent";

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
  return (same(first, a) && same(second, b)) || (same(first, b) && same(second, a));
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
    <label className="flex flex-col gap-1 text-label font-semibold">
      {label}
      <input
        name={id}
        value={values[id]}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={id === "city" || id === "region" ? 60 : 80}
        onChange={(event) =>
          setValues((current) => ({ ...current, [id]: event.target.value }))
        }
        className={FIELD}
      />
    </label>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-baseline gap-x-3.5 border-b-2 border-rule px-4 py-2 lg:px-6">
        <p className="font-display text-name font-extrabold uppercase">
          Undercard
        </p>
        <p className="text-label text-muted">Booking desk · Your festival</p>
      </header>
      <main className="flex flex-1 justify-center px-4 py-8 lg:px-6">
        <form
          onSubmit={submit}
          noValidate
          aria-labelledby="your-festival-title"
          className="flex w-full max-w-4xl flex-col gap-4 self-start border-2 border-rule bg-surface p-6"
        >
          <h1
            id="your-festival-title"
            className="font-display text-band font-extrabold uppercase"
          >
            Your festival
          </h1>
          <p className="text-body">
            Two booked headliners, then a town. The agent reads that town&apos;s
            own music rooms through Qloo and drafts the undercard, with
            Sagebrush Sound&apos;s crowd (aged 25–34) and fee bands.
          </p>
          {fromLink && (
            <p className="text-label font-semibold">
              {freeText
                ? "Filled in from your link. Check it, then press Draft my undercard to run it."
                : "Filled in from your link. Pick your town below to run it."}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("first", "First headliner", "Such as Khruangbin")}
            {field("second", "Second headliner", "Such as Japanese Breakfast")}
          </div>
          <h2
            id="checked-towns-title"
            className="mt-2 font-display text-name font-extrabold uppercase"
          >
            Towns Undercard has already read
          </h2>
          <p className="text-label text-muted">
            Each has a saved build that fills both bands with these headliners.
            One click replays it, with the live run next to it; change a
            headliner and the click runs the agent live instead.
          </p>
          <ul
            aria-label="Towns Undercard has already read"
            className="grid grid-cols-2 gap-2 lg:grid-cols-3"
          >
            {CHECKED_TOWNS.map((town) => (
              <li key={`${town.city}|${town.region}`}>
                <button
                  type="button"
                  onClick={() => runTown(town)}
                  aria-label={checkedTownLabel(town)}
                  className="group flex h-full w-full flex-col rounded-sm border-2 border-rule bg-page px-3 py-2 text-left hover:bg-ink hover:text-surface"
                >
                  <span className="text-body font-semibold">{town.city}</span>
                  <span className="text-label text-muted group-hover:text-surface">
                    {town.region === town.country
                      ? town.country
                      : `${town.region}, ${town.country}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {problem && (
            <p role="alert" className="text-label font-semibold text-danger">
              {problem}
            </p>
          )}
          {freeText && (
            <>
              <h2 className="mt-2 font-display text-name font-extrabold uppercase">
                Or name another town
              </h2>
              {field("city", "Town", "Such as Duluth")}
              {field("region", "State or country", "Such as Minnesota")}
              <button
                type="submit"
                className="self-start rounded-sm bg-accent px-4 py-2 font-display text-name font-extrabold uppercase text-on-accent hover:bg-ink"
              >
                Draft my undercard
              </button>
            </>
          )}
          <p className="text-label text-muted">
            Your own headliners or town run live: about 15 seconds and up to 12
            Qloo calls, limited to 5 runs a day from your address. Nothing is
            saved, and Sagebrush Sound&apos;s bill stays as it is.
          </p>
          <Link
            href="/"
            className="self-start text-label underline underline-offset-2 hover:text-accent"
          >
            Back to Sagebrush Sound
          </Link>
        </form>
      </main>
    </div>
  );
}
