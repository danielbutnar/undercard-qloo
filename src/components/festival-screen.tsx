"use client";

import {
  checkedTownLabel,
  townsNear,
  type CheckedTown,
} from "@/lib/checked-towns";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { formatCount } from "@/lib/format";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ActCardPanel } from "@/components/act-card-panel";
import { DraftBill, type Printing } from "@/components/draft-bill";
import { ModelBill } from "@/components/model-bill";
import { RoomsRail } from "@/components/rooms-rail";
import { TownSwitcher } from "@/components/town-switcher";
import {
  TracePanel,
  WATCH_BUTTON,
  type BuildRequest,
} from "@/components/trace-panel";
import { useLlmOnly } from "@/components/use-llm-only";
import { useUndercardBuild } from "@/components/use-undercard-build";
import { firstBoard } from "@/lib/build-state";
import { lineupCsv } from "@/lib/csv";
import type { Festival } from "@/lib/festival";
import type { FirstBill } from "@/lib/first-bill";
import type { Act } from "@/lib/lineup";
import { roomsBehind } from "@/lib/rooms";
import { townOf } from "@/lib/towns";
import type { UnavailableReason } from "@/lib/unavailable";
import type { YourBrief } from "@/lib/your-festival";

type Mode = "qloo" | "llm";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The example under the first line (M6q), in words a non-musician follows. The demo's headliners
 * are bands; a judge's own may not be, so theirs are only named.
 */
