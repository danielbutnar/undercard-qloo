"use client";

import { Jost } from "next/font/google";
import Link from "next/link";
import { Fragment, type CSSProperties } from "react";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { Festival } from "@/lib/festival";
import type { LabBill } from "@/lib/lab";
import type { Act } from "@/lib/lineup";
import { roomsBehind, type RoomLine } from "@/lib/rooms";
import { noteBefore, stepCall } from "../_kit/climb-rows";
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
} from "../_kit/copy";
import { useLabBuild } from "../_kit/use-lab-build";
import "./marquee.css";

const face = Jost({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--marquee-face",
});

const FRAMES = [
  { frame: "var(--frame-a)", ink: "var(--on-wall)" },
  { frame: "var(--frame-b)", ink: "var(--letter)" },
  { frame: "var(--frame-c)", ink: "var(--on-wall)" },
];

/** Changeable letters: placed one at a time when a club's fans are tested. */
function Letters({
  text,
  className,
  placed,
  start = 0,
}: {
  text: string;
  className: string;
  placed: boolean;
  start?: number;
}) {
  const words = text.split(" ");
  const firsts = words.map(
    (_, index) => words.slice(0, index).join(" ").length + (index ? 1 : 0),
  );
  return (
    <span className={`letters ${className}`}>
      <span className="sr-only">{text}</span>
      {words.map((word, wordIndex) => (
        <Fragment key={wordIndex}>
          <span className="word" aria-hidden>
            {word.split("").map((char, index) => (
              <span
                key={index}
                className={`letter ${placed ? "placed" : ""}`}
                style={
                  placed
                    ? {
                        animationDelay: `${(start + (firsts[wordIndex] + index) * 0.028).toFixed(3)}s`,
                      }
                    : undefined
                }
              >
                {char}
              </span>
            ))}
          </span>
          {wordIndex < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}

function ClubAct({
  act,
  placed,
  order,
  top,
}: {
  act: Act;
  placed: boolean;
  order: number;
  top?: number;
}) {
  const climb = climbWords(act, top);
  return (
    <li className="clubAct">
      <Letters
        text={act.name}
        className="actLetters"
        placed={placed}
        start={order * 0.18}
      />
      <p className="actWhy">
        {venueLine(act)}
        {climb && (
          <>
            {" · "}
            <strong>{climb.badge}</strong> {climb.words}
          </>
        )}
        {" · "}
        {act.band === "mid" ? "mid-size act" : "opening act"}
      </p>
    </li>
  );
}

export function MarqueeScreen({
  festival,
  bill,
}: {
  festival: Festival;
  bill: LabBill | null;
}) {
  const { state, phase, watch, skip, seen, current } = useLabBuild(
    bill?.first ?? null,
    festival.id,
  );
  const acts = state.acts;
  const running = phase === "building" || phase === "climbing";
  const rooms = roomsBehind(
    acts,
    bill?.first.anchors ?? {},
    state.unavailable,
  ).filter((room) => room.bands.length > 0);
  const placed = new Set(
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
  const testing = current?.venue?.entityId ?? null;
  const tested = new Set(
    seen.flatMap((step) => (step.venue ? [step.venue.entityId] : [])),
  );
  const call = current
    ? stepCall(current, state.calls, festival.feeBands)
    : state.calls.at(-1);
  const note = call ? noteBefore(call.n, state.notes) : null;
  const calls = state.summary?.calls ?? bill?.first.calls;
  const filled = (band: string) =>
    acts.filter((act) => act.band === band && placed.has(act.entityId)).length;

  const club = (room: RoomLine, index: number) => {
    const { frame, ink } = FRAMES[index % FRAMES.length];
    const clubActs = acts.filter(
      (act) => act.anchorVenue.entityId === room.venue.entityId,
    );
    const shown = clubActs.filter((act) => placed.has(act.entityId));
    const isTesting = testing === room.venue.entityId;
    const silent =
      running && tested.has(room.venue.entityId) && shown.length === 0;
    return (
      <article
        key={room.venue.entityId}
        className={`club ${index === 0 && clubActs.length >= 5 ? "wide" : ""} ${isTesting ? "testing" : ""} ${shown.length === 0 && !isTesting ? "dark" : ""}`}
        style={{ "--frame": frame, "--sign-ink": ink } as CSSProperties}
        aria-label={room.venue.name}
      >
        <h2 className="sign">{room.venue.name}</h2>
        <div className="box">
          <span className="bulbs" aria-hidden />
          <p className="boxHead">
            <span>
              {isTesting ? "Its fans are being added now" : "Its fans like"}
            </span>
            <span>{shown.length > 0 ? `${shown.length} on the bill` : ""}</span>
          </p>
          {shown.length > 0 ? (
            <ol className="clubActs">
              {shown.map((act, order) => (
                <ClubAct
                  key={act.entityId}
                  act={act}
                  placed={running}
                  order={order}
                  top={bill?.first.baselineTop[act.band]}
                />
              ))}
            </ol>
          ) : (
            <p className="none">
              {isTesting || silent || !running
                ? `No act climbed ${MIN_LIFT} places`
                : "Not tested yet"}
            </p>
          )}
        </div>
        <p className="tested">
          {running && !tested.has(room.venue.entityId) ? (
            "Waiting for its turn"
          ) : (
            <>
              <strong>{running ? shown.length : room.lifted}</strong>{" "}
              {liftedWords(running ? shown.length : room.lifted)}
            </>
          )}{" "}
          · tested for{" "}
          {festival.feeBands
            .filter((band) => room.bands.includes(band.id))
            .map((band) => band.label)
            .join(" and ")}
        </p>
      </article>
    );
  };

  return (
    <div className={`lab-marquee ${face.variable}`} data-lab-phase={phase}>
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

      <main className="street">
        <section className="festival" aria-label="Undercard draft">
          <div className="box">
            <span className="bulbs" aria-hidden />
            <h1>
              <Letters
                text={festival.name}
                className="festName"
                placed={false}
              />
            </h1>
            <p>
              <Letters
                text={festival.headliners.join(" · ")}
                className="festHeads"
                placed={false}
              />
            </p>
            <p className="festLine">
              Headliners, booked · {factsLine(festival)}{" "}
              <span className="stamp">{STAMP}</span>
            </p>
            <p className="slots">
              {festival.feeBands.map((band) => (
                <span key={band.id}>
                  {PLAIN_BAND[band.id]}: {filled(band.id)} of {band.slots} slots
                </span>
              ))}
            </p>
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
            <p className="now" aria-live="polite">
              {current
                ? `${PLAIN_BAND[current.band]}: ${stepLine(current.venue)}${call ? ` · Qloo call ${call.n} of ${state.calls.length}` : ""}`
                : running
                  ? "Replaying the saved build: no new Qloo or Claude calls."
                  : ""}
            </p>
            {current && note && <p className="note">The AI agent: {note}</p>}
            {current && (
              <button type="button" className="textLink" onClick={skip}>
                {SKIP}
              </button>
            )}
            {!running && <p className="note">{BILL_LINE}</p>}
          </div>
        </section>

        <section
          className="clubs"
          aria-label={`${festival.city} venues whose fans shaped this lineup`}
        >
          {rooms.map(club)}
        </section>
      </main>

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
        <p className="fee">{draftedLine(calls, state.build?.createdAt)}</p>
        {festival.feeBands.map((band) => (
          <p key={band.id} className="fee">
            {PLAIN_BAND[band.id]}: {feeRangeLine(band)}
          </p>
        ))}
        <p className="fee">
          {venuesNote(
            bill?.first.placesListed ?? null,
            rooms.length,
            festival.city,
          )}
        </p>
      </footer>
    </div>
  );
}
