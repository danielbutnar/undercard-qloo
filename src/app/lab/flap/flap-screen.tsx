"use client";

import { Oswald, Work_Sans } from "next/font/google";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  feeRangeLine,
  liftedWords,
  stepLine,
  venueLine,
  venuesNote,
  venuesTitle,
} from "../_kit/copy";
import { useLabBuild } from "../_kit/use-lab-build";
import "./flap.css";

const face = Oswald({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--flap-face",
});
const body = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--flap-body",
});

const SPIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const NBSP = " ";

/** One flap: on a new letter it riffles through a few others first, as a split-flap does. */
function FlapChar({
  char,
  delay,
  motion,
}: {
  char: string;
  delay: number;
  motion: boolean;
}) {
  const [shown, setShown] = useState(char);
  const current = useRef(char);
  useEffect(() => {
    if (current.current === char) return;
    const riffles = motion ? 6 : 0;
    let step = 0;
    let tick: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(
      () => {
        tick = setInterval(() => {
          step += 1;
          const next =
            step > riffles
              ? char
              : SPIN[(char.charCodeAt(0) + step * 7 + delay) % SPIN.length];
          current.current = next;
          setShown(next);
          if (step > riffles) clearInterval(tick);
        }, 48);
      },
      motion ? delay : 0,
    );
    return () => {
      clearTimeout(start);
      clearInterval(tick);
    };
  }, [char, delay, motion]);
  return (
    <span className="tile">
      <span key={shown} className="flip anim">
        {shown === " " ? NBSP : shown}
      </span>
    </span>
  );
}

function Tiles({
  text,
  width,
  motion,
}: {
  text: string;
  width: number;
  motion: boolean;
}) {
  const chars = text.slice(0, width).padEnd(width, " ").split("");
  return (
    <span className="tiles" aria-hidden>
      {chars.map((char, index) => (
        <FlapChar key={index} char={char} delay={index * 26} motion={motion} />
      ))}
    </span>
  );
}

/** A whole-text flap, as boards print destinations and remarks on one flap. */
function Unit({
  text,
  className = "",
  children,
}: {
  text: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`unit ${className}`}>
      <span key={text} className="flip anim">
        {children ?? (text || NBSP)}
      </span>
    </span>
  );
}

function BoardRow({
  act,
  slot,
  width,
  motion,
  top,
}: {
  act: Act | null;
  slot: number;
  width: number;
  motion: boolean;
  top?: number;
}) {
  const climb = act ? climbWords(act, top) : null;
  return (
    <li className="row">
      <Unit text={`Slot ${slot}`} />
      <div>
        <Tiles text={act?.name ?? ""} width={width} motion={motion} />
        <Unit text={act?.name ?? ""} className="mobileName" />
        {act && <span className="sr-only">{act.name}</span>}
      </div>
      <Unit text={act ? venueLine(act) : ""} className="wide" />
      <Unit text={climb ? `${climb.badge} ${climb.words}` : ""}>
        {climb ? (
          <>
            <span className="up">{climb.badge}</span>
            {climb.words}
          </>
        ) : (
          NBSP
        )}
      </Unit>
    </li>
  );
}

export function FlapScreen({
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
  const motion = !reduced;
  const rooms = roomsBehind(acts, bill?.first.anchors ?? {}, state.unavailable);
  const tested = rooms.filter((room) => room.bands.length > 0).length;
  const width = Math.min(
    22,
    Math.max(14, ...acts.map((act) => act.name.length)),
  );

  // During the replay a slot shows its act once the venue whose fans lifted it has been tested.
  const arrived = new Set(
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
  const call = current
    ? stepCall(current, state.calls, festival.feeBands)
    : state.calls.at(-1);
  const note = call ? noteBefore(call.n, state.notes) : null;
  const stuck =
    current?.venue &&
    !climbRows(current, acts, places).some((row) => row.move !== null);
  const calls = state.summary?.calls ?? bill?.first.calls;

  return (
    <div
      className={`lab-flap ${face.variable} ${body.variable}`}
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

      <section className="board" aria-label="Undercard draft">
        <div className="boardHead">
          <div>
            <h1 className="title" aria-label={festival.name}>
              {festival.name.split(" ").map((word) => (
                <span key={word} className="word" aria-hidden>
                  {word.split("").map((char, index) => (
                    <span key={index} className="bigTile">
                      {char}
                    </span>
                  ))}
                </span>
              ))}
            </h1>
            <p className="facts">
              {factsLine(festival)} <span className="stamp">{STAMP}</span>
            </p>
            <p className="headliners">
              <span>Headliners, booked: </span>
              {festival.headliners.join(" · ")}
            </p>
            <p className="facts">{BILL_LINE}</p>
          </div>
          <div className="side">
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
        </div>

        <div className="status" aria-live="polite">
          <Unit
            text={
              current
                ? `${PLAIN_BAND[current.band]}: ${stepLine(current.venue)}${stuck ? `; no act climbs ${MIN_LIFT} or more places` : ""}`
                : running
                  ? "Replaying the saved build: no new Qloo or Claude calls"
                  : draftedLine(calls, state.build?.createdAt)
            }
          />
          {current && call && (
            <Unit text={`Qloo call ${call.n} of ${state.calls.length}`} />
          )}
          {current && note && (
            <span className="statusNote">The AI agent: {note}</span>
          )}
          {current && (
            <button type="button" className="textLink" onClick={skip}>
              {SKIP}
            </button>
          )}
        </div>

        {festival.feeBands.map((band) => {
          const billed = acts.filter((act) => act.band === band.id);
          return (
            <section key={band.id} aria-labelledby={`flap-${band.id}`}>
              <div className="bandRow">
                <h2 id={`flap-${band.id}`} className="bandName">
                  {PLAIN_BAND[band.id]}
                </h2>
                <p className="bandNote">{feeRangeLine(band)}</p>
              </div>
              <ol className="rows">
                {billed.map((act, index) => (
                  <BoardRow
                    key={act.entityId}
                    act={arrived.has(act.entityId) ? act : null}
                    slot={index + 1}
                    width={width}
                    motion={motion}
                    top={bill?.first.baselineTop[band.id]}
                  />
                ))}
              </ol>
            </section>
          );
        })}
      </section>

      <footer className="below">
        <div>
          <div className="venues">
            <h2>{venuesTitle(festival.city)}:</h2>
            {rooms.map((room) => (
              <span key={room.venue.entityId}>
                {room.venue.name} <strong>{room.lifted}</strong>{" "}
                {liftedWords(room.lifted)}
              </span>
            ))}
          </div>
          <p className="small">
            {venuesNote(
              bill?.first.placesListed ?? null,
              tested,
              festival.city,
            )}
          </p>
        </div>
        <div className="tools">
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
        </div>
      </footer>
    </div>
  );
}
