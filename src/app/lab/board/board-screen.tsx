"use client";

import {
  Caveat,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Condensed,
} from "next/font/google";
import Link from "next/link";
import type { CSSProperties } from "react";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { Festival } from "@/lib/festival";
import type { LabBill } from "@/lib/lab";
import type { Act } from "@/lib/lineup";
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
  FEE_RANGE_WHY,
  feeRangeShort,
  liftedWords,
  stepLine,
  venueLine,
  venuesNote,
  venuesTitle,
} from "../_kit/copy";
import { useFlip } from "../_kit/use-flip";
import { useLabBuild } from "../_kit/use-lab-build";
import "./board.css";

const marker = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--board-marker",
});
const strip = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--board-strip",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--board-body",
});

const STRIPS = [
  { strip: "var(--strip-a)", ink: "var(--ink)" },
  { strip: "var(--strip-b)", ink: "var(--on-dark)" },
  { strip: "var(--strip-c)", ink: "var(--ink)" },
];

/** Tally marks in marker: four strokes and a fifth across. */
function Tally({ count }: { count: number }) {
  const strokes: string[] = [];
  let x = 4;
  for (let group = 0; group < Math.floor(count / 5); group++) {
    for (let i = 0; i < 4; i++)
      strokes.push(`M${x + i * 7} 4 L${x + i * 7 + 1} 25`);
    strokes.push(`M${x - 4} 21 L${x + 26} 7`);
    x += 40;
  }
  for (let i = 0; i < count % 5; i++)
    strokes.push(`M${x + i * 7} 4 L${x + i * 7 + 1} 25`);
  const width = x + (count % 5) * 7 + 4;
  return (
    <svg viewBox={`0 0 ${width} 28`} width={width} aria-hidden>
      {strokes.map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}

function Slot({
  act,
  look,
  fresh,
  top,
}: {
  act: Act | null;
  look?: { strip: string; ink: string };
  fresh: boolean;
  top?: number;
}) {
  if (!act)
    return (
      <li className="slot empty">
        <span className="strip">Open slot</span>
      </li>
    );
  const climb = climbWords(act, top);
  return (
    <li className="slot">
      <span
        className={`strip ${fresh ? "drop" : ""}`}
        style={
          { "--strip": look?.strip, "--strip-ink": look?.ink } as CSSProperties
        }
      >
        {act.name}
      </span>
      <p className={`note marker ${fresh ? "write" : ""}`}>
        {venueLine(act)}
        {climb && (
          <>
            {", "}
            <span className="up">{climb.badge}</span> {climb.words}
          </>
        )}
      </p>
    </li>
  );
}

export function BoardScreen({
  festival,
  bill,
}: {
  festival: Festival;
  bill: LabBill | null;
}) {
  const { state, phase, watch, skip, seen, current, reduced } = useLabBuild(
    bill?.first ?? null,
    festival.id,
  );
  const places = bill?.places ?? {};
  const acts = state.acts;
  const running = phase === "building" || phase === "climbing";
  const rooms = roomsBehind(acts, bill?.first.anchors ?? {}, state.unavailable);
  const tested = rooms.filter((room) => room.bands.length > 0);
  const lookOf = new Map(
    rooms.map((room, index) => [
      room.venue.entityId,
      STRIPS[index % STRIPS.length],
    ]),
  );
  const onBoard = new Set(
    running
      ? seen.flatMap((step) =>
          acts
            .filter(
              (act) =>
                step.venue &&
                act.band === step.band &&
                act.anchorVenue.entityId === step.venue.entityId,
            )
            .map((act) => act.entityId),
        )
      : acts.map((act) => act.entityId),
  );
  const rows = current ? climbRows(current, acts, places) : [];
  const flip = useFlip<HTMLLIElement>(current ?? "board", !reduced);
  const call = current
    ? stepCall(current, state.calls, festival.feeBands)
    : state.calls.at(-1);
  const note = call ? noteBefore(call.n, state.notes) : null;
  const calls = state.summary?.calls ?? bill?.first.calls;

  return (
    <div
      className={`lab-board ${marker.variable} ${strip.variable} ${body.variable}`}
      data-lab-phase={phase}
    >
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

      <section className="whiteboard" aria-label="Undercard draft">
        <div className="boardHead">
          <h1 className="title marker">{festival.name}</h1>
          <p className="facts">
            {factsLine(festival)} <span className="stamp">{STAMP}</span>
          </p>
          <div className="heads">
            <span className="headLabel marker">Headliners</span>
            {festival.headliners.map((name) => (
              <span key={name} className="strip head">
                {name}
              </span>
            ))}
            <span className="booked marker">booked</span>
          </div>
          <p className="billLine">{BILL_LINE}</p>
        </div>

        <div className="tiers">
          {festival.feeBands.map((band) => {
            const billed = acts.filter((act) => act.band === band.id);
            return (
              <section
                key={band.id}
                className="tier"
                aria-labelledby={`tier-${band.id}`}
              >
                <div className="tierHead">
                  <h2 id={`tier-${band.id}`} className="tierName marker">
                    {PLAIN_BAND[band.id]}
                  </h2>
                  <p className="tierNote">{feeRangeShort(band)}</p>
                </div>
                <ol className="slots" style={{ "--cols": 1 } as CSSProperties}>
                  {billed.map((act) => (
                    <Slot
                      key={act.entityId}
                      act={onBoard.has(act.entityId) ? act : null}
                      look={lookOf.get(act.anchorVenue.entityId)}
                      fresh={running}
                      top={bill?.first.baselineTop[band.id]}
                    />
                  ))}
                </ol>
              </section>
            );
          })}
          <p className="tierNote why">{FEE_RANGE_WHY}</p>
        </div>

        <aside className="side" aria-live="polite">
          <div className="sideWatch">
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
            <p className="small">{WATCH_NOTE}</p>
          </div>
          <div className="sidePanel">
            {current ? (
              <>
                <h2 className="sideTitle marker">
                  {current.venue
                    ? `+ ${current.venue.name} fans`
                    : "Headliners' fans alone"}
                </h2>
                <p className="small">
                  {PLAIN_BAND[current.band]}: {stepLine(current.venue)}
                  {current.venue && !rows.some((row) => row.move !== null)
                    ? `; no act climbs ${MIN_LIFT} or more places.`
                    : "."}
                  {call ? ` Qloo call ${call.n} of ${state.calls.length}.` : ""}
                </p>
                <ol className="list">
                  {rows.map((row) => (
                    <li
                      key={row.entityId}
                      ref={flip(row.entityId)}
                      className="item"
                    >
                      <span className="place">{row.place}</span>
                      <span className="up">
                        {row.fresh
                          ? "new"
                          : row.move !== null
                            ? `+${row.move}`
                            : ""}
                      </span>
                      <span
                        className={`mini ${row.onBill ? "onBill" : ""}`}
                        style={
                          row.onBill && current.venue
                            ? ({
                                "--strip": lookOf.get(current.venue.entityId)
                                  ?.strip,
                                "--strip-ink": lookOf.get(
                                  current.venue.entityId,
                                )?.ink,
                              } as CSSProperties)
                            : undefined
                        }
                      >
                        {row.name}
                      </span>
                    </li>
                  ))}
                </ol>
                {note && <p className="small">The AI agent: {note}</p>}
                <button type="button" className="textLink" onClick={skip}>
                  {SKIP}
                </button>
              </>
            ) : (
              <>
                <h2 className="sideTitle marker">
                  {venuesTitle(festival.city)}
                </h2>
                <ul className="tallies">
                  {tested.map((room) => (
                    <li key={room.venue.entityId} className="tally">
                      <span
                        className="dot"
                        style={
                          {
                            "--strip": lookOf.get(room.venue.entityId)?.strip,
                          } as CSSProperties
                        }
                        aria-hidden
                      />
                      <div>
                        <p className="tallyName">{room.venue.name}</p>
                        <p className="marks">
                          <Tally count={running ? 0 : room.lifted} />
                          {running
                            ? ""
                            : `${room.lifted} ${liftedWords(room.lifted)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="small">
                  {running
                    ? "Replaying the saved build: no new Qloo or Claude calls."
                    : venuesNote(
                        bill?.first.placesListed ?? null,
                        tested.length,
                        festival.city,
                      )}
                </p>
                <p className="small">
                  {draftedLine(calls, state.build?.createdAt)}
                </p>
              </>
            )}
          </div>
        </aside>
      </section>

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
