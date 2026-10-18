"use client";

import { Archivo } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { FeeBand } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { LabBill, LabPlace } from "@/lib/lab";
import type { ClimbEvent } from "@/lib/lift-climb";
import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import { roomsBehind } from "@/lib/rooms";
import { climbRows, noteBefore, stepCall } from "../_kit/climb-rows";
import {
  BILL_LINE,
  FIRST_LINE_REST,
  PLAIN_BAND,
  SECONDARY,
  SKIP,
  STAMP,
  WATCH,
  WATCH_NOTE,
  climbWords,
  draftedLine,
  exampleLine,
  factsLine,
  feeRangeLine,
  liftedWords,
  ordinal,
  stepLine,
  venueLine,
  venuesNote,
  venuesTitle,
} from "../_kit/copy";
import { useFlip } from "../_kit/use-flip";
import { useLabBuild } from "../_kit/use-lab-build";
import "./chart.css";

const face = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--chart-face",
});

/** One chart line: an act on the bill, or, while a venue's re-sort plays, any act it lists. */
interface Row {
  id: string;
  name: string;
  place: number | null;
  move: number | null;
  was: number | null;
  fresh: boolean;
  onBill: boolean;
  deep: boolean;
  act: Act | null;
}

// Biggest climbers first, then the new entries.
const strength = (row: Row) => row.move ?? (row.fresh ? 0 : -1);

function billRows(
  acts: readonly Act[],
  band: FeeBand,
  places: Record<string, LabPlace>,
): Row[] {
  return acts
    .filter((act) => act.band === band.id)
    .map((act) => {
      const lift = liftOf(act);
      const place = places[act.entityId];
      return {
        id: act.entityId,
        name: act.name,
        place: place?.now ?? null,
        move: lift?.kind === "up" ? lift.places : null,
        was: place?.was ?? null,
        fresh: lift?.kind === "new",
        onBill: true,
        deep: false,
        act,
      };
    })
    .sort((a, b) => strength(b) - strength(a));
}

function stepRows(
  step: ClimbEvent,
  acts: readonly Act[],
  places: Record<string, LabPlace>,
): Row[] {
  const byId = new Map(acts.map((act) => [act.entityId, act]));
  return climbRows(step, acts, places).map((row) => ({
    id: row.entityId,
    name: row.name,
    place: row.place,
    move: row.move,
    was: row.was,
    fresh: row.fresh,
    onBill: row.onBill,
    deep: row.deep,
    act: row.onBill ? (byId.get(row.entityId) ?? null) : null,
  }));
}

function Up() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden>
      <path d="M5 .8 9.6 9.2H.4Z" />
    </svg>
  );
}

function Move({ row, was = false }: { row: Row; was?: boolean }) {
  if (row.fresh) return <span className="fresh">new</span>;
  if (row.move !== null)
    return (
      <span className="moveCell">
        <span className="move" aria-label={`up ${row.move} places`}>
          <Up />
          {row.move}
        </span>
        {was && row.was !== null && (
          <span className="was">was {ordinal(row.was)}</span>
        )}
      </span>
    );
  return (
    <span className="still" aria-hidden>
      –
    </span>
  );
}

