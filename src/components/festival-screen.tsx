"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ActCardPanel } from "@/components/act-card-panel";
import { FlyingActs, landsAt, type Flight } from "@/components/chart/flights";
import type { Printing } from "@/components/chart/band-chart";
import { billRows } from "@/components/chart/chart-rows";
import { ImageCredit } from "@/components/chart/image-credit";
import {
  HeadlinerList,
  ModelPicks,
  PicksRuler,
  PosterActions,
  PosterBand,
  VenueKey,
  type KeyVenue,
} from "@/components/chart/poster";
import {
  climbMark,
  exampleAct,
  exampleHint,
  bookedLabel,
  footnote,
  LEAD_TITLE,
  leadLine,
  legendLine,
  MISSED_CUT,
  oneActLine,
  openBandLine,
  openPosterLine,
  regionCode,
  RULE_LINE,
  stampWords,
  TAGLINE_LEAD,
  TAGLINE_QLOO,
  venueLine,
  WATCH_AGENT,
  watchSubLine,
  withoutCounts,
  withoutHeadline,
  withoutNote,
  withoutSummary,
} from "@/components/chart/poster-words";
import { RuleKey } from "@/components/chart/rule-key";
import {
  signName,
  TownScene,
  type SceneVenue,
} from "@/components/chart/town-scene";
import { VenueSwitch, type VenueLine } from "@/components/chart/venue-switch";
import { WithoutQlooChecksLine } from "@/components/chart/with-without-line";
import {
  AGENT_DECIDES,
  agentLine,
  ANCHORS_KEY,
  factsLine,
  saysAnchors,
  SKIP,
  switchLine,
  venueShort,
  watchCallLine,
  watchLine,
  watchTicksLabel,
  watchTitle,
} from "@/components/chart/words";
import { formatSavedAt } from "@/components/model-bill";
import { RunningOrderPanel } from "@/components/running-order-panel";
import { TracePanel, type BuildRequest } from "@/components/trace-panel";
import { useLlmOnly } from "@/components/use-llm-only";
import { useUndercardBuild } from "@/components/use-undercard-build";
import { useVenueSwitch } from "@/components/use-venue-switch";
import { namesVenue } from "@/lib/venue-call";
import { useWatch, type WatchPhase } from "@/components/use-watch";
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
import { TOWNS, townHref, townOf } from "@/lib/towns";
import type { UnavailableReason } from "@/lib/unavailable";
import { venueHues } from "@/lib/venue-colours";
import type { Placed } from "@/lib/venue-switch";
import type { YourBrief } from "@/lib/your-festival";
import "./chart/chart.css";
import "./chart/first-screen.css";

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

/** A laptop's width, where the town and the poster stand side by side (the screen's CSS grid). */
const WIDE = "(min-width: 1100px)";
function subscribeWide(change: () => void) {
  const query = window.matchMedia?.(WIDE);
  query?.addEventListener?.("change", change);
  return () => query?.removeEventListener?.("change", change);
}
const wideNow = () => window.matchMedia?.(WIDE)?.matches === true;
/** Whether the screen is laid out wide; false on the server and in a narrow window. */
function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, wideNow, () => false);
}

