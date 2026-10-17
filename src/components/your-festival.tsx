"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FestivalScreen } from "@/components/festival-screen";
import {
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

/**
 * "Your festival" (M6f): a judge's own town and two headliners. The agent runs live for them
 * with Sagebrush Sound's crowd and fee bands, under the same per-IP limit, and nothing is saved.
 */
export function YourFestival({
  linked = null,
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
} = {}) {
  const [values, setValues] = useState(
    linked ?? { city: "", region: "", first: "", second: "" },
  );
  const fromLink = linked !== null;
  const [problem, setProblem] = useState<string | null>(null);
  const [brief, setBrief] = useState<YourBrief | null>(null);
  const [run, setRun] = useState(0);

  if (brief)
    return (
      <FestivalScreen
        key={run}
        festival={yourFestival(brief, `yours-draft-${run}`)}
        custom={{ brief, onEdit: () => setBrief(null) }}
      />
    );

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = problemWith(values);
    setProblem(found);
    if (found) return;
    setRun((n) => n + 1);
    setBrief(
      YourBriefSchema.parse({
        city: values.city,
        region: values.region,
        headliners: [values.first, values.second],
      }),
    );
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
          className="flex w-full max-w-xl flex-col gap-4 self-start border-2 border-rule bg-surface p-6"
        >
          <h1
            id="your-festival-title"
            className="font-display text-band font-extrabold uppercase"
          >
            Your festival
          </h1>
          <p className="text-body">
            Name a town and two booked headliners. The agent reads that
            town&apos;s own music rooms through Qloo and drafts the undercard,
            with Sagebrush Sound&apos;s crowd (aged 25–34) and fee bands.
          </p>
          {fromLink && (
            <p className="text-label font-semibold">
              Filled in from your link. Check it, then press Draft my undercard
              to run it.
            </p>
          )}
          {field("city", "Town", "Such as Duluth")}
          {field("region", "State or country", "Such as Minnesota")}
          {field("first", "First headliner", "Such as Khruangbin")}
          {field("second", "Second headliner", "Such as Japanese Breakfast")}
          {problem && (
            <p role="alert" className="text-label font-semibold text-danger">
              {problem}
            </p>
          )}
          <button
            type="submit"
            className="self-start rounded-sm bg-accent px-4 py-2 font-display text-name font-extrabold uppercase text-on-accent hover:bg-ink"
          >
            Draft my undercard
          </button>
          <p className="text-label text-muted">
            It runs live: about 15 seconds and up to 12 Qloo calls, limited to 5
            runs a day from your address. Nothing is saved, and Sagebrush
            Sound&apos;s bill stays as it is.
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
