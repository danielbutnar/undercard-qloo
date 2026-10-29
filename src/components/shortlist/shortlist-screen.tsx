"use client";

import { useState, type FormEvent } from "react";
import { TopBar } from "@/components/chart/top-bar";
import "@/components/chart/chart.css";
import "./shortlist.css";
import { CHECKED_TOWNS, checkedTownLabel } from "@/lib/checked-towns";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import {
  distinctNames,
  pastedNames,
  SHORTLIST_MAX_NAMES,
  ShortlistSchema,
  type Shortlist,
  type ShortlistExample,
} from "@/lib/shortlist";
import { checkedFestival } from "@/lib/towns";
import { ShortlistCalls } from "./shortlist-calls";
import { ShortlistResults } from "./shortlist-results";
import {
  CHECK_BUTTON,
  exampleNote,
  examplePending,
  exampleTitle,
  namesProblem,
  SHORTLIST_LEAD,
  SHORTLIST_TITLE,
} from "./words";

const TOWNS = CHECKED_TOWNS.map((town) => ({
  festival: checkedFestival(town),
  label: checkedTownLabel(town),
}));

const FAILED = "The check didn't finish. Try again in a minute.";

type Status =
  | { kind: "idle" }
  | { kind: "checking"; names: number }
  | { kind: "error"; message: string };

/** The route's error message, or the plain one. */
function errorOf(body: unknown): string {
  return body && typeof body === "object" && "error" in body
    ? String(body.error)
    : FAILED;
}

/**
 * The buyer's shortlist (WS4): pick one of the checked towns, paste the acts you've been
 * pitched, and Undercard sorts them by how Qloo ranks them with that town's venue fans added, with each
 * act's fee range and genre fit. It drafts nothing and books nothing; the page calls Qloo only
 * when the buyer presses the button.
 */
export function ShortlistScreen({
  example = null,
  linked = null,
}: {
  /**
   * Boise's example (step 5), read on the server from the Qloo cache alone: the model's own
   * picks fill the form, and their rows show until the buyer's first check.
   */
  example?: ShortlistExample | null;
  /**
   * A link's town and names (WS18 item 4: "Check its picks on Qloo →"), read on the server: they
   * fill the form, and nothing runs until the buyer presses the button. The example's rows stay
   * only when the link asks for the example's own list.
   */
  linked?: { festivalId: string; names: string[] } | null;
} = {}) {
  const exampleNames = example ? example.names.join("\n") : "";
  const linkedNames = linked ? linked.names.join("\n") : "";
  const ownList =
    !linked ||
    (example !== null &&
      linked.festivalId === example.festivalId &&
      (!linkedNames || linkedNames === exampleNames));
  const [festivalId, setFestivalId] = useState(
    linked?.festivalId ?? example?.festivalId ?? SAGEBRUSH_SOUND.id,
  );
  const [text, setText] = useState(linkedNames || exampleNames);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [result, setResult] = useState<Shortlist | null>(
    ownList ? (example?.shortlist ?? null) : null,
  );
  // Each answered check brings its rows into view (a phone shows them under the form); until
  // the first, the rows on show are the example's.
  const [answered, setAnswered] = useState(0);
  const town = TOWNS.find((entry) => entry.festival.id === festivalId);
  const checking = status.kind === "checking";
  const showingExample = answered === 0 && result !== null && example !== null;
  const exampleCity =
    TOWNS.find((entry) => entry.festival.id === example?.festivalId)?.festival
      .city ?? "";

  async function check(event: FormEvent) {
    event.preventDefault();
    const names = pastedNames(text);
    const problem = namesProblem(
      distinctNames(names).names.length,
      SHORTLIST_MAX_NAMES,
    );
    if (problem) return setStatus({ kind: "error", message: problem });
    setStatus({ kind: "checking", names: distinctNames(names).names.length });
    try {
      const response = await fetch("/api/shortlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ festival: festivalId, names }),
      });
      const body: unknown = await response.json().catch(() => null);
      const parsed = ShortlistSchema.safeParse(
        body && typeof body === "object" && "shortlist" in body
          ? body.shortlist
          : null,
      );
      if (!response.ok || !parsed.success)
        return setStatus({ kind: "error", message: errorOf(body) });
      setResult(parsed.data);
      setAnswered((n) => n + 1);
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "error", message: FAILED });
    }
  }

  return (
    <div className="chart-app stage-bg">
      <TopBar pitch={false} />
      <main className="shortlist">
        <div className="shortlist-lead">
          <h1 className="compare-title">{SHORTLIST_TITLE}</h1>
          <p className="compare-what">{SHORTLIST_LEAD}</p>
        </div>
        <div className="shortlist-layout">
          <form
            onSubmit={check}
            noValidate
            aria-label="Your shortlist"
            className="panel shortlist-form"
          >
            <label className="field">
              <span className="field-label">Town</span>
              <select
                name="town"
                value={festivalId}
                onChange={(event) => setFestivalId(event.target.value)}
                className="field-input"
              >
                {TOWNS.map(({ festival, label }) => (
                  <option key={festival.id} value={festival.id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">
                Acts you&apos;ve been pitched, one per line, up to{" "}
                {SHORTLIST_MAX_NAMES}
              </span>
              <textarea
                name="names"
                value={text}
                rows={10}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setText(event.target.value)}
                className="field-input shortlist-names"
              />
            </label>
            <button
              type="submit"
              disabled={checking}
              className="watch yours-go"
            >
              <span className="watch-play" aria-hidden>
                <svg viewBox="0 0 20 20">
                  <path d="M4 2v16l14-8z" />
                </svg>
              </span>
              {CHECK_BUTTON}
            </button>
            <p className="yours-note">
              A check makes up to 14 Qloo calls: a search for each name, then
              one ranking for the headliners&apos; fans alone and one for each
              of the town&apos;s venues. Limited to 5 checks a day from your
              address. It drafts nothing and books nothing.
            </p>
          </form>
          <div className="shortlist-out">
            {status.kind === "checking" && (
              <p className="panel shortlist-status" aria-live="polite">
                Checking {status.names} {status.names === 1 ? "name" : "names"}{" "}
                on Qloo: a search each, then a ranking for the headliners&apos;
                fans alone and one for each venue…
              </p>
            )}
            {status.kind === "error" && (
              <p role="alert" className="panel alert shortlist-status">
                {status.message}
              </p>
            )}
            {result ? (
              <>
                {result.festivalId !== festivalId && town && (
                  <p className="shortlist-note">
                    These are sorted for {result.city}. Press {CHECK_BUTTON} to
                    sort them for {town.festival.city}.
                  </p>
                )}
                <ShortlistResults
                  shortlist={result}
                  title={
                    showingExample
                      ? exampleTitle(result.city)
                      : `Sorted for ${result.city}'s venues`
                  }
                  note={
                    showingExample
                      ? exampleNote(example.names.length, result.city)
                      : undefined
                  }
                  focusKey={answered}
                />
              </>
            ) : (
              status.kind !== "checking" && (
                <section
                  className="panel shortlist-empty"
                  aria-label="Your sorted shortlist"
                >
                  <h2 className="panel-title">Your sorted shortlist</h2>
                  <p className="panel-sub">
                    {example && example.festivalId === festivalId
                      ? examplePending(example.names.length, exampleCity)
                      : `Paste the names and press ${CHECK_BUTTON}: each act's climb with ${town?.festival.city ?? "the town"}'s venue fans, its fee range and its genre fit print here.`}
                  </p>
                </section>
              )
            )}
          </div>
          {result && <ShortlistCalls shortlist={result} />}
        </div>
      </main>
    </div>
  );
}