/** The poster's With and Without Qloo tabs, each named for what it shows (label fix 3). */
function ModeTabs({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  const options: { value: Mode; label: string; name: string }[] = [
    {
      value: "qloo",
      label: "With Qloo",
      name: "With Qloo: the AI agent's lineup",
    },
    {
      value: "llm",
      label: "Without Qloo",
      name: "Without Qloo: an AI model's picks alone",
    },
  ];
  return (
    <div role="group" aria-label="Which bill" className="poster-tabs">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={mode === option.value}
          aria-label={option.name}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A typed town that can't be found or is too thin (M6n): the checked towns are the next step. */
const THIN = new Set(["town-not-found", "too-few-rooms", "not-full"]);
// A run that hit the day's cap, a busy Qloo or a failed planner call can't be run again for now:
// its notice offers the checked towns in the same country to replay, or Sagebrush Sound's
// (plan.md item 2).
const REPLAY_INSTEAD = new Set(["limit", "qloo-busy", "planner-failed"]);

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
  const found = onPick ? townsNear(region ?? "") : null;
  const near =
    found &&
    (THIN.has(code) || (REPLAY_INSTEAD.has(code) && found.country !== null))
      ? found
      : null;
  const country = near?.country
    ? `${/^United /.test(near.country) ? "the " : ""}${near.country}`
    : null;
  const offerName = country
    ? `Towns Undercard has already read in ${country}`
    : "Towns Undercard has already read";
  // Bring the notice into view once: on a phone it can sit below the poster, and below the
  // fold on a laptop. On a phone a run starts by gliding down to the poster (startShow), and the
  // notice can mount before that glide has moved anything: there it is brought into view at once,
  // which stops the glide; anywhere, once the page has stopped moving, it is brought back if it
  // ended off screen.
  const notice = useRef<HTMLElement>(null);
  useEffect(() => {
    const offScreen = () => {
      const box = notice.current?.getBoundingClientRect();
      return !!box && (box.top < 0 || box.top > window.innerHeight);
    };
    const bring = () => notice.current?.scrollIntoView?.({ block: "start" });
    if (window.innerWidth < 1100 || offScreen()) bring();
    if (typeof requestAnimationFrame !== "function") return;
    let frame = 0;
    let last = Number.NaN;
    let still = 0;
    let frames = 0;
    const settle = () => {
      still = window.scrollY === last ? still + 1 : 0;
      last = window.scrollY;
      if (still < 10 && ++frames < 240) {
        frame = requestAnimationFrame(settle);
        return;
      }
      if (offScreen()) bring();
    };
    frame = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(frame);
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
                    : code === "planner-failed"
                      ? "The AI agent couldn't plan"
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
      {REPLAY_INSTEAD.has(code) && (code === "limit" || !near) && (
        <Link href="/" className="link mt-3 inline-block text-label">
          Back to Sagebrush Sound, which replays without a limit
        </Link>
      )}
      {code !== "limit" && (
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
            namesVenue(call.summary, step.venue.name)
          : call.tool === "baseline_artists"),
    ) ?? null
  );
}

/**
 * Watch's caption: whose fans this step adds, what they did, the Qloo call it came from, the
 * Qloo calls so far as ticks, and the AI agent's latest line (src/components/chart/words.ts). It
 * stands over the town on a laptop and inside the poster on a phone; Watch's own button skips.
 */
function WatchCaption({
  phase,
  step,
  hue,
  call,
  calls,
  total,
  note,
  anchorsKey,
  switched,
  noFanData,
  lifted,
  headliners,
  replayed,
  where,
}: {
  phase: WatchPhase;
  step: ClimbEvent | null;
  hue: number | null;
  call: TraceCall | null;
  calls: number;
  total: number;
  note: string | null;
  /** The agent's line is its first that says "Anchors": the key goes under it. */
  anchorsKey: boolean;
  /** The planner's venue switch, in one sentence, where the saved trace shows it here. */
  switched: string | null;
  /** Qloo had no fan data for this step's venue (the saved build's, from the cache). */
  noFanData: boolean;
  /** Acts on the lineup this step's venue lifted; null until the lineup is in. */
  lifted: number | null;
  headliners: readonly string[];
  replayed: boolean;
  where: "town" | "poster";
}) {
  const first = phase === "calls" || !step;
  const title = watchTitle({ first, step, replayed, headliners });
  const line = watchLine({ first, step, lifted, noFanData });
  const shown = Math.max(total, calls);
  return (
    <div
      className={`edition watch-caption watch-caption-${where} ${hue !== null ? `venue-${hue} edition-venue` : "edition-plain"}`}
    >
      <div className="edition-main" aria-live="polite">
        <p className="edition-title">{title}</p>
        <p className="edition-line">{line}</p>
        {call && <p className="edition-call">{watchCallLine(call, shown)}</p>}
        {note ? (
          <p className="edition-note">{agentLine(note)}</p>
        ) : !first && step?.venue ? (
          // Where the saved trace holds no line of the agent's for this step, say what it
          // decides rather than invent a reason (plan.md item 3).
          <p className="edition-note">{AGENT_DECIDES}</p>
        ) : null}
        {note && anchorsKey && <p className="edition-note">{ANCHORS_KEY}</p>}
        {switched && <p className="edition-note">{switched}</p>}
      </div>
      <span
        className="ticks"
        role="img"
        aria-label={watchTicksLabel(calls, shown)}
      >
        {Array.from({ length: shown }, (_, i) => (
          <i key={i} className={i < calls ? "lit" : ""} />
        ))}
      </span>
    </div>
  );
}

/** A venue the town stands, picked from its sign: its acts on the poster and its switch. */
function VenueCard({
  venue,
  hue,
  lifted,
  off,
  acts,
  read,
  placesListed,
  city,
  kind,
  switchable,
  onToggle,
  onAct,
  onClose,
}: {
  venue: { entityId: string; name: string };
  hue: number | null;
  lifted: number;
  off: boolean;
  acts: readonly Act[];
  /** The fee ranges its fans were read for. */
  read: readonly string[];
  placesListed: number | null;
  city: string;
  kind?: string;
  switchable: boolean;
  onToggle: () => void;
  onAct: (act: Act) => void;
  onClose: () => void;
}) {
  return (
    <section aria-label={venue.name} className="scene-card venue-card">
      <p className="venue-card-name">
        <span
          className={`venue-card-swatch ${hue !== null && !off && lifted > 0 ? `venue-${hue}` : ""}`}
          aria-hidden
        />
        {signName(venue.name)}
      </p>
      <p className="venue-card-line">{venueLine(venue.name, lifted, off)}</p>
      {kind && (
        <p className="venue-card-note">
          {venue.name} is {kind}, not a club.
        </p>
      )}
      <p className="venue-card-note">
        {placesListed !== null
          ? `The AI agent chose it from the ${placesListed} live-music venues Qloo found in ${city}`
          : "The AI agent chose it"}
        {read.length > 0
          ? `; its fans were read for ${read.join(" and ")}.`
          : "."}
      </p>
      {acts.length > 0 && !off && (
        <ul aria-label="Acts its fans lifted" className="venue-card-acts">
          {acts.map((act) => (
            <li key={act.entityId}>
              <button
                type="button"
                className={`poster-act-mini ${hue !== null ? `venue-${hue}` : ""}`}
                onClick={() => onAct(act)}
              >
                {act.name}
                <span className="poster-climb" aria-hidden>
                  {climbMark(act)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="scene-card-buttons">
        {switchable && (
          <button
            type="button"
            className="scene-switch"
            aria-pressed={!off}
            onClick={onToggle}
          >
            <span
              className={`scene-switch-track ${off ? "" : "is-on"}`}
              aria-hidden
            >
              <span />
            </span>
            {signName(venue.name)}&apos;s fans {off ? "off" : "on"}
          </button>
        )}
        <button type="button" className="scene-close" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
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
  /** Towns with a saved build of the same brief, for the town picker; Boise alone hides it. */
  towns?: readonly string[];
  /**
   * A judge's own brief (M6f): the agent runs live for it as soon as the screen opens. There is
   * no Without Qloo, refill, venue switch or town picker, and nothing is saved.
   */
  custom?: {
    brief: YourBrief;
    onEdit: () => void;
    /** A checked town picked from a thin town's state (M6n). */
    onPick?: (town: CheckedTown) => void;
  };
  /**
   * A checked town from Your festival (M6m): its saved build replays as soon as the screen
   * opens, with the live run next to it; there's no town picker, and a way back to the towns.
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
  const wide = useWide();
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
  const switcher = useVenueSwitch(
    festival.id,
    switchBuild,
    !custom,
    firstBill?.venueSwitch,
  );
  // What the server read at first paint belongs to that build only.
  const onFirst = firstBill !== null && switchBuild === firstBill.build.id;
  // Whether a saved build has been on this screen (the first paint's or a replay): a live run
  // after one is kept for whoever ran it, never as the build other visitors open on.
  const [savedSeen, setSavedSeen] = useState(state.build?.replayed === true);
  if (!savedSeen && state.build?.replayed === true) setSavedSeen(true);
  const [mode, setMode] = useState<Mode>("qloo");
  // Watch on a saved build replays it; a fresh run is the agent planning live. The build event
  // settles it; until then, what was asked for.
  const [replaying, setReplaying] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  // The venue picked from its sign in the town, or from the poster's key.
  const [pickedVenue, setPickedVenue] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [printing, setPrinting] = useState<Printing>(null);
  const board = useRef<HTMLElement>(null);

  const watching = watch.phase === "calls" || watch.phase === "climbing";
  const whatIf = switcher.lineup !== null;
  const without = mode === "llm";

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

  // The town stands its venues strongest first, the first in front: by the acts each lifted on
  // the saved lineup, then in the order the agent read them (src/lib/venue-colours.ts's order).
  const savedLifted = (id: string) =>
    savedActs.filter((act) => act.anchorVenue.entityId === id).length;
  const standing = allVenues
    .map((venue, index) => ({
      venue,
      index,
      lifted: savedLifted(venue.entityId),
    }))
    .sort((a, b) => b.lifted - a.lifted || a.index - b.index)
    .map(({ venue }) => venue);
  // The venues Watch has read so far, from the steps it has shown.
  const read = new Set(
    watch.seen.flatMap((step) => (step.venue ? [step.venue.entityId] : [])),
  );
  // A ring goes out from a venue each time Watch reads it and each time it's picked.
  const pulses = useMemo(() => {
    const counts: Record<string, number> = { ...picks };
    for (const entry of watch.seen)
      if (entry.venue)
        counts[entry.venue.entityId] = (counts[entry.venue.entityId] ?? 0) + 1;
    return counts;
  }, [picks, watch.seen]);
  const sceneVenues: SceneVenue[] = standing.map((venue) => {
    const line = venueLines.find((entry) => entry.entityId === venue.entityId);
    const lifted = watching ? savedLifted(venue.entityId) : (line?.lifted ?? 0);
    const off = !watching && switcher.off.has(venue.entityId);
    return {
      entityId: venue.entityId,
      name: venue.name,
      hue: lifted > 0 && !off ? (hues.get(venue.entityId) ?? null) : null,
      lifted,
      off,
      unread: watching && !read.has(venue.entityId),
    };
  });
  const keyVenues: KeyVenue[] = sceneVenues.map((venue) => ({
    entityId: venue.entityId,
    name: venue.name,
    hue: venue.hue,
    lifted: venue.lifted,
    off: venue.off,
  }));

  function startShow(replay: boolean) {
    // Watch shows the agent's build, so it brings the poster back from Without Qloo.
    setMode("qloo");
    setOpenId(null);
    setPickedVenue(null);
    switcher.reset();
    // The lineup prints in down the poster once Watch hands it back (reduced motion: at once).
    setPrinting(watch.reduced ? null : "replay");
    setReplaying(replay);
    watch.start();
    // On a phone the poster sits under the lead: bring the show into view.
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

  // A judge's own run is never saved, and a live run on a saved town never becomes the build other
  // visitors open on, so once either has finished Watch replays the run the screen holds: no
  // request, no live run spent, the draft kept. A judge's run that stopped short offers to run the
  // agent again instead.
  const ownRun =
    state.status === "done" &&
    state.climbs.length > 0 &&
    (custom !== undefined || state.build?.replayed === false);
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
  // and its checked towns take the run button's place.
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
  // Where a live run finishes, it says it isn't the build other visitors open on. An empty
  // board's first build is: the store keeps a festival's first complete build as its latest.
  const liveOnly =
    state.build?.replayed === false && (custom !== undefined || savedSeen);
  // Qloo's image of each act on the saved lineup, while ARTIST_IMAGES is on: on its card.
  const images = firstBill?.images;
  const headlinerIds = useMemo(
    () =>
      new Map(
        (firstBill?.headliners ?? []).map((headliner) => [
          headliner.name,
          headliner.entityId,
        ]),
      ),
    [firstBill],
  );
  // The credit goes wherever Qloo's photos show: the headliners', and the acts' on their cards.
  const creditImages =
    !without && images && Object.keys(images).length > 0
      ? images
      : firstBill?.headlinerImages;

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
    setPickedVenue(null);
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

  function pickVenue(id: string | null) {
    setOpenId(null);
    setPickedVenue(id);
    if (id)
      setPicks((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  }

  function openCard(act: Act) {
    setPickedVenue(null);
    setOpenId((current) => (current === act.entityId ? null : act.entityId));
  }

  // Watch's current step, and the call and the AI agent's line it came with.
  const step = watch.current;
  const call = step ? stepCall(step, state.calls, festival.feeBands) : null;
  const stepHue =
    step?.venue && watch.phase === "climbing"
      ? (hues.get(step.venue.entityId) ?? null)
      : null;
  // The acts this step's venue put on the lineup, once the lineup is in: a replay sends it
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
  const noteAt = call
    ? state.notes.findLastIndex((entry) => entry.at < call.n)
    : state.notes.length - 1;
  const note = state.notes[noteAt]?.text ?? null;
  // The first of the agent's lines that says "Anchors" gets a one-line key under it.
  const anchorsKey =
    noteAt >= 0 &&
    noteAt === state.notes.findIndex((entry) => saysAnchors(entry.text));
  // From the saved build only (WS2): while Watch replays the saved build this page came with,
  // the planner's venue switch, on the steps of the venue it switched to (before the first
  // step, under the line that made the switch), and the venues Qloo had no fan data for.
  const savedBuildOnScreen =
    firstBill !== null &&
    state.build?.replayed === true &&
    state.build.id === firstBill.build.id;
  const savedSwitches = savedBuildOnScreen
    ? (firstBill.agentSwitches ?? [])
    : [];
  const savedNoFanData = savedBuildOnScreen ? (firstBill.noFanData ?? []) : [];
  const noFanDataHere = Boolean(
    step?.venue && savedNoFanData.includes(step.venue.entityId),
  );
  const switched =
    savedSwitches.find((entry) =>
      step?.venue
        ? step.venue.entityId === entry.to.entityId
        : !step && entry.note === noteAt,
    ) ?? null;
  const caption = (where: "town" | "poster") => (
    <WatchCaption
      phase={watch.phase}
      step={step}
      hue={stepHue}
      call={call}
      calls={state.calls.length}
      total={calls ?? 12}
      note={note}
      anchorsKey={anchorsKey}
      switched={switched ? switchLine(switched, savedNoFanData) : null}
      noFanData={noFanDataHere}
      lifted={liftedHere}
      headliners={festival.headliners}
      replayed={replaying || state.build?.replayed === true}
      where={where}
    />
  );

  // While Watch plays, an act holds an open slot until its venue's fans are read, then lands in
  // it at once (under reduced motion with no stamp, as nothing moves there).
  const landedSteps = new Set(
    watch.seen.flatMap((entry) =>
      entry.venue ? [`${entry.band}|${entry.venue.entityId}`] : [],
    ),
  );
  const landed = watching
    ? (act: Act) => landedSteps.has(`${act.band}|${act.anchorVenue.entityId}`)
    : undefined;
  // On a laptop with motion on, the acts the venue being read put on the poster fly there from
  // it as Watch reads it, each stamping into its slot as its card lands (the brief's play()).
  const flights: Flight[] =
    watching && wide && !watch.reduced && step?.venue
      ? state.acts
          .filter(
            (act) =>
              act.band === step.band &&
              act.anchorVenue.entityId === step.venue!.entityId,
          )
          .map((act, order) => ({
            key: `${watch.seen.length}-${act.entityId}`,
            act,
            hue: hues.get(act.anchorVenue.entityId) ?? null,
            image: images?.[act.entityId],
            order,
          }))
      : [];
  const stampAt = (act: Act) => {
    const flight = flights.find((entry) => entry.act.entityId === act.entityId);
    return flight ? landsAt(flight.order) : undefined;
  };
  // Hovering the key's switches fades nothing (WS8): only a venue picked does.
  const focusVenue = !watching && !without ? pickedVenue : null;
  const dimmed = focusVenue
    ? (act: Act) => act.anchorVenue.entityId !== focusVenue
    : undefined;

  const openWords = whatIf
    ? "No act from the venues left on clears the bar."
    : state.acts.length === 0
      ? state.status === "building"
        ? "The AI agent is drafting this slot."
        : state.status === "error"
          ? "The AI agent couldn't draft this slot; the note says why."
          : "Empty until the AI agent drafts the lineup."
      : "No act the venues lifted clears the bar.";
  const bandRows = festival.feeBands.map((band) => {
    const open = whatIf
      ? (switcher.lineup?.shortfall[band.id] ?? 0)
      : Math.max(
          0,
          band.slots - shownActs.filter((act) => act.band === band.id).length,
        );
    return {
      band,
      // In the rule's order (WS8): the strongest Qloo match first, then the bigger climb; the
      // open slots after the acts.
      rows: billRows(
        band,
        shownActs,
        placeOf,
        hues,
        open,
        openWords,
        "climb",
      ).sort(
        (a, b) =>
          (b.act?.affinity ?? -1) - (a.act?.affinity ?? -1) ||
          (b.move ?? 0) - (a.move ?? 0),
      ),
    };
  });
  const printedActs = bandRows.flatMap(({ rows }) =>
    rows.flatMap((row) => (row.act ? [row.act] : [])),
  );
  const onVenues = allVenues
    .filter((venue) => !switcher.off.has(venue.entityId))
    .map((venue) => venue.name);
  const offVenues = allVenues
    .filter((venue) => switcher.off.has(venue.entityId))
    .map((venue) => venueShort(venue.name));
  const allOpen = whatIf && shownActs.length === 0;

  const card = (act: Act) => (
    <ActCardPanel
      act={act}
      unavailable={!whatIf && state.unavailable.includes(act.entityId)}
      disabled={state.refilling !== null || state.redrafting || !state.build}
      onUnavailable={custom || whatIf ? undefined : refill}
      kept={!whatIf && state.keeping.includes(act.entityId)}
      onKeep={custom || whatIf ? undefined : toggleKeep}
      onClose={() => setOpenId(null)}
      place={placeOf[act.entityId]}
      image={images?.[act.entityId]}
      hue={hues.get(act.anchorVenue.entityId) ?? null}
      band={festival.feeBands.find((entry) => entry.id === act.band)}
      note={
        whatIf ? "Turn every venue back on to keep or replace acts." : undefined
      }
      // Qloo's split was read for the saved lineup with every venue on (WS7): only there, and
      // only for its own acts (a refill's replacement has none).
      split={
        savedBuildOnScreen && !whatIf
          ? firstBill?.splits?.[act.entityId]
          : undefined
      }
    />
  );
  // On a laptop an act's card opens over the town, beside the poster; on a phone, in the poster.
  const cardInTown = wide && !without && !watching;

  // The poster's example line: the act opened, the venue picked, or the poster's first act.
  const example: {
    tag: string | null;
    hue: number | null;
    text: string;
  } | null = (() => {
    if (without || allOpen) return null;
    if (watching)
      return {
        tag: null,
        hue: null,
        text: "Acts land on your poster as the agent reads each venue's fans.",
      };
    const switchable = !custom && switcher.status === "ready";
    if (openAct) {
      const line = oneActLine(openAct, placeOf[openAct.entityId]);
      if (line)
        return {
          tag: `${venueShort(openAct.anchorVenue.name)} ${climbMark(openAct) ?? ""}`.trim(),
          hue: hues.get(openAct.anchorVenue.entityId) ?? null,
          text: line,
        };
    }
    if (pickedVenue) {
      const venue = sceneVenues.find((entry) => entry.entityId === pickedVenue);
      if (venue)
        return {
          tag:
            venue.lifted > 0 && !venue.off
              ? `${venueShort(venue.name)} ${venue.lifted === 1 ? "1 act" : `${venue.lifted} acts`}`
              : null,
          hue: venue.hue,
          text: venueLine(venue.name, venue.lifted, venue.off),
        };
    }
    // With a venue off, an act the saved poster didn't book says why it's here now.
    const newcomer = whatIf
      ? exampleAct(
          printedActs.filter(
            (act) =>
              !savedActs.some((saved) => saved.entityId === act.entityId),
          ),
          placeOf,
        )
      : null;
    const first = newcomer ?? exampleAct(printedActs, placeOf);
    if (!first) return null;
    const line = oneActLine(first, placeOf[first.entityId]) ?? "";
    return {
      tag: `${venueShort(first.anchorVenue.name)} ${climbMark(first) ?? ""}`.trim(),
      hue: hues.get(first.anchorVenue.entityId) ?? null,
      text: newcomer
        ? `${line} ${MISSED_CUT}`
        : whatIf
          ? line
          : `${line} ${exampleHint(switchable)}`,
    };
  })();

  // Without Qloo: the model's answer and what prompt 4's checks found for it.
  const modelPicks = llm.state.lineup?.picks ?? [];
  const counts =
    llm.state.status === "ready"
      ? withoutCounts(modelPicks, llm.state.checks, festival)
      : null;
  const lead = leadLine(festival, without, counts);
  const legend = legendLine({
    city: festival.city,
    placesListed,
    tested: allVenues.length,
    lifting: sceneVenues.filter((venue) => venue.lifted > 0).length,
    without,
  });
  const onShow = TOWNS.filter((town) => towns.includes(town.slug));
  const current = townOf(festival).slug;
  const anyNew = printedActs.some((act) => climbMark(act) === "NEW");

  const picked = pickedVenue
    ? allVenues.find((venue) => venue.entityId === pickedVenue)
    : null;
  const pickedScene = picked
    ? sceneVenues.find((venue) => venue.entityId === picked.entityId)
    : null;
  const venueCard =
    picked && pickedScene && !watching && !without ? (
      <VenueCard
        venue={picked}
        hue={pickedScene.hue}
        lifted={pickedScene.lifted}
        off={pickedScene.off}
        acts={bookedActs.filter(
          (act) => act.anchorVenue.entityId === picked.entityId,
        )}
        read={festival.feeBands
          .filter((band) =>
            (onFirst ? (firstBill?.anchors[band.id] ?? []) : []).some(
              (venue) => venue.entityId === picked.entityId,
            ),
          )
          .map((band) =>
            band.id === "mid" ? "mid-size acts" : "opening acts",
          )}
        placesListed={placesListed}
        city={festival.city}
        kind={
          venueLines.find((line) => line.entityId === picked.entityId)?.kind
        }
        switchable={!custom && switcher.status === "ready" && !busy}
        onToggle={() => switcher.toggle(picked.entityId)}
        onAct={(act) => openCard(act)}
        onClose={() => setPickedVenue(null)}
      />
    ) : null;

  const withoutBox = without ? withoutNote(festival, counts) : null;
  const sceneOverlay: ReactNode = (
    <>
      {watching && wide && (
        <div className="scene-caption">{caption("town")}</div>
      )}
      {cardInTown && openAct && (
        <div className="scene-panel">{card(openAct)}</div>
      )}
      {wide && !openAct && venueCard && (
        <div className="scene-panel">{venueCard}</div>
      )}
      {withoutBox && (
        <div className="scene-note" role="note" aria-label="Without Qloo">
          <p className="scene-note-title">{withoutBox.title}</p>
          <p className="scene-note-text">{withoutBox.text}</p>
          <button
            type="button"
            className="poster-fix"
            onClick={() => changeMode("qloo")}
          >
            Show it with Qloo
          </button>
        </div>
      )}
    </>
  );

  const watchButton = thinTown ? null : limited ? null : (
    <div className="fs-watch">
      <button
        type="button"
        onClick={() =>
          watching
            ? watch.skip()
            : ownRun
              ? startShow(true)
              : runBuild(runAgain ? { fresh: true } : {})
        }
        disabled={!watching && busy}
        className={`watch ${watching ? "is-skip" : ""}`}
      >
        <span className="watch-play" aria-hidden>
          {watching ? (
            <svg viewBox="0 0 20 20">
              <path d="M2 3 L10 10 L2 17 Z M10 3 L18 10 L10 17 Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20">
              <path d="M4 2v16l14-8z" />
            </svg>
          )}
        </span>
        {watching
          ? SKIP
          : state.status === "building"
            ? "Building…"
            : runAgain
              ? "Run the agent again"
              : state.build
                ? WATCH_AGENT
                : "Build undercard"}
      </button>
      <p className="watch-sub">
        {custom
          ? ownRun
            ? `Replays its ${calls ?? state.calls.length} Qloo calls`
            : runAgain
              ? "Runs the AI agent again; its Qloo calls list below"
              : "Runs the AI agent; its Qloo calls list below"
          : watchSubLine({
              city: festival.city,
              live: !state.build,
              onScreen: savedOnScreen || ownRun,
            })}
      </p>
    </div>
  );

  const withPoster = (
    <>
      <VenueKey
        venues={keyVenues}
        switchable={
          !custom && switcher.status === "ready" && !watching && !busy
        }
        onToggle={(id) => {
          setOpenId(null);
          switcher.toggle(id);
        }}
        quiet={watching}
      />
      {!allOpen && (
        <p className={`poster-rule ${watching ? "is-quiet" : ""}`}>
          {RULE_LINE}
        </p>
      )}
      {watching && !wide && (
        <div className="poster-caption">{caption("poster")}</div>
      )}
      {whatIf && !watching && (
        <p className="whatif" role="status">
          What if {switcher.off.size === 1 ? "that venue's" : "those venues'"}{" "}
          fans weren&apos;t asked? The rule re-formed the lineup from the saved
          build, with no new Qloo call.
          <button
            type="button"
            className="switch-reset"
            onClick={switcher.reset}
          >
            All venues on
          </button>
        </p>
      )}
      {allOpen ? (
        <div role="status" className="poster-open">
          <p>
            <strong>{openPosterLine({ slots, on: onVenues }).head}</strong>{" "}
            {openPosterLine({ slots, on: onVenues }).text}
          </p>
          <button type="button" className="poster-fix" onClick={switcher.reset}>
            Switch every venue back on
          </button>
        </div>
      ) : (
        <div className="poster-bands">
          {bandRows.map(({ band, rows }, column) => {
            const edition = watching ? watch.latest(band.id) : null;
            const empty =
              whatIf &&
              !watching &&
              rows.every((row) => row.kind === "open") &&
              rows.length > 0;
            return (
              <PosterBand
                key={band.id}
                band={band}
                first={column === 0}
                rows={rows}
                top={firstBill?.baselineTop[band.id]}
                openId={openAct?.entityId ?? null}
                keeping={whatIf ? [] : state.keeping}
                unavailable={whatIf ? [] : state.unavailable}
                onOpen={watching ? undefined : openCard}
                printing={printing}
                column={column}
                landed={landed}
                stampAt={stampAt}
                dimmed={dimmed}
                caption={
                  watching
                    ? edition
                      ? edition.venue
                        ? `With ${edition.venue.name}'s fans added`
                        : "For the headliners' fans alone"
                      : "Waiting for this band's first ranking…"
                    : undefined
                }
                message={
                  empty
                    ? (() => {
                        // The venues the saved draft read for these slots (WS8, item 12).
                        const read = onFirst
                          ? (firstBill?.anchors[band.id] ?? [])
                          : [];
                        const line = openBandLine({
                          band,
                          slots: band.slots,
                          read: read.map((venue) => signName(venue.name)),
                          noFanData: read
                            .filter((venue) =>
                              savedNoFanData.includes(venue.entityId),
                            )
                            .map((venue) => signName(venue.name)),
                          off: offVenues,
                        });
                        return {
                          head: line.head,
                          text: line.text,
                          fix: { label: line.fix, onClick: switcher.reset },
                        };
                      })()
                    : undefined
                }
              >
                {cardInTown ? undefined : card}
              </PosterBand>
            );
          })}
        </div>
      )}
      {!wide && venueCard}
      {example && (
        <p className="poster-example">
          {example.tag && (
            <span
              className={`poster-example-tag ${example.hue !== null ? `venue-${example.hue}` : ""}`}
            >
              {example.tag}
            </span>
          )}
          {example.text}
        </p>
      )}
      {!watching && (
        <PosterActions>
          {bookedActs.length > 0 && (
            <button
              type="button"
              className="tool poster-export"
              onClick={exportCsv}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M8 2 V11 M4 7 L8 11 L12 7 M2 14 H14" />
              </svg>
              Export CSV
            </button>
          )}
          {!custom && state.build && (
            <>
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
              {state.keeping.length > 0 && !whatIf && (
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
            </>
          )}
          {!custom && (
            <>
              <Link href="/your-festival" className="tool poster-own">
                Draft your own festival
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M2 8 H13 M9 4 L13 8 L9 12" />
                </svg>
              </Link>
              {/* No prefetch: on a dev server each act card opened re-prefetched the
                  shortlist, and the demo path's card step went from 19 s to 42 s. */}
              <Link href="/shortlist" prefetch={false} className="tool">
                Check the acts you&apos;ve been pitched
              </Link>
            </>
          )}
        </PosterActions>
      )}
      {!without && state.keeping.length > 0 && !whatIf && !watching && (
        <p className="tools-note">
          Redraft the rest keeps {state.keeping.length}{" "}
          {state.keeping.length === 1 ? "act" : "acts"} and refills the other
          slots from the same venues, in at most 3 Qloo calls.
        </p>
      )}
      {/* The running order is planned for the saved lineup: it steps aside while a venue is off. */}
      {!without && !watching && !whatIf && state.order && !openAct && (
        <RunningOrderPanel
          slots={state.order}
          headliners={festival.headliners}
          onClose={closeOrder}
          acts={state.acts}
        />
      )}
      <p className="drafted">
        {calls && state.build?.createdAt
          ? liveOnly
            ? `Drafted from ${calls} Qloo calls the AI agent planned · run live ${savedAt.format(new Date(state.build.createdAt))} UTC, not saved for other visitors`
            : `Drafted from ${calls} Qloo calls the AI agent planned · saved ${savedAt.format(new Date(state.build.createdAt))} UTC`
          : state.status === "building"
            ? "The AI agent is drafting the undercard."
            : "No undercard drafted yet."}
      </p>
    </>
  );

  const withoutPoster = (
    <section
      aria-label="Without Qloo: an AI model's picks alone"
      className="model"
    >
      <p className="poster-chip poster-chip-model">
        Picked by Claude Sonnet 5.5 alone
      </p>
      {(llm.state.status === "loading" || llm.state.status === "idle") && (
        <p className="model-wait" role="status">
          Asking the model, without Qloo…
        </p>
      )}
      {llm.state.status === "error" && (
        <div className="model-wait">
          <p role="alert" className="alert">
            {llm.state.error}
          </p>
          <button
            type="button"
            onClick={() => void llm.load()}
            className="tool mt-2"
          >
            Try again
          </button>
        </div>
      )}
      {counts && withoutHeadline(counts) && (
        <p className="model-headline">{withoutHeadline(counts)}</p>
      )}
      {counts && llm.state.checks && llm.state.checks.length > 0 && (
        <PicksRuler
          festival={festival}
          checks={llm.state.checks}
          counts={counts}
        />
      )}
      {llm.state.lineup && (
        <ModelPicks
          festival={festival}
          picks={modelPicks}
          checks={llm.state.checks}
        />
      )}
      {counts && withoutSummary(festival, counts) && (
        <p className="model-summary">{withoutSummary(festival, counts)}</p>
      )}
      <p className="drafted">
        {llm.state.lineup
          ? `Answered by the model alone, with no tools · saved ${formatSavedAt(llm.state.lineup.createdAt)} UTC`
          : "The model alone, with no tools."}
      </p>
    </section>
  );

  return (
    <div className={`chart-app stage-bg fs ${without ? "is-without" : ""}`}>
      <header className="topbar fs-top">
        <Link
          href="/"
          className="logo fs-word"
          aria-label="Undercard, back to Sagebrush Sound"
        >
          Undercard
        </Link>
        <p className="fs-tagline">
          {TAGLINE_LEAD} {TAGLINE_QLOO}
        </p>
        <nav aria-label="Other screens" className="nav">
          {checked && (
            <button type="button" onClick={checked.onBack}>
              Pick another town
            </button>
          )}
          <Link href="/method">How it works</Link>
          <Link href="/your-festival">Your festival</Link>
        </nav>
      </header>

      <main ref={board} className="fs-main">
        <div
          className={`fs-grid ${
            wide && ((cardInTown && openAct) || (venueCard && !openAct))
              ? "has-panel"
              : ""
          }`}
        >
          <section aria-label="What Undercard does" className="fs-lead">
            <p className="fs-title">{LEAD_TITLE}</p>
            <p className="fs-line">
              <mark>{lead.mark}</mark> {lead.rest}
            </p>
            {/* A town Qloo can't find, or too thin to read: running it again can't help, so its
                notice and the checked towns take the run button's place, under what happened. */}
            {thinTown && notice}
          </section>

          {/* The town picker: under the lead on a laptop; on a phone after the poster, so the first
              act shows before any scroll with Watch (WS8, brief item 22). */}
          {!custom && !checked && onShow.length >= 2 && (
            <nav aria-label="Same brief, other towns" className="fs-towns">
              <span className="fs-towns-label">Pick a town</span>
              <ul>
                {onShow.map((town) => {
                  const code = regionCode(town.festival.region);
                  return (
                    <li key={town.slug}>
                      <Link
                        href={townHref(town.slug)}
                        aria-current={
                          town.slug === current ? "page" : undefined
                        }
                        className="fs-town-chip"
                      >
                        {town.festival.city}
                        {code && (
                          <span className="fs-town-code" aria-hidden>
                            {" "}
                            {code}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link
                href="/your-festival"
                className="fs-town-chip fs-town-yours"
              >
                Your town
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M2 8 H13 M9 4 L13 8 L9 12" />
                </svg>
              </Link>
            </nav>
          )}

          {!thinTown && watchButton}

          <section
            aria-label={without ? "The festival" : "Undercard draft"}
            className={`fs-poster ${watching ? "is-watching" : ""}`}
          >
            {!custom && <ModeTabs mode={mode} onChange={changeMode} />}
            <div className="poster-sheet">
              <p className="poster-stamp">
                <span className="stamp-long">
                  {stampWords(custom !== undefined)}
                </span>
                <span className="stamp-short">
                  {stampWords(custom !== undefined, true)}
                </span>
              </p>
              <h1 className="poster-name">{festival.name}</h1>
              <p className="facts">{factsLine(festival)}</p>
              <span className="poster-rule-line" aria-hidden />
              <p className="poster-booked">{bookedLabel(festival)}</p>
              <HeadlinerList
                headliners={festival.headliners}
                images={firstBill?.headlinerImages}
                ids={headlinerIds}
              />
              <span className="poster-rule-line" aria-hidden />
              {without ? withoutPoster : withPoster}
              {/* Prompt 4's count of each check, on both sides of the tabs. */}
              {!custom && <WithoutQlooChecksLine />}
              <ImageCredit images={creditImages} />
              <p className="poster-foot">
                {footnote(festival, anyNew && !without)}
              </p>
            </div>
          </section>

          <section aria-label="Your town" className="fs-town">
            <p className="fs-legend">
              <strong>{legend.title}.</strong> {legend.text}
            </p>
            <TownScene
              seedKey={festival.id}
              venues={sceneVenues}
              selected={
                !watching && !without
                  ? (openAct?.anchorVenue.entityId ?? pickedVenue)
                  : null
              }
              focusOn={
                watching
                  ? watch.phase === "climbing"
                    ? (step?.venue?.entityId ?? null)
                    : null
                  : without
                    ? null
                    : cardInTown && openAct
                      ? openAct.anchorVenue.entityId
                      : wide
                        ? pickedVenue
                        : null
              }
              onPick={pickVenue}
              without={without}
              dim={watching}
              pulses={pulses}
              overlay={sceneOverlay}
              reserve={
                wide
                  ? {
                      corner: { w: 420, h: 104 },
                      ...(watching ? { top: 150 } : {}),
                      ...((cardInTown && openAct) || (venueCard && !openAct)
                        ? { right: 404 }
                        : {}),
                    }
                  : {}
              }
            />
          </section>
          <FlyingActs flights={flights} />
        </div>

        <div className="fs-below">
          {!thinTown && notice}
          <div className="fs-panels">
            {/* While Watch plays the switch steps aside: the lineup it counts is being re-drawn. */}
            {!without && !custom && !watching && allVenues.length > 0 && (
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
                editable={!watching && !busy && !without}
              />
            )}
            {!without && <RuleKey bands={festival.feeBands} positioning />}
            {!without && (
              <TracePanel
                state={state}
                savedCalls={firstBill?.calls}
                replay={!custom}
                onBuild={runBuild}
                button={false}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
