"use client";

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
      <h2 className="font-display text-name font-extrabold uppercase">
        The model alone
      </h2>
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

/** Why a judge's own draft couldn't be finished, and the next step (M6f). */
function RunNotice({
  message,
  code,
  onEdit,
}: {
  message: string;
  code: string;
  onEdit: () => void;
}) {
  return (
    <section
      aria-label="This draft couldn't be finished"
      className="flex flex-col gap-2 border-2 border-danger bg-surface p-4"
    >
      <h2 className="font-display text-name font-extrabold uppercase text-danger">
        {code === "limit"
          ? "Today's live runs are used"
          : code === "not-full"
            ? "Some slots stayed open"
            : "This draft couldn't be finished"}
      </h2>
      <p className="text-label">{message}</p>
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
  custom?: { brief: YourBrief; onEdit: () => void };
}) {
  const { state, build, markUnavailable } = useUndercardBuild(
    firstBoard(firstBill),
    festival.id,
    custom?.brief,
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
    state.refillError !== null;

  function runBuild(request: BuildRequest = {}) {
    setPrinting("run");
    // A fresh run may be refused and keep the bill on screen, so only a replay ticks.
    setPrinted(request.fresh || prefersReducedMotion() ? null : new Set());
    void build(request);
  }

  // A judge's own brief runs once, as soon as its screen opens.
  const started = useRef(false);
  useEffect(() => {
    if (!custom || started.current) return;
    started.current = true;
    runBuild({ fresh: true });
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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-rule px-4 py-2 lg:px-6">
        <div className="flex flex-wrap items-baseline gap-x-3.5">
          <p className="font-display text-name font-extrabold uppercase">
            Undercard
          </p>
          <p className="text-label text-muted">
            Booking desk · {festival.name}
          </p>
        </div>
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
      </header>
      {mode === "llm" ? (
        <main className="grid flex-1 grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_336px] lg:px-6">
          <ModelBill
            festival={festival}
            state={llm.state}
            onRetry={() => void llm.load()}
          />
          <LlmOnlyNote city={festival.city} />
        </main>
      ) : (
        <main className="grid flex-1 grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start lg:px-6">
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
                      ? "Watch the agent build it"
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
          <div className="flex flex-col gap-4">
            {custom && state.status !== "building" && state.errorCode && (
              <RunNotice
                message={state.error ?? ""}
                code={state.errorCode}
                onEdit={custom.onEdit}
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
                disabled={state.refilling !== null || !state.build}
                onUnavailable={custom ? undefined : refill}
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
            {!traceInUse && !custom && (
              <TownSwitcher current={townOf(festival).slug} onShow={towns} />
            )}
          </div>
        </main>
      )}
    </div>
  );
}
