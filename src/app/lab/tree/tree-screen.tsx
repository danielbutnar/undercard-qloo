"use client";

import { Kalam, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import type { CSSProperties } from "react";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { FeeBand, FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { LabBill } from "@/lib/lab";
import type { Act, Venue } from "@/lib/lineup";
import { roomsBehind } from "@/lib/rooms";
import { noteBefore, stepCall } from "../_kit/climb-rows";
import {
  BILL_LINE,
  FEE_RANGE_WHY,
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
  feeRangeShort,
  liftedWords,
  stepLine,
  venueLine,
  venuesNote,
} from "../_kit/copy";
import { useLabBuild } from "../_kit/use-lab-build";
import "./tree.css";

const hand = Kalam({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--tree-hand",
});
const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--tree-body",
});

// Tints follow how much each venue lifted; a venue that lifted none stays grey.
const TINTS = ["var(--tint-a)", "var(--tint-b)"];

/** The venues in the order the build ran them (its anchors, band by band). */
function runOrder(
  anchors: Partial<Record<FeeBandId, Venue[]>>,
  bands: readonly FeeBand[],
) {
  const seen = new Map<string, Venue>();
  for (const band of bands)
    for (const venue of anchors[band.id] ?? [])
      if (!seen.has(venue.entityId)) seen.set(venue.entityId, venue);
  return [...seen.values()];
}

/** A line in the tree, placed in percent of the row and drawn by growing from one end. */
function Line({
  x,
  x2,
  y,
  height = 0,
  on,
  dead = false,
}: {
  x: number;
  x2?: number;
  y: number;
  height?: number;
  on: boolean;
  dead?: boolean;
}) {
  const horizontal = x2 !== undefined;
  const style: CSSProperties = horizontal
    ? { left: `${Math.min(x, x2)}%`, width: `${Math.abs(x2 - x)}%`, top: y }
    : { left: `calc(${x}% - 1px)`, top: y, height };
  return (
    <span
      aria-hidden
      className={`link ${horizontal ? "h" : "v"} ${on ? "" : "off"} ${dead ? "dead" : ""}`}
      style={style}
    />
  );
}

function ActLine({
  act,
  enter,
  top,
}: {
  act: Act;
  enter: boolean;
  top?: number;
}) {
  const climb = climbWords(act, top);
  return (
    <li className={`act ${enter ? "enter" : ""}`}>
      <p className="actName hand">{act.name}</p>
      <p className="actWhy">
        {climb && (
          <>
            <span className="up">{climb.badge}</span> {climb.words} ·{" "}
          </>
        )}
        {act.band === "mid" ? "mid-size act" : "opening act"}
      </p>
      <p className="actWhy">{venueLine(act)}</p>
    </li>
  );
}