function ChartColumn({
  band,
  rows,
  step,
  top,
  motion,
  onSkip,
  children,
}: {
  band: FeeBand;
  rows: Row[];
  /** The venue's re-sort on screen, or null for the bill. */
  step: ClimbEvent | null;
  top?: number;
  motion: boolean;
  onSkip: () => void;
  children?: ReactNode;
}) {
  const flip = useFlip<HTMLLIElement>(step ?? "bill", motion);
  const climbing = step !== null;
  const stuck = step?.venue && !rows.some((row) => row.move !== null);
  const firstDeep = rows.findIndex((row) => row.deep);
  return (
    <section className="column" aria-labelledby={`chart-${band.id}`}>
      <div>
        <div className="chartHead">
          <h2 id={`chart-${band.id}`} className="band">
            {PLAIN_BAND[band.id]}
          </h2>
          {climbing ? (
            <button type="button" onClick={onSkip} className="textLink skip">
              {SKIP}
            </button>
          ) : (
            <p className="small">Place in Qloo&apos;s ranking, and the climb</p>
          )}
        </div>
        {climbing && (
          <p className="small" aria-live="polite">
            {stuck
              ? `${stepLine(step.venue)}: no act climbs ${MIN_LIFT} or more places.`
              : stepLine(step.venue)}
          </p>
        )}
      </div>
      <ol className="rows">
        {rows.map((row, index) => (
          <li
            key={row.id}
            ref={flip(row.id)}
            className={[
              "row",
              climbing && "compact",
              climbing && row.onBill && "onBill",
              climbing && !row.onBill && "offBill",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span
              className="place"
              aria-label={
                index === firstDeep ? `Further down: ${row.place}` : undefined
              }
            >
              {row.place ?? "–"}
            </span>
            <Move row={row} was={!climbing} />
            <div className="who">
              <h3 className="name">{row.name}</h3>
              {!climbing && row.act && (
                <p className="genre">
                  {row.act.sharedTags.map((tag) => tag.name).join(" · ")}
                </p>
              )}
            </div>
            <div className="why">
              {!climbing && row.act ? (
                <>
                  <p className="venue">{venueLine(row.act)}</p>
                  <p className="small">
                    {(() => {
                      const words = climbWords(row.act, top);
                      if (!words) return null;
                      return `${words.badge} ${words.words}`;
                    })()}
                  </p>
                </>
              ) : climbing ? (
                <p className="small">
                  {row.was !== null && `was ${ordinal(row.was)}`}
                  {row.onBill && <span className="tag">on the bill</span>}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {!climbing && <p className="small">{feeRangeLine(band)}</p>}
      {children}
    </section>
  );
}

export function ChartScreen({
  festival,
  bill,
}: {
  festival: Festival;
  bill: LabBill | null;
}) {
  const { state, phase, watch, skip, latest, current, reduced } = useLabBuild(
    bill?.first ?? null,
    festival.id,
  );
  const places = bill?.places ?? {};
  const acts = state.acts;
  const running = phase === "building" || phase === "climbing";
  const rooms = roomsBehind(acts, bill?.first.anchors ?? {}, state.unavailable);
  const tested = rooms.filter((room) => room.bands.length > 0).length;
  const most = Math.max(1, ...rooms.map((room) => room.lifted));
  const call = current
    ? stepCall(current, state.calls, festival.feeBands)
    : state.calls.at(-1);
  const note = call ? noteBefore(call.n, state.notes) : null;
  const calls = state.summary?.calls ?? bill?.first.calls;

  return (
    <div className={`lab-chart ${face.variable}`} data-lab-phase={phase}>
      <header className="top">
        <div className="firstLine">
          <p>
            <strong>Undercard</strong> {FIRST_LINE_REST}
          </p>
          <p className="example">{exampleLine(festival)}</p>
        </div>
        <Link href="/method" className="textLink">
          {SECONDARY.method}
        </Link>
      </header>

      <section aria-label="Undercard draft" className="mast">
        <div>
          <p className="facts">{factsLine(festival)}</p>
          <h1 className="festival">{festival.name}</h1>
          <p className="headliners">
            <span className="headLabel">Headliners, booked:</span>
            <span className="headNames">{festival.headliners.join(" · ")}</span>
          </p>
        </div>
        <div className="side">
          <p className="stamp">{STAMP}</p>
          <button
            type="button"
            data-lab-watch
            onClick={watch}
            disabled={running}
            className="watch"
          >
            {running ? "Building…" : WATCH}
            <svg viewBox="0 0 10 10" aria-hidden>
              <path d="M2 .8 9.4 5 2 9.2Z" />
            </svg>
          </button>
          <p className="watchNote">{WATCH_NOTE}</p>
        </div>
      </section>

      <p className="ticker" aria-live="polite">
        {running && call ? (
          <>
            <span>
              Qloo call {call.n} of {state.calls.length}: {call.summary}
              {call.resultCount !== null
                ? ` · ${call.resultCount} results`
                : ""}
            </span>
            {note && <span className="tickerNote">The AI agent: {note}</span>}
          </>
        ) : running ? (
          <span>Replaying the saved build: no new Qloo or Claude calls.</span>
        ) : (
          <span>{draftedLine(calls, state.build?.createdAt)}</span>
        )}
      </p>

      <p className="bill">{BILL_LINE}</p>

      <div className="charts">
        {festival.feeBands.map((band) => {
          const step = running ? latest(band.id) : null;
          return (
            <ChartColumn
              key={band.id}
              band={band}
              rows={
                step
                  ? stepRows(step, acts, places)
                  : billRows(acts, band, places)
              }
              step={step}
              top={bill?.first.baselineTop[band.id]}
              motion={!reduced}
              onSkip={skip}
            >
              {band.id === festival.feeBands[0].id &&
                !running &&
                rooms.length > 0 && (
                  <aside className="venues" aria-labelledby="venues-title">
                    <h2 id="venues-title" className="venuesTitle">
                      {venuesTitle(festival.city)}
                    </h2>
                    <ul className="venueRows">
                      {rooms.map((room) => (
                        <li key={room.venue.entityId} className="venueRow">
                          <span className="venueName">{room.venue.name}</span>
                          <span className="barTrack" aria-hidden>
                            <span
                              className="bar"
                              style={{
                                display: "block",
                                width: `${(room.lifted / most) * 100}%`,
                              }}
                            />
                          </span>
                          <span>
                            <span className="liftedCount">{room.lifted}</span>{" "}
                            {liftedWords(room.lifted)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="small">
                      {venuesNote(
                        bill?.first.placesListed ?? null,
                        tested,
                        festival.city,
                      )}
                    </p>
                  </aside>
                )}
            </ChartColumn>
          );
        })}
      </div>

      <footer className="tools">
        <div role="group" aria-label="Which bill" className="switch">
          <button type="button" aria-pressed>
            {SECONDARY.withQloo}
          </button>
          <button type="button" aria-pressed={false}>
            {SECONDARY.withoutQloo}
          </button>
        </div>
        <button type="button" className="quiet">
          {SECONDARY.csv}
        </button>
        <button type="button" className="quiet">
          {SECONDARY.order}
        </button>
        <Link href="/compare" className="quiet">
          {SECONDARY.compare}
        </Link>
      </footer>
    </div>
  );
}
