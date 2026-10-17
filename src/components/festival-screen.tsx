"use client";

import { useState } from "react";
import { ActCardPanel } from "@/components/act-card-panel";
import { DraftBill } from "@/components/draft-bill";
import { FestivalHeader } from "@/components/festival-header";
import { LineupBoard } from "@/components/lineup-board";
import { ModelBill } from "@/components/model-bill";
import { RoomsRail } from "@/components/rooms-rail";
import { TracePanel } from "@/components/trace-panel";
import { useLlmOnly } from "@/components/use-llm-only";
import { useUndercardBuild } from "@/components/use-undercard-build";
import { firstBoard } from "@/lib/build-state";
import { lineupCsv } from "@/lib/csv";
import type { Festival } from "@/lib/festival";
import type { FirstBill } from "@/lib/first-bill";
import { roomsBehind } from "@/lib/rooms";

type Mode = "qloo" | "llm";

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

function LlmOnlyNote() {
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
        answers from what it already knows, so no pick comes from a Boise
        room&apos;s crowd, and with no popularity data no fee band can be
        checked.
      </p>
      <p className="text-label text-muted">
        With Qloo brings back the agent&apos;s bill and its Boise rooms.
      </p>
    </aside>
  );
}

export function FestivalScreen({
  festival,
  firstBill = null,
}: {
  festival: Festival;
  /** The latest saved build, read on the server; null falls back to the empty board. */
  firstBill?: FirstBill | null;
}) {
  const { state, build, markUnavailable } = useUndercardBuild(
    firstBoard(firstBill),
  );
  const llm = useLlmOnly();
  const [mode, setMode] = useState<Mode>("qloo");
  const [openId, setOpenId] = useState<string | null>(null);
  // A refill replaces the act, which closes its card; the replacement prints into the slot.
  const openAct = state.acts.find((act) => act.entityId === openId) ?? null;
  const bookedActs = state.acts.filter(
    (act) => !state.unavailable.includes(act.entityId),
  );
  // The bill once there is a build to show: the saved one, or one streaming in now.
  const onBill = state.build !== null || state.acts.length > 0;
  const calls = state.summary?.calls ?? firstBill?.calls;
  // A replay streams the venue search again; until then, the server read's count.
  const placesListed =
    state.calls.find((call) => call.tool === "find_venues")?.resultCount ??
    firstBill?.placesListed ??
    null;

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
      lineupCsv(bookedActs, festival.feeBands),
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
          <ModeSwitch mode={mode} onChange={changeMode} />
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
        <main className="grid flex-1 grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-6">
          <ModelBill
            festival={festival}
            state={llm.state}
            onRetry={() => void llm.load()}
          />
          <LlmOnlyNote />
        </main>
      ) : onBill ? (
        <main className="grid flex-1 grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-6">
          <DraftBill
            festival={festival}
            acts={state.acts}
            calls={calls}
            createdAt={state.build?.createdAt}
            top={firstBill?.baselineTop}
            unavailable={state.unavailable}
            openId={openAct?.entityId ?? null}
            onOpen={(act) => setOpenId(act.entityId)}
          />
          <div className="flex flex-col gap-4">
            {!openAct && (
              <RoomsRail
                rooms={roomsBehind(
                  state.acts,
                  firstBill?.anchors ?? {},
                  state.unavailable,
                )}
                bands={festival.feeBands}
                placesListed={placesListed}
              />
            )}
            {openAct && (
              <ActCardPanel
                act={openAct}
                unavailable={state.unavailable.includes(openAct.entityId)}
                disabled={state.refilling !== null || !state.build}
                onUnavailable={markUnavailable}
                onClose={() => setOpenId(null)}
              />
            )}
            <TracePanel
              state={state}
              savedCalls={firstBill?.calls}
              onBuild={build}
            />
          </div>
        </main>
      ) : (
        <main className="grid flex-1 grid-cols-1 content-start gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
          <FestivalHeader festival={festival} />
          <div className="lg:row-span-2">
            <TracePanel state={state} onBuild={build} />
          </div>
          <section aria-label="Lineup board">
            <LineupBoard
              bands={festival.feeBands}
              acts={state.acts}
              unavailable={state.unavailable}
              refilling={state.refilling}
              onUnavailable={state.build ? markUnavailable : undefined}
            />
          </section>
        </main>
      )}
    </div>
  );
}
