"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActCardPanel } from "@/components/act-card-panel";
import { BandChart, type Printing } from "@/components/chart/band-chart";
import { billRows, editionRows } from "@/components/chart/chart-rows";
import { RuleKey } from "@/components/chart/rule-key";
import { Quilt } from "@/components/chart/sleeve";
import { TopBar } from "@/components/chart/top-bar";
import { VenueSwitch, type VenueLine } from "@/components/chart/venue-switch";
import {
  headlinersBooked,
  headlinersNote,
  factsLine,
  headline,
  QLOO_LINE,
  SKIP,
  STAMP,
  WATCH,
} from "@/components/chart/words";
import { ModelBill } from "@/components/model-bill";
import { RunningOrderPanel } from "@/components/running-order-panel";
import { TownSwitcher } from "@/components/town-switcher";
import { TracePanel, type BuildRequest } from "@/components/trace-panel";
import { useLlmOnly } from "@/components/use-llm-only";
import { useUndercardBuild } from "@/components/use-undercard-build";
import { useVenueSwitch } from "@/components/use-venue-switch";
import { useWatch, type WatchPhase } from "@/components/use-watch";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { TraceCall } from "@/lib/build-events";
import { firstBoard } from "@/lib/build-state";
import {
  checkedTownLabel,
  townsNear,
  type CheckedTown,
} from "@/lib/checked-towns";
import { lineupCsv } from "@/lib/csv";
import type { FeeBand } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { FirstBill } from "@/lib/first-bill";
import type { ClimbEvent } from "@/lib/lift-climb";
import type { Act } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { townOf } from "@/lib/towns";
import type { UnavailableReason } from "@/lib/unavailable";
import { venueHues } from "@/lib/venue-colours";
import type { Placed } from "@/lib/venue-switch";
import type { YourBrief } from "@/lib/your-festival";
import "./chart/chart.css";

type Mode = "qloo" | "llm";

const savedAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  // Each side says what it shows (label fix 3).
  const options: { value: Mode; label: string }[] = [
    { value: "qloo", label: "With Qloo: the AI agent's lineup" },
    { value: "llm", label: "Without Qloo: an AI model's picks alone" },
  ];
  return (
    <div role="group" aria-label="Which bill" className="mode">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={mode === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function LlmOnlyNote({ city }: { city: string }) {
  return (
    <aside aria-label="The model alone" className="panel">
      <h2 className="panel-title">The model alone</h2>
      <p className="mt-2 text-label">
        The same brief went to Claude Sonnet 5.5 with no tools: the festival,
        its city, capacity and crowd, the headliners and the fee ranges. It
        answers from what it already knows, so no pick comes from a {city}{" "}
        venue&apos;s fans, and with no popularity data no fee range can be
        checked.
      </p>
      <p className="mt-2 text-label text-muted">
        With Qloo brings back the AI agent&apos;s lineup and its {city} venues.
      </p>
    </aside>
  );
}

/** A typed town that can't be found or is too thin (M6n): the checked towns are the next step. */
const THIN = new Set(["town-not-found", "too-few-rooms", "not-full"]);

/** Why a judge's own draft couldn't be finished, and the next step (M6f). */
function RunNotice({
  message,
  code,
  onEdit,
  region,
  onPick,
}: {
  message: string;
  code: string;
  onEdit: () => void;
  /** The typed state or country, to offer the checked towns in its country (M6n). */
  region?: string;
  onPick?: (town: CheckedTown) => void;
}) {
  const near = onPick && THIN.has(code) ? townsNear(region ?? "") : null;
  const country = near?.country
    ? `${/^United /.test(near.country) ? "the " : ""}${near.country}`
    : null;
  const offerName = country
    ? `Towns Undercard has already read in ${country}`
    : "Towns Undercard has already read";
  // Bring the notice into view once: on a phone it can sit below the chart, and in the lead it
  // can sit above where the page was scrolled to when the run started.
  const notice = useRef<HTMLElement>(null);
  useEffect(() => {
    const box = notice.current?.getBoundingClientRect();
    if (box && (box.top < 0 || box.top > window.innerHeight))
      notice.current?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <section
      ref={notice}
      aria-label="This draft couldn't be finished"
      className="panel notice"
    >
      <h2 className="panel-title notice-title">
        {code === "limit"
          ? "Today's live runs are used"
          : code === "qloo-busy"
            ? "Qloo is busy right now"
            : code === "not-full"
              ? "Some slots stayed open"
              : code === "no-saved-build"
                ? "No saved build for this town yet"
                : code === "town-not-found"
                  ? "Qloo couldn't find this town"
                  : code === "too-few-rooms"
                    ? "Too few venues in this town"
                    : "This draft couldn't be finished"}
      </h2>
      <p className="mt-2 text-label">{message}</p>
      {near && (
        <>
          <h3 className="mt-3 text-label font-bold">
            {country
              ? `Try one Undercard has already read in ${country}:`
              : "Try a town Undercard has already read:"}
          </h3>
          <ul aria-label={offerName} className="town-grid mt-2">
            {near.towns.map((town) => (
              <li key={`${town.city}|${town.region}`}>
                <button
                  type="button"
                  onClick={() => onPick?.(town)}
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
        </>
      )}
      {code === "limit" ? (
        <Link href="/" className="link mt-3 inline-block text-label">
          Back to Sagebrush Sound, which replays without a limit
        </Link>
      ) : (
        <button type="button" onClick={onEdit} className="tool mt-3">
          Change the brief
        </button>
      )}
    </section>
  );
}

/** The Qloo call a climb step came from, matched as the replay matches it (replayClimbs). */
function stepCall(
  step: ClimbEvent,
  calls: readonly TraceCall[],
  bands: readonly FeeBand[],
): TraceCall | null {
  const band = bands.find((entry) => entry.id === step.band);
  if (!band) return null;
  return (
    calls.find(
      (call) =>
        call.summary.startsWith(`${band.label}-band`) &&
        (step.venue
          ? call.tool === "venue_artists" &&
            call.summary.includes(`headliners and ${step.venue.name}`)
          : call.tool === "baseline_artists"),
    ) ?? null
  );
}

/**
 * Watch's banner over the chart: whose fans this edition of the chart adds, the Qloo calls so
 * far as ticks, the AI agent's latest line, and Skip, which is always there.
 */
function EditionBanner({
  phase,
  step,
  hue,
  call,
  calls,
  total,
  note,
  lifted,
  headliners,
  replayed,
  onSkip,
}: {
  phase: WatchPhase;
  step: ClimbEvent | null;
  hue: number | null;
  call: TraceCall | null;
  calls: number;
  total: number;
  note: string | null;
  /** Acts on the lineup this edition's venue lifted; null until the lineup is in. */
  lifted: number | null;
  headliners: readonly string[];
  replayed: boolean;
  onSkip: () => void;
}) {
  const first = phase === "calls" || !step;
  // A live run sends its lineup after its last call: until then, the edition's own climbs.
  const climbs =
    step?.acts.filter((listed) => listed.move !== null).length ?? 0;
  const title = first
    ? replayed
      ? "Replaying the AI agent's build"
      : "The AI agent is planning its Qloo calls"
    : step.venue
      ? `+ ${step.venue.name}'s fans`
      : `${headliners.join(" + ")} fans alone`;
  const line = first
    ? "First it finds the headliners and the town's music venues in Qloo."
    : step.venue
      ? lifted === null
        ? climbs > 0
          ? `The chart re-sorts with this venue's fans added: ${climbs} of the top ${step.acts.length} ${climbs === 1 ? "climbs" : "climb"} ${MIN_LIFT} places or more.`
          : `The chart re-sorts with this venue's fans added: no act in view climbs ${MIN_LIFT} places.`
        : lifted > 0
          ? `The chart re-sorts with this venue's fans added: ${lifted} ${lifted === 1 ? "act climbs" : "acts climb"} onto the lineup.`
          : `The chart re-sorts with this venue's fans added: no act climbs ${MIN_LIFT} places onto the lineup.`
      : "Qloo ranks the artists the headliners' fans like: the chart before any venue.";
  const shown = Math.max(total, calls);
  return (
    <div
      className={`edition ${hue !== null ? `venue-${hue} edition-venue` : "edition-plain"}`}
    >
      <div className="edition-main" aria-live="polite">
        <p className="edition-title">{title}</p>
        <p className="edition-line">{line}</p>
        {call && (
          <p className="edition-call">
            Qloo call {call.n} of {shown}: {call.summary}
            {call.resultCount !== null ? ` · ${call.resultCount} results` : ""}
          </p>
        )}
        {note && <p className="edition-note">The AI agent: {note}</p>}
      </div>
      <div className="edition-side">
        <span
          className="ticks"
          role="img"
          aria-label={`${calls} of ${shown} Qloo calls in`}
        >
          {Array.from({ length: shown }, (_, i) => (
            <i key={i} className={i < calls ? "lit" : ""} />
          ))}
        </span>
        <button type="button" onClick={onSkip} className="edition-skip">
          {SKIP}
        </button>
      </div>
    </div>
  );
}

export function FestivalScreen({
  festival,
  firstBill = null,
  towns = ["boise"],
  custom,
  checked,
}: {
  festival: Festival;
  /** The latest saved build, read on the server; null falls back to the empty board. */
  firstBill?: FirstBill | null;
  /** Towns with a saved build of the same brief, for the switcher; Boise alone hides it. */
  towns?: readonly string[];
  /**
   * A judge's own brief (M6f): the agent runs live for it as soon as the screen opens. There is
   * no Without Qloo, refill, venue switch or town switcher, and nothing is saved.
   */
  custom?: {
    brief: YourBrief;
    onEdit: () => void;
    /** A checked town picked from a thin town's state (M6n). */
    onPick?: (town: CheckedTown) => void;
  };
  /**
   * A checked town from Your festival (M6m): its saved build replays as soon as the screen
   * opens, with the live run next to it; there's no town switcher, and a way back to the towns.
   */
  checked?: { onBack: () => void };
}) {
  const {
    state,
    build,
    markUnavailable,
    toggleKeep,
    redraft,
    runningOrder,
    closeOrder,
  } = useUndercardBuild(
    firstBoard(firstBill),
    festival.id,
    custom?.brief,
    checked !== undefined,
  );
  const watch = useWatch(state);
  const llm = useLlmOnly(festival.id);
  // The switch works from the saved build on screen, never a judge's own run (it isn't saved).
  // It follows a new build once the build has finished, so a live run's lineup is the one it
  // re-forms (on a preview, which saves nothing, the switch then says it isn't available).
  const [switchBuild, setSwitchBuild] = useState<string | null>(
    firstBill?.build.id ?? null,
  );
  // Adopted during render once a build has finished (React: adjusting state when props change).
  const finished =
    state.status !== "building" ? (state.build?.id ?? null) : null;
  if (finished && finished !== switchBuild) setSwitchBuild(finished);
  const switcher = useVenueSwitch(festival.id, switchBuild, !custom);
  // What the server read at first paint belongs to that build only.
  const onFirst = firstBill !== null && switchBuild === firstBill.build.id;
  const [mode, setMode] = useState<Mode>("qloo");
  // Watch on a saved build replays it; a fresh run is the agent planning live. The build event
  // settles it; until then, what was asked for.
  const [replaying, setReplaying] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [printing, setPrinting] = useState<Printing>(null);
  const board = useRef<HTMLElement>(null);

  const watching = watch.phase === "calls" || watch.phase === "climbing";
  const whatIf = switcher.lineup !== null;

  // The venues the build read, in its order: from the switch once it's in, else the saved build.
  const allVenues = useMemo(() => {
    if (switcher.venues.length) return switcher.venues;
    const seen = new Map<string, { entityId: string; name: string }>();
    if (onFirst)
      for (const band of festival.feeBands)
        for (const venue of firstBill?.anchors[band.id] ?? [])
          if (!seen.has(venue.entityId)) seen.set(venue.entityId, venue);
    for (const act of state.acts)
      if (!seen.has(act.anchorVenue.entityId))
        seen.set(act.anchorVenue.entityId, act.anchorVenue);
    return [...seen.values()];
  }, [switcher.venues, onFirst, festival.feeBands, firstBill, state.acts]);

  // Each venue keeps its colour while venues switch off and on and while Watch replays: worked
  // out from the saved lineup (the switch's every-venue lineup, or the server's first read).
  const savedActs = useMemo(
    () =>
      switcher.baseActs ??
      (onFirst
        ? firstBill!.acts
        : state.acts.length
          ? state.acts
          : (firstBill?.acts ?? [])),
    [switcher.baseActs, onFirst, firstBill, state.acts],
  );
  const hues = useMemo(
    () => venueHues(allVenues, savedActs),
    [allVenues, savedActs],
  );

  // Each act's place now and before: the switch's own results, else the server's read.
  const placeOf: Readonly<Record<string, Placed>> = useMemo(
    () => ({
      ...(switcher.basePlaces ?? {}),
      ...(onFirst ? (firstBill?.places ?? {}) : {}),
      ...(switcher.lineup?.places ?? {}),
    }),
    [switcher.basePlaces, onFirst, firstBill, switcher.lineup],
  );

  const shownActs = switcher.lineup?.acts ?? state.acts;
  const bookedActs = whatIf
    ? shownActs
    : shownActs.filter((act) => !state.unavailable.includes(act.entityId));
  const openAct = shownActs.find((act) => act.entityId === openId) ?? null;
  const calls = state.summary?.calls ?? firstBill?.calls;
  const placesListed =
    state.calls.find((call) => call.tool === "find_venues")?.resultCount ??
    firstBill?.placesListed ??
    null;
  const busy =
    state.status === "building" ||
    state.refilling !== null ||
    state.redrafting ||
    state.ordering;

  const venueLines: VenueLine[] = allVenues.map((venue) => ({
    entityId: venue.entityId,
    name: venue.name,
    hue: hues.get(venue.entityId) ?? 0,
    lifted: bookedActs.filter(
      (act) => act.anchorVenue.entityId === venue.entityId,
    ).length,
    kind: savedActs.find((act) => act.anchorVenue.entityId === venue.entityId)
      ?.anchorVenue.kind,
  }));
  const slots = festival.feeBands.reduce((sum, band) => sum + band.slots, 0);

  function startShow(replay: boolean) {
    // Watch shows the agent's build, so it brings the chart back from Without Qloo.
    setMode("qloo");
    setOpenId(null);
    switcher.reset();
    // The lineup prints in down the chart once Watch hands it back (reduced motion: at once).
    setPrinting(watch.reduced ? null : "replay");
    setReplaying(replay);
    watch.start();
    // On a phone the chart sits under the lead: bring the show into view.
    if (typeof window !== "undefined" && window.innerWidth < 1100)
      board.current?.scrollIntoView?.({
        block: "start",
        behavior: watch.reduced ? "auto" : "smooth",
      });
  }

  function runBuild(request: BuildRequest = {}) {
    startShow(
      !request.fresh && (state.build !== null || checked !== undefined),
    );
    void build(request);
  }

  // A judge's own run is never saved, so once it has finished Watch replays the run the screen
  // holds: no request, no live run spent, the draft kept. A run that stopped short offers to run
  // the agent again instead.
  const ownRun =
    custom !== undefined && state.status === "done" && state.climbs.length > 0;
  const runAgain =
    custom !== undefined &&
    !ownRun &&
    (state.status === "done" || state.status === "error");
  // Once the day's live runs are used, running again can only be refused: the notice points to
  // the replay instead.
  const limited =
    custom !== undefined &&
    state.status !== "building" &&
    (state.errorCode === "limit" || state.refusalCode === "limit");
  // Running a town Qloo can't find, or one with too few venues, again can't help: the notice
  // and its checked towns take the run button's place in the lead.
  const thinTown =
    custom !== undefined &&
    state.status !== "building" &&
    (state.errorCode === "town-not-found" ||
      state.errorCode === "too-few-rooms");
  const notice =
    (custom || checked) && state.status !== "building" && state.errorCode ? (
      <RunNotice
        message={state.error ?? ""}
        code={state.errorCode}
        onEdit={custom?.onEdit ?? checked!.onBack}
        region={custom?.brief.region}
        onPick={custom?.onPick}
      />
    ) : null;
  // Elsewhere Watch replays the saved build, whose count is the one on screen only while the
  // screen shows that build.
  const savedOnScreen = onFirst || state.build?.replayed === true;

  // A judge's own brief runs once, as soon as its screen opens; a checked town replays.
  const started = useRef(false);
  useEffect(() => {
    if ((!custom && !checked) || started.current) return;
    started.current = true;
    runBuild({ fresh: custom !== undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refill(act: Act, reason: UnavailableReason) {
    setPrinting("refill");
    void markUnavailable(act, reason);
  }

  function changeMode(next: Mode) {
    setMode(next);
    setOpenId(null);
    if (
      next === "llm" &&
      (llm.state.status === "idle" || llm.state.status === "error")
    )
      void llm.load();
  }

  function exportCsv() {
    downloadText(
      `${festival.id}-undercard.csv`,
      lineupCsv(bookedActs, festival.feeBands, whatIf ? {} : state.replaced),
      "text/csv;charset=utf-8",
    );
  }

  // Watch's current edition, and the call and the AI agent's line it came with.
  const step = watch.current;
  const call = step ? stepCall(step, state.calls, festival.feeBands) : null;
  const stepHue =
    step?.venue && watch.phase === "climbing"
      ? (hues.get(step.venue.entityId) ?? null)
      : null;
  // The acts this edition's venue put on the lineup, once the lineup is in: a replay sends it
  // early, a live run only after its last Qloo call.
  const liftedHere =
    step?.venue && state.acts.length > 0
      ? state.acts.filter(
          (act) =>
            act.band === step.band &&
            act.anchorVenue.entityId === step.venue!.entityId,
        ).length
      : null;
  // Only the planner's own lines are the agent's; a replay's status line isn't.
  const note = call
    ? (state.notes.filter((entry) => entry.at < call.n).at(-1)?.text ?? null)
    : (state.notes.at(-1)?.text ?? null);

  const bandsView =
    mode === "llm" ? (
      <ModelBill
        festival={festival}
        state={llm.state}
        onRetry={() => void llm.load()}
      />
    ) : (
      <div className="bands">
        {festival.feeBands.map((band) => {
          if (watching) {
            const edition = watch.latest(band.id);
            return (
              <BandChart
                key={band.id}
                band={band}
                current={!step || step.band === band.id}
                rows={
                  edition ? editionRows(edition, state.acts, placeOf, hues) : []
                }
                sortKey={edition ?? "calls"}
                motion={!watch.reduced}
                top={firstBill?.baselineTop[band.id]}
                caption={
                  edition
                    ? edition.venue
                      ? `With ${edition.venue.name}'s fans added`
                      : "For the headliners' fans alone"
                    : "Waiting for this band's first ranking…"
                }
              />
            );
          }
          const open = whatIf
            ? (switcher.lineup?.shortfall[band.id] ?? 0)
            : Math.max(
                0,
                band.slots -
                  state.acts.filter((act) => act.band === band.id).length,
              );
          return (
            <BandChart
              key={band.id}
              band={band}
              rows={billRows(
                band,
                shownActs,
                placeOf,
                hues,
                open,
                whatIf
                  ? "No act from the venues left on clears the bar."
                  : state.acts.length === 0
                    ? state.status === "building"
                      ? "The AI agent is drafting this slot."
                      : state.status === "error"
                        ? "The AI agent couldn't draft this slot; the note says why."
                        : "Empty until the AI agent drafts the lineup."
                    : "No act the venues lifted clears the bar.",
              )}
              column={festival.feeBands.indexOf(band)}
              sortKey={whatIf ? [...switcher.off].sort().join() : "bill"}
              motion={!watch.reduced}
              top={firstBill?.baselineTop[band.id]}
              openId={openAct?.entityId ?? null}
              keeping={whatIf ? [] : state.keeping}
              unavailable={whatIf ? [] : state.unavailable}
              onOpen={(act) =>
                setOpenId((current) =>
                  current === act.entityId ? null : act.entityId,
                )
              }
              printing={printing}
            >
              {(act) => (
                <ActCardPanel
                  act={act}
                  unavailable={
                    !whatIf && state.unavailable.includes(act.entityId)
                  }
                  disabled={
                    state.refilling !== null || state.redrafting || !state.build
                  }
                  onUnavailable={custom || whatIf ? undefined : refill}
                  kept={!whatIf && state.keeping.includes(act.entityId)}
                  onKeep={custom || whatIf ? undefined : toggleKeep}
                  onClose={() => setOpenId(null)}
                  city={festival.city}
                  place={placeOf[act.entityId]}
                  hue={hues.get(act.anchorVenue.entityId) ?? null}
                  band={festival.feeBands.find(
                    (entry) => entry.id === act.band,
                  )}
                  note={
                    whatIf
                      ? "Turn every venue back on to keep or replace acts."
                      : undefined
                  }
                />
              )}
            </BandChart>
          );
        })}
      </div>
    );

  return (
    <div className="chart-app stage-bg">
      <TopBar>
        {checked && (
          <button type="button" onClick={checked.onBack}>
            Pick another town
          </button>
        )}
      </TopBar>

      <div className="layout">
        <section aria-label="What Undercard does" className="lead lead-top">
          <p className="lead-line">{headline(festival)}</p>
          <p className="lead-what">
            <strong>Undercard is an AI agent:</strong> it drafts the acts that
            play before the headliners from what fans of the town&apos;s own
            venues like.
          </p>
          <div>
            {thinTown
              ? notice
              : !limited && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        ownRun
                          ? startShow(true)
                          : runBuild(runAgain ? { fresh: true } : {})
                      }
                      disabled={busy || watching}
                      className="watch"
                    >
                      <span className="watch-play" aria-hidden>
                        <svg viewBox="0 0 20 20">
                          <path d="M4 2v16l14-8z" />
                        </svg>
                      </span>
                      {watching
                        ? "Watching…"
                        : state.status === "building"
                          ? "Building…"
                          : runAgain
                            ? "Run the agent again"
                            : state.build
                              ? WATCH
                              : "Build undercard"}
                    </button>
                    <p className="watch-sub">
                      <span className="ticks" aria-hidden>
                        {Array.from(
                          { length: Math.min(calls ?? 12, 12) },
                          (_, i) => (
                            <i key={i} />
                          ),
                        )}
                      </span>
                      {custom
                        ? ownRun
                          ? `Replays its ${calls ?? state.calls.length} Qloo calls`
                          : runAgain
                            ? "Runs the AI agent again; its Qloo calls list below"
                            : "Runs the AI agent; its Qloo calls list below"
                        : !state.build
                          ? "Runs the AI agent; its Qloo calls list below"
                          : savedOnScreen
                            ? `Replays its ${calls ?? 12} Qloo calls`
                            : "Replays the saved build's Qloo calls"}
                    </p>
                  </>
                )}
            <p className="qloo-line">{QLOO_LINE}</p>
          </div>
        </section>

        <main ref={board} className="board">
          <section
            {...(mode === "qloo"
              ? { "aria-label": "Undercard draft" }
              : { "aria-label": "The festival" })}
            className={`draft ${watching ? "is-watching" : ""}`}
          >
            <div className="masthead">
              <div>
                <h1>{festival.name}</h1>
                <p className="facts">{factsLine(festival)}</p>
              </div>
              <p className="stamp">{STAMP}</p>
            </div>
            <ul aria-label="Booked headliners" className="headliners">
              {festival.headliners.map((name) => (
                <li key={name} className="headliner">
                  <Quilt name={name} />
                  <span className="headliner-name">{name}</span>
                </li>
              ))}
            </ul>
            <p className="headliners-note">
              {mode === "qloo"
                ? headlinersNote(festival, state.acts.length > 0)
                : headlinersBooked(festival)}
              {mode === "qloo" &&
                state.acts.length > 0 &&
                !custom &&
                !whatIf && (
                  <span className="click-hint">
                    {" "}
                    Click an act to see why, keep it or mark it unavailable.
                  </span>
                )}
            </p>
            {watching && (
              <EditionBanner
                phase={watch.phase}
                step={step}
                hue={stepHue}
                call={call}
                calls={state.calls.length}
                total={calls ?? 12}
                note={note}
                lifted={liftedHere}
                headliners={festival.headliners}
                replayed={replaying || state.build?.replayed === true}
                onSkip={watch.skip}
              />
            )}
            {whatIf && !watching && mode === "qloo" && (
              <p className="whatif" role="status">
                What if{" "}
                {switcher.off.size === 1 ? "that venue's" : "those venues'"}{" "}
                fans weren&apos;t asked? The rule re-formed the lineup from the
                saved build, with no new Qloo call.
                <button
                  type="button"
                  className="switch-reset"
                  onClick={switcher.reset}
                >
                  All venues on
                </button>
              </p>
            )}
            {bandsView}
            {/* The running order is planned for the saved lineup: it steps aside while a venue is off. */}
            {mode === "qloo" &&
              !watching &&
              !whatIf &&
              state.order &&
              !openAct && (
                <RunningOrderPanel
                  slots={state.order}
                  headliners={festival.headliners}
                  onClose={closeOrder}
                  acts={state.acts}
                />
              )}
            {!watching && (
              <div className="tools">
                {!custom && <ModeSwitch mode={mode} onChange={changeMode} />}
                {mode === "qloo" && !custom && state.build && (
                  <button
                    type="button"
                    className="tool"
                    onClick={() => {
                      setOpenId(null);
                      void runningOrder();
                    }}
                    disabled={busy || whatIf}
                  >
                    {state.ordering
                      ? "Planning the running order…"
                      : "Running order"}
                  </button>
                )}
                {mode === "qloo" &&
                  !custom &&
                  state.keeping.length > 0 &&
                  !whatIf && (
                    <button
                      type="button"
                      className="tool tool-strong"
                      onClick={() => {
                        setPrinting("refill");
                        setOpenId(null);
                        void redraft();
                      }}
                      disabled={busy}
                    >
                      {state.redrafting ? "Redrafting…" : "Redraft the rest"}
                    </button>
                  )}
                {mode === "qloo" && bookedActs.length > 0 && (
                  <button type="button" className="tool" onClick={exportCsv}>
                    Export CSV
                  </button>
                )}
                {!custom && (
                  <Link
                    className="tool"
                    href={
                      festival.id === SAGEBRUSH_SOUND.id
                        ? "/compare"
                        : `/compare?b=${encodeURIComponent(festival.id)}`
                    }
                  >
                    Compare with another town
                  </Link>
                )}
              </div>
            )}
            {mode === "qloo" &&
              state.keeping.length > 0 &&
              !whatIf &&
              !watching && (
                <p className="tools-note">
                  Redraft the rest keeps {state.keeping.length}{" "}
                  {state.keeping.length === 1 ? "act" : "acts"} and refills the
                  other slots from the same venues, in at most 3 Qloo calls.
                </p>
              )}
            {mode === "qloo" && (
              <p className="drafted">
                {calls && state.build?.createdAt
                  ? `Drafted by the AI agent from ${calls} Qloo calls · saved ${savedAt.format(new Date(state.build.createdAt))} UTC`
                  : state.status === "building"
                    ? "The AI agent is drafting the undercard."
                    : "No undercard drafted yet."}
              </p>
            )}
          </section>
        </main>

        <div className="lead lead-side">
          {!thinTown && notice}
          {/* Without Qloo the model's picks stand alone: its note takes the venues' place. */}
          {mode === "llm" && <LlmOnlyNote city={festival.city} />}
          {/* While Watch plays the switch steps aside: the lineup it counts is being re-drawn. */}
          {mode === "qloo" && !custom && !watching && allVenues.length > 0 && (
            <VenueSwitch
              city={festival.city}
              venues={venueLines}
              off={switcher.off}
              status={switcher.status}
              onToggle={(id) => {
                setOpenId(null);
                switcher.toggle(id);
              }}
              onReset={switcher.reset}
              filled={bookedActs.length}
              slots={slots}
              placesListed={placesListed}
              editable={!watching && !busy && mode === "qloo"}
            />
          )}
          {mode === "qloo" && (
            <>
              <RuleKey />
              <TracePanel
                state={state}
                savedCalls={firstBill?.calls}
                replay={!custom}
                onBuild={runBuild}
                button={false}
              />
            </>
          )}
          {!custom && !checked && (
            <TownSwitcher current={townOf(festival).slug} onShow={towns} />
          )}
        </div>
      </div>
    </div>
  );
}
