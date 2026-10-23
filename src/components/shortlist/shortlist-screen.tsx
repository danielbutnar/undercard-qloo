"use client";

import { useState, type FormEvent } from "react";
import { TopBar } from "@/components/chart/top-bar";
import "@/components/chart/chart.css";
import "./shortlist.css";
import { CHECKED_TOWNS, checkedTownLabel } from "@/lib/checked-towns";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { pastedNames, ShortlistSchema, type Shortlist } from "@/lib/shortlist";
import { checkedFestival } from "@/lib/towns";
import { ShortlistResults } from "./shortlist-results";
import { CHECK_BUTTON, SHORTLIST_LEAD, SHORTLIST_TITLE } from "./words";

const TOWNS = CHECKED_TOWNS.map((town) => ({
  festival: checkedFestival(town),
  label: checkedTownLabel(town),
}));

type State =
  | { status: "idle" }
  | { status: "checking"; names: number }
  | { status: "error"; message: string }
  | { status: "done"; shortlist: Shortlist };

/**
 * The buyer's shortlist (WS4): pick one of the checked towns, paste the acts you've been
 * pitched, and Undercard sorts them by how fans of that town's venues rank them, with each
 * act's fee range and genre fit. It drafts nothing and books nothing.
 */
export function ShortlistScreen() {
  const [festivalId, setFestivalId] = useState(SAGEBRUSH_SOUND.id);
  const [text, setText] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const town = TOWNS.find((entry) => entry.festival.id === festivalId);
  const checking = state.status === "checking";

  async function check(event: FormEvent) {
    event.preventDefault();
    const names = pastedNames(text);
    setState({ status: "checking", names: names.length });
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
      if (response.ok && parsed.success)
        return setState({ status: "done", shortlist: parsed.data });
      const message =
        body && typeof body === "object" && "error" in body
          ? String(body.error)
          : "The check didn't finish. Try again in a minute.";
      setState({ status: "error", message });
    } catch {
      setState({
        status: "error",
        message: "The check didn't finish. Try again in a minute.",
      });
    }
  }

  const shown = state.status === "done" ? state.shortlist : null;
  return (
    <div className="chart-app stage-bg">
      <TopBar />
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
                Acts you&apos;ve been pitched, one per line, up to 10
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
              of the town&apos;s venues. It drafts nothing and books nothing.
            </p>
          </form>
          <div className="shortlist-out">
            {state.status === "idle" && (
              <section
                className="panel shortlist-empty"
                aria-label="Your sorted shortlist"
              >
                <h2 className="panel-title">Your sorted shortlist</h2>
                <p className="panel-sub">
                  Paste the names and press {CHECK_BUTTON}: each act&apos;s
                  climb with {town?.festival.city ?? "the town"}&apos;s venue
                  fans, its fee range and its genre fit print here.
                </p>
              </section>
            )}
            {checking && (
              <p className="panel shortlist-status" aria-live="polite">
                Checking {state.names} {state.names === 1 ? "name" : "names"} on
                Qloo: a search each, then a ranking for the headliners&apos;
                fans alone and one for each venue…
              </p>
            )}
            {state.status === "error" && (
              <p role="alert" className="panel alert shortlist-status">
                {state.message}
              </p>
            )}
            {shown && (
              <ShortlistResults
                shortlist={shown}
                title={`Sorted for ${shown.city}'s venues`}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