export function TreeScreen({
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
  const anchors = bill?.first.anchors ?? {};
  const venues = runOrder(anchors, festival.feeBands);
  const rooms = roomsBehind(acts, anchors, state.unavailable);
  const liftedBy = new Map(
    rooms.map((room) => [room.venue.entityId, room.lifted]),
  );
  const tintOf = new Map(
    rooms.map((room, index) => [
      room.venue.entityId,
      room.lifted > 0 ? TINTS[index % TINTS.length] : "var(--tint-c)",
    ]),
  );
  const actsOf = (venue: Venue) =>
    acts.filter((act) => act.anchorVenue.entityId === venue.entityId);
  const weights = venues.map((venue) => (actsOf(venue).length >= 5 ? 2.2 : 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const centers = weights.map(
    (weight, index) =>
      ((weights.slice(0, index).reduce((sum, w) => sum + w, 0) + weight / 2) /
        total) *
      100,
  );
  const tested = new Set(
    seen.flatMap((step) => (step.venue ? [step.venue.entityId] : [])),
  );
  const shown = new Set(
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
  const rootLit = !running || seen.length > 0;
  const call = current
    ? stepCall(current, state.calls, festival.feeBands)
    : state.calls.at(-1);
  const note = call ? noteBefore(call.n, state.notes) : null;
  const calls = state.summary?.calls ?? bill?.first.calls;
  const feeders = venues
    .map((venue, index) => ({ venue, center: centers[index] }))
    .filter(({ venue }) =>
      actsOf(venue).some((act) => shown.has(act.entityId)),
    );
  const allFeeders = venues
    .map((venue, index) => ({ venue, center: centers[index] }))
    .filter(({ venue }) => actsOf(venue).length > 0);

  return (
    <div
      className={`lab-tree ${hand.variable} ${body.variable}`}
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

      <div className="masthead">
        <div>
          <h1 className="treeTitle hand">
            {festival.name} <span>where every act on the draft came from</span>
          </h1>
          <p className="facts">
            {factsLine(festival)} <span className="stamp">{STAMP}</span>
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
          <p className="small">{WATCH_NOTE}</p>
        </div>
      </div>

      <main className="tree" aria-label="Undercard draft" aria-live="polite">
        <div className="box root">
          <p className="rootNames hand">{festival.headliners.join(" · ")}</p>
          <p className="rootNote">
            Headliners, booked. Their fans are where every ranking starts.
          </p>
        </div>

        <div className="links" style={{ position: "relative" }}>
          <Line x={50} y={0} height={14} on={rootLit} />
          <Line
            x={centers[0] ?? 50}
            x2={centers.at(-1) ?? 50}
            y={13}
            on={rootLit}
          />
          {venues.map((venue, index) => (
            <Line
              key={venue.entityId}
              x={centers[index]}
              y={14}
              height={14}
              on={!running || tested.has(venue.entityId)}
              dead={(liftedBy.get(venue.entityId) ?? 0) === 0}
            />
          ))}
        </div>

        <div
          className="branches"
          style={
            {
              "--branch-cols": weights
                .map((w) => `minmax(0, ${w}fr)`)
                .join(" "),
            } as CSSProperties
          }
        >
          {venues.map((venue) => {
            const own = actsOf(venue);
            const visible = own.filter((act) => shown.has(act.entityId));
            const lifted = liftedBy.get(venue.entityId) ?? 0;
            const isTesting = testing === venue.entityId;
            const waiting = running && !tested.has(venue.entityId);
            return (
              <section
                key={venue.entityId}
                className={`branch ${lifted === 0 ? "dead" : ""}`}
                aria-label={venue.name}
              >
                <div
                  className={`box venue ${waiting ? "waiting" : ""} ${isTesting ? "testing" : ""}`}
                  style={
                    { "--tint": tintOf.get(venue.entityId) } as CSSProperties
                  }
                >
                  <h2 className="venueName hand">{venue.name}</h2>
                  <p className="venueNote">
                    {waiting
                      ? "Waiting for its turn"
                      : isTesting && current
                        ? `${PLAIN_BAND[current.band]}: ${stepLine(current.venue)}`
                        : `${running ? visible.length : lifted} ${liftedWords(running ? visible.length : lifted)} · a ${festival.city} venue`}
                  </p>
                  {visible.length > 0 ? (
                    <ol
                      className="acts"
                      style={
                        { "--cols": own.length >= 5 ? 2 : 1 } as CSSProperties
                      }
                    >
                      {visible.map((act) => (
                        <ActLine
                          key={act.entityId}
                          act={act}
                          enter={running}
                          top={bill?.first.baselineTop[act.band]}
                        />
                      ))}
                    </ol>
                  ) : (
                    !waiting && (
                      <p className="none hand">
                        No act climbed {MIN_LIFT} places with its fans
                      </p>
                    )
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <div className="links" style={{ position: "relative" }}>
          {allFeeders.map(({ venue, center }) => (
            <Line
              key={venue.entityId}
              x={center}
              y={0}
              height={14}
              on={feeders.some(
                (feeder) => feeder.venue.entityId === venue.entityId,
              )}
            />
          ))}
          {allFeeders.length > 0 && (
            <Line
              x={Math.min(50, ...allFeeders.map((feeder) => feeder.center))}
              x2={Math.max(50, ...allFeeders.map((feeder) => feeder.center))}
              y={13}
              on={feeders.length > 0}
            />
          )}
          <Line x={50} y={14} height={14} on={feeders.length > 0} />
        </div>

        <section className="box bill" aria-labelledby="tree-bill">
          <div className="billHead">
            <h2 id="tree-bill" className="billTitle hand">
              The draft lineup (the bill)
            </h2>
            <p className="small">
              {draftedLine(calls, state.build?.createdAt)}
            </p>
          </div>
          <p className="small">{BILL_LINE}</p>
          <div className="bands">
            {festival.feeBands.map((band) => (
              <div key={band.id}>
                <h3 className="bandName">
                  {PLAIN_BAND[band.id]}{" "}
                  <span className="fee">{feeRangeShort(band)}</span>
                </h3>
                <p className="bandActs hand">
                  {acts
                    .filter((act) => act.band === band.id)
                    .map((act, index, list) => (
                      <span
                        key={act.entityId}
                        className={shown.has(act.entityId) ? "" : "open"}
                      >
                        {shown.has(act.entityId) ? act.name : "open slot"}
                        {index < list.length - 1 ? " · " : ""}
                      </span>
                    ))}
                </p>
              </div>
            ))}
          </div>
          <p className="fee">{FEE_RANGE_WHY}</p>
          {current && (
            <p className="now">
              {call ? `Qloo call ${call.n} of ${state.calls.length}. ` : ""}
              {note ? `The AI agent: ${note} ` : ""}
              <button type="button" className="textLink" onClick={skip}>
                {SKIP}
              </button>
            </p>
          )}
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
        <p className="small">
          {venuesNote(
            bill?.first.placesListed ?? null,
            venues.length,
            festival.city,
          )}
        </p>
      </footer>
    </div>
  );
}
