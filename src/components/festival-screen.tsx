"use client";

import { FestivalHeader } from "@/components/festival-header";
import { LineupBoard } from "@/components/lineup-board";
import { PresaleSparkline } from "@/components/presale-sparkline";
import { TracePanel } from "@/components/trace-panel";
import { useUndercardBuild } from "@/components/use-undercard-build";
import type { Festival } from "@/lib/festival";

export function FestivalScreen({ festival }: { festival: Festival }) {
  const { state, build } = useUndercardBuild();
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 border-b-2 border-rule px-4 py-2 lg:px-6">
        <p className="font-display text-name font-extrabold uppercase">
          Undercard
        </p>
        <p className="text-label">Taste data from Qloo</p>
      </div>
      <main className="grid flex-1 grid-cols-1 content-start gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6">
        <FestivalHeader festival={festival} compact={state.status !== "idle"} />
        <PresaleSparkline
          presale={festival.presale}
          capacity={festival.capacity}
        />
        <TracePanel state={state} onBuild={build} />
        <section
          aria-label="Lineup board"
          className="lg:col-start-1 lg:row-start-2"
        >
          <LineupBoard bands={festival.feeBands} acts={state.acts} />
        </section>
      </main>
    </div>
  );
}
