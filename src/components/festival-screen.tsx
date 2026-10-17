"use client";

import { useState } from "react";
import { FestivalHeader } from "@/components/festival-header";
import { LineupBoard } from "@/components/lineup-board";
import { LlmOnlyBoard } from "@/components/llm-only-board";
import { Poster } from "@/components/poster";
import { TracePanel } from "@/components/trace-panel";
import { useLlmOnly } from "@/components/use-llm-only";
import { useUndercardBuild } from "@/components/use-undercard-build";
import { firstBoard } from "@/lib/build-state";
import { lineupCsv } from "@/lib/csv";
import type { Festival } from "@/lib/festival";
import type { FirstBill } from "@/lib/first-bill";

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
  const options: { value: Mode; label: string }[] = [
    { value: "qloo", label: "Qloo" },
    { value: "llm", label: "LLM only" },
  ];
  return (
    <div
      role="group"
      aria-label="Lineup source"
      className="flex rounded-sm border-2 border-rule"
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
      aria-labelledby="llm-note-title"
      className="flex flex-col gap-2 border-2 border-rule bg-surface p-4"
    >
      <h2
        id="llm-note-title"
        className="font-display text-name font-extrabold uppercase"
      >
        No Qloo calls
      </h2>
      <p className="text-label">
        LLM only sends the same brief to Claude Sonnet 5.5 with no tools.
        Without Qloo there is no affinity, no popularity to map to a fee band
        and no local link.
      </p>
      <p className="text-label text-muted">
        Flip back to Qloo for the agent&apos;s board.
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
  const [view, setView] = useState<"board" | "poster">("board");
  const bookedActs = state.acts.filter(
    (act) => !state.unavailable.includes(act.entityId),
  );
  const posterReady = mode === "qloo" && bookedActs.length > 0;

  function changeMode(next: Mode) {
    setMode(next);
    if (next === "llm") {
      setView("board");
      if (llm.state.status === "idle" || llm.state.status === "error")
        void llm.load();
    }
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
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-rule px-4 py-2 lg:px-6">
        <p className="font-display text-name font-extrabold uppercase">
          Undercard
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ModeSwitch mode={mode} onChange={changeMode} />
          <button
            type="button"
            disabled={!posterReady}
            aria-pressed={view === "poster"}
            onClick={() => setView(view === "poster" ? "board" : "poster")}
            className="rounded-sm border-2 border-rule px-3 py-1 text-label font-semibold aria-pressed:bg-ink aria-pressed:text-surface disabled:cursor-not-allowed disabled:border-muted disabled:text-muted"
          >
            Poster
          </button>
        </div>
      </div>
      {view === "poster" && posterReady ? (
        <main className="px-4 py-4 lg:px-6">
          <Poster
            festival={festival}
            acts={bookedActs}
            onBack={() => setView("board")}
            onExport={exportCsv}
          />
        </main>
      ) : (
        <main className="grid flex-1 grid-cols-1 content-start gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
          <FestivalHeader
            festival={festival}
            compact={state.status !== "idle" || mode === "llm"}
          />
          {mode === "qloo" ? (
            <TracePanel state={state} onBuild={build} />
          ) : (
            <LlmOnlyNote />
          )}
          <section
            aria-label="Lineup board"
            className="lg:col-start-1 lg:row-start-2"
          >
            {mode === "qloo" ? (
              <LineupBoard
                bands={festival.feeBands}
                acts={state.acts}
                unavailable={state.unavailable}
                refilling={state.refilling}
                onUnavailable={state.build ? markUnavailable : undefined}
              />
            ) : (
              <LlmOnlyBoard state={llm.state} />
            )}
          </section>
        </main>
      )}
    </div>
  );
}