function exampleLine(festival: Festival): string {
  const [first, second] = festival.headliners;
  const where = festival.region
    ? `${festival.city}, ${festival.region}`
    : festival.city;
  const bands =
    first === SAGEBRUSH_SOUND.headliners[0] &&
    second === SAGEBRUSH_SOUND.headliners[1];
  return `Example: a ${formatCount(festival.capacity)}-person festival in ${where}. Its headliners, ${first} and ${second}, ${bands ? "are bands" : "are already booked"}.`;
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
    { value: "qloo", label: "With Qloo: the agent's bill" },
    { value: "llm", label: "Without Qloo: the model's picks" },
  ];
  return (
    <div
      role="group"
      aria-label="Which bill"
      className="flex flex-wrap rounded-sm border-2 border-rule"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={mode === option.value}
          onClick={() => onChange(option.value)}
          className="px-3 py-1 text-label font-semibold aria-pressed:bg-ink aria-pressed:text-surface"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function LlmOnlyNote({ city }: { city: string }) {
  return (
    <aside
      aria-label="The model alone"
      className="flex flex-col gap-2 self-start border-2 border-rule bg-surface p-4"
    >
      <h2 className="text-body font-bold">The model alone</h2>
      <p className="text-label">
        The same brief went to Claude Sonnet 5.5 with no tools: the festival,
        its city, capacity and crowd, the headliners and the fee bands. It
        answers from what it already knows, so no pick comes from a {city}
        room&apos;s crowd, and with no popularity data no fee band can be
        checked.
      </p>
      <p className="text-label text-muted">
        With Qloo brings back the agent&apos;s bill and its {city} rooms.
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
  // On a phone the notice sits below the open slots; bring it into view once.
  const notice = useRef<HTMLElement>(null);
  useEffect(() => {
    const box = notice.current?.getBoundingClientRect();
    if (box && box.top > window.innerHeight)
      notice.current?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <section
      ref={notice}
      aria-label="This draft couldn't be finished"
      className="flex flex-col gap-2 border-2 border-danger bg-surface p-4"
    >
      <h2 className="font-display text-name font-extrabold uppercase text-danger">
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
                    ? "Too few rooms in this town"
                    : "This draft couldn't be finished"}
      </h2>
      <p className="text-label">{message}</p>
      {near && (
        <>
          <h3 className="mt-1 text-label font-semibold">
            {country
              ? `Try one Undercard has already read in ${country}:`
              : "Try a town Undercard has already read:"}
          </h3>
          <ul aria-label={offerName} className="grid grid-cols-2 gap-2">
            {near.towns.map((town) => (
              <li key={`${town.city}|${town.region}`}>
                <button
                  type="button"
                  onClick={() => onPick?.(town)}
                  aria-label={checkedTownLabel(town)}
                  className="group flex h-full w-full flex-col rounded-sm border-2 border-rule bg-page px-3 py-1.5 text-left hover:bg-ink hover:text-surface"
                >
                  <span className="text-label font-semibold">{town.city}</span>
                  <span className="text-label text-muted group-hover:text-surface">
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
        <Link
          href="/"
          className="self-start text-label font-semibold underline underline-offset-2 hover:text-accent"
        >
          Back to Sagebrush Sound, which replays without a limit
        </Link>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="self-start rounded-sm border-2 border-rule px-3 py-1 text-label font-semibold hover:bg-ink hover:text-surface"
        >
          Change the brief
        </button>
      )}
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
  /** Towns with a saved build of the same brief, for the switcher; Boise alone hides it. */
  towns?: readonly string[];
  /**
   * A judge's own brief (M6f): the agent runs live for it as soon as the screen opens. There is
   * no Without Qloo, refill or town switcher, and nothing is saved.
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
  const { state, build, markUnavailable, toggleKeep, redraft } =
    useUndercardBuild(
      firstBoard(firstBill),
      festival.id,
      custom?.brief,
      checked !== undefined,
    );
  const llm = useLlmOnly(festival.id);
  const [mode, setMode] = useState<Mode>("qloo");
  const [openId, setOpenId] = useState<string | null>(null);
  // A refill replaces the act, which closes its card; the replacement prints into the slot.
  const openAct = state.acts.find((act) => act.entityId === openId) ?? null;
  const bookedActs = state.acts.filter(
    (act) => !state.unavailable.includes(act.entityId),
  );
  const calls = state.summary?.calls ?? firstBill?.calls;
  // A replay streams the venue search again; until then, the server read's count.
  const placesListed =
    state.calls.find((call) => call.tool === "find_venues")?.resultCount ??
    firstBill?.placesListed ??
    null;

  // The motion moment: a replay's acts print in one at a time, and the rooms' counts tick up
  // as each act's print-in starts. Under reduced motion the counts show the end state.
  const [printing, setPrinting] = useState<Printing>(null);
  const [printed, setPrinted] = useState<ReadonlySet<string> | null>(null);
  const rooms = roomsBehind(
    state.acts,
    firstBill?.anchors ?? {},
    state.unavailable,
  ).map((room) =>
    printed
      ? {
          ...room,
          lifted: state.acts.filter(
            (act) =>
              act.anchorVenue.entityId === room.venue.entityId &&
              printed.has(act.entityId) &&
              !state.unavailable.includes(act.entityId),
          ).length,
        }
      : room,
  );

  // While the trace lists calls, streams or reports a problem, the rooms compact so it stays
  // in view.
  const traceInUse =
    state.status !== "idle" ||
    state.calls.length > 0 ||
    state.refusal !== null ||
    state.refilling !== null ||
    state.redrafting ||
    state.refillError !== null;

  function runBuild(request: BuildRequest = {}) {
    setPrinting("run");
    // A fresh run may be refused and keep the bill on screen, so only a replay ticks.
    setPrinted(request.fresh || prefersReducedMotion() ? null : new Set());
    void build(request);
  }

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

  function onPrinted(entityId: string) {
    setPrinted((seen) =>
      seen && !seen.has(entityId) ? new Set(seen).add(entityId) : seen,
    );
  }

  function changeMode(next: Mode) {
    setMode(next);
    if (
      next === "llm" &&
      (llm.state.status === "idle" || llm.state.status === "error")
    )
      void llm.load();
  }

  function exportCsv() {
    downloadText(
      `${festival.id}-undercard.csv`,
      lineupCsv(bookedActs, festival.feeBands, state.replaced),
      "text/csv;charset=utf-8",
    );
  }

  // Below the bill (M6q): the comparison and the export, out of the first line's way.
  const billControls =
    !custom || (mode === "qloo" && bookedActs.length > 0) ? (
      <div className="flex flex-wrap items-center gap-3">
        {!custom && <ModeSwitch mode={mode} onChange={changeMode} />}
        {mode === "qloo" && bookedActs.length > 0 && (
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-sm border-2 border-rule px-3 py-1 text-label font-semibold hover:bg-ink hover:text-surface"
          >
            Export CSV
          </button>
        )}
      </div>
    ) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b-2 border-rule px-4 py-3 lg:px-6">
        <div className="flex max-w-4xl flex-col gap-0.5">
          <p className="text-body">
            <strong className="font-bold">Undercard</strong> helps a music
            festival choose the smaller acts that play before the stars, using
            what the town&apos;s own music fans already like.
          </p>
          <p className="text-label text-muted">{exampleLine(festival)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {checked && (
            <button
              type="button"
              onClick={checked.onBack}
              className="rounded-sm border-2 border-rule px-3 py-1 text-label font-semibold hover:bg-ink hover:text-surface"
            >
              Pick another town
            </button>
          )}
        </div>
      </header>
      {mode === "llm" ? (
        <main className="grid flex-1 grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_336px] lg:px-6">
          <div className="flex min-w-0 flex-col gap-3">
            <ModelBill
              festival={festival}
              state={llm.state}
              onRetry={() => void llm.load()}
            />
            {billControls}
          </div>
          <LlmOnlyNote city={festival.city} />
        </main>
      ) : (
        <main className="grid flex-1 grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start lg:px-6">
          <div className="flex min-w-0 flex-col gap-3">
            <DraftBill
              festival={festival}
              acts={state.acts}
              calls={calls}
              createdAt={state.build?.createdAt}
              top={firstBill?.baselineTop}
              unavailable={state.unavailable}
              openId={openAct?.entityId ?? null}
              onOpen={(act) => setOpenId(act.entityId)}
              printing={printing}
              onPrinted={onPrinted}
              drafting={state.status === "building"}
              keeping={state.keeping}
              redraft={
                !custom && state.keeping.length > 0 ? (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPrinting("refill");
                        setOpenId(null);
                        void redraft();
                      }}
                      disabled={
                        state.status === "building" ||
                        state.refilling !== null ||
                        state.redrafting
                      }
                      className="rounded-sm border-2 border-accent bg-accent px-4 py-1.5 text-body font-bold text-on-accent hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {state.redrafting ? "Redrafting…" : "Redraft the rest"}
                    </button>
                    <p className="text-label text-muted">
                      Keeps {state.keeping.length}{" "}
                      {state.keeping.length === 1 ? "act" : "acts"} and refills
                      the other slots from the same rooms, in at most 3 Qloo
                      calls.
                    </p>
                  </div>
                ) : undefined
              }
              phoneAction={
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => runBuild()}
                    disabled={
                      state.status === "building" || state.refilling !== null
                    }
                    className={WATCH_BUTTON}
                  >
                    {state.status === "building"
                      ? "Building…"
                      : state.build
                        ? "Watch how it picked these acts"
                        : "Build undercard"}
                  </button>
                  <p className="text-label text-muted">
                    {state.build
                      ? "Replays the saved build's Qloo calls; they list under the bill."
                      : "Runs the agent; its Qloo calls list under the bill."}
                  </p>
                </div>
              }
            />
            {billControls}
          </div>
          <div className="flex flex-col gap-4">
            {(custom || checked) &&
              state.status !== "building" &&
              state.errorCode && (
                <RunNotice
                  message={state.error ?? ""}
                  code={state.errorCode}
                  onEdit={custom?.onEdit ?? checked!.onBack}
                  region={custom?.brief.region}
                  onPick={custom?.onPick}
                />
              )}
            {!openAct && rooms.length > 0 && (
              <RoomsRail
                rooms={rooms}
                compact={traceInUse}
                bands={festival.feeBands}
                placesListed={placesListed}
                city={festival.city}
              />
            )}
            {openAct && (
              <ActCardPanel
                act={openAct}
                unavailable={state.unavailable.includes(openAct.entityId)}
                disabled={
                  state.refilling !== null || state.redrafting || !state.build
                }
                onUnavailable={custom ? undefined : refill}
                kept={state.keeping.includes(openAct.entityId)}
                onKeep={custom ? undefined : toggleKeep}
                onClose={() => setOpenId(null)}
                city={festival.city}
              />
            )}
            <TracePanel
              state={state}
              savedCalls={firstBill?.calls}
              onBuild={runBuild}
              buttonOnPhones={false}
            />
            {!traceInUse && !custom && !checked && (
              <TownSwitcher current={townOf(festival).slug} onShow={towns} />
            )}
          </div>
        </main>
      )}
    </div>
  );
}
