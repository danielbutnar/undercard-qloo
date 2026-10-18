"use client";

import { Barlow, Permanent_Marker } from "next/font/google";
import Link from "next/link";
import type { CSSProperties } from "react";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { FeeBand, FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { LabBill } from "@/lib/lab";
import type { ClimbEvent } from "@/lib/lift-climb";
import type { Act, Venue } from "@/lib/lineup";
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
} from "../_kit/copy";
import { useLabBuild } from "../_kit/use-lab-build";
import "./desk.css";

const face = Barlow({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--desk-face",
});
const marker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--desk-marker",
});

const CAPS = ["var(--cap-a)", "var(--cap-b)", "var(--cap-c)", "var(--cap-d)"];
const SEGMENTS = 10;
const HEADLINERS = "headliners";

/** A channel: the headliners' fans, or one Boise venue's fans as the agent tested them. */
interface Channel {
  id: string;
  name: string;
  tested: string;
  cap: string;
  venue: Venue | null;
}

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

function Meter({ lit }: { lit: number }) {
  return (
    <div className="meter" aria-hidden>
      {Array.from({ length: SEGMENTS }, (_, index) => (
        <span
          key={index}
          className={[
            "led",
            index < lit && "on",
            index >= 6 && "amber",
            index === SEGMENTS - 1 && "peak",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </div>
  );
}

function Fader({ level, cap }: { level: number; cap: string }) {
  return (
    <div className="fader" aria-hidden>
      <span className="slot" />
      {[0, 25, 50, 75, 100].map((mark) => (
        <span
          key={mark}
          className="tick"
          style={{ bottom: `calc(6px + ${mark}% * 0.92)` }}
        />
      ))}
      <span
        className="cap"
        style={
          {
            "--cap": cap,
            bottom: `calc(6px + ${level * 100}% * 0.92)`,
          } as CSSProperties
        }
      />
    </div>
  );
}

function ActRow({ act, cap, top }: { act: Act; cap: string; top?: number }) {
  const climb = climbWords(act, top);
  return (
    <li className="act">
      <span
        className="chip"
        style={{ "--cap": cap } as CSSProperties}
        aria-hidden
      />
      <div>
        <h3 className="actName">
          {act.name}{" "}
          <span className="genre">
            {act.sharedTags.map((tag) => tag.name).join(", ")}
          </span>
        </h3>
        <p className="actWhy">
          {venueLine(act)}
          {climb && (
            <>
              {" · "}
              <strong className="badge">{climb.badge}</strong> {climb.words}
            </>
          )}
        </p>
      </div>
    </li>
  );
}

export function DeskScreen({
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
  const places = bill?.places ?? {};
  const acts = state.acts;
  const running = phase === "building" || phase === "climbing";
  const anchors = bill?.first.anchors ?? {};
  const rooms = roomsBehind(acts, anchors, state.unavailable);
  const liftedBy = new Map(
    rooms.map((room) => [room.venue.entityId, room.lifted]),
  );
  const venues = runOrder(anchors, festival.feeBands);
  const capOf = new Map(
    venues.map((venue, index) => [venue.entityId, CAPS[index % CAPS.length]]),
  );
  const channels: Channel[] = [
    {
      id: HEADLINERS,
      name: "Headliners' fans",
      tested: festival.headliners.join(" + "),
      cap: "var(--cap-head)",
      venue: null,
    },
    ...venues.map((venue) => ({
      id: venue.entityId,
      name: venue.name,
      tested: `tested for ${festival.feeBands
        .filter((band) =>
          anchors[band.id]?.some((entry) => entry.entityId === venue.entityId),
        )
        .map((band) => band.label)
        .join(" and ")}`,
      cap: capOf.get(venue.entityId)!,
      venue,
    })),
  ];
  const most = Math.max(1, ...rooms.map((room) => room.lifted));

  // Acts routed to the setlist so far: those a venue's fans put on the bill, once its solo ran.
  const routed = new Set(
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
  const routedFrom = (venueId: string) =>
    acts.filter(
      (act) => routed.has(act.entityId) && act.anchorVenue.entityId === venueId,
    ).length;
  const soloId = current ? (current.venue?.entityId ?? HEADLINERS) : null;
  const call = current
    ? stepCall(current, state.calls, festival.feeBands)
    : state.calls.at(-1);
  const note = call ? noteBefore(call.n, state.notes) : null;
  const calls = state.summary?.calls ?? bill?.first.calls;
  const tested = rooms.filter((room) => room.bands.length > 0).length;

  const levelOf = (channel: Channel) =>
    channel.venue
      ? routedFrom(channel.id) / most
      : running && !soloId
        ? 0
        : 0.75;
  const litOf = (channel: Channel, step: ClimbEvent | null) => {
    if (soloId === channel.id && step)
      return channel.venue
        ? Math.min(
            SEGMENTS,
            climbRows(step, acts, places).filter((row) => row.move !== null)
              .length,
          )
        : SEGMENTS - 2;
    return channel.venue ? Math.min(SEGMENTS, routedFrom(channel.id)) : 0;
  };

  return (
    <div
      className={`lab-desk ${face.variable} ${marker.variable}`}
      data-lab-phase={phase}
      style={{ "--channels": channels.length } as CSSProperties}
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

      <main className="console">
        <section className="surface" aria-label="Undercard draft">
          <div className="show">
            <div>
              <h1 className="showTape">{festival.name}</h1>
              <p className="facts">
                {factsLine(festival)} <span className="stamp">{STAMP}</span>
              </p>
              <p className="headliners">
                <span>Headliners, booked: </span>
                {festival.headliners.join(" · ")}
              </p>
            </div>
            <div className="transport">
              <button
                type="button"
                data-lab-watch
                onClick={watch}
                disabled={running}
                className="play"
              >
                <span className="playIcon" aria-hidden>
                  <svg viewBox="0 0 10 10">
                    <path d="M1.5.8 9.4 5 1.5 9.2Z" />
                  </svg>
                </span>
                {running ? "Building…" : WATCH}
              </button>
              <p className="transportNote">{WATCH_NOTE}</p>
            </div>
          </div>

          <div className="lcd" aria-live="polite">
            {current ? (
              <>
                <div className="lcdHead">
                  <p className="lcdTitle">
                    Solo:{" "}
                    {current.venue
                      ? `${current.venue.name} fans`
                      : "the headliners' fans"}{" "}
                    · {PLAIN_BAND[current.band]}
                  </p>
                  <button type="button" className="textLink" onClick={skip}>
                    {SKIP}
                  </button>
                </div>
                <p>
                  {stepLine(current.venue)}
                  {current.venue &&
                  !climbRows(current, acts, places).some(
                    (row) => row.move !== null,
                  )
                    ? `: no act climbs ${MIN_LIFT} or more places.`
                    : "."}
                  {call ? ` Qloo call ${call.n} of ${state.calls.length}.` : ""}
                </p>
                <ol className="lcdRows">
                  {climbRows(current, acts, places)
                    .slice(0, 12)
                    .map((row) => (
                      <li
                        key={row.entityId}
                        className={`lcdRow ${row.move !== null || row.fresh ? "mover" : ""}`}
                      >
                        <span>{row.place}</span>
                        <span className="up">
                          {row.fresh
                            ? "new"
                            : row.move !== null
                              ? `+${row.move}`
                              : ""}
                        </span>
                        <span className="who">{row.name}</span>
                        {row.onBill ? (
                          <span
                            className="routed"
                            style={{
                              background: capOf.get(current.venue!.entityId),
                            }}
                          >
                            to the bill
                          </span>
                        ) : (
                          <span />
                        )}
                      </li>
                    ))}
                </ol>
                {note && <p className="lcdNote">The AI agent: {note}</p>}
              </>
            ) : (
              <>
                <div className="lcdHead">
                  <p className="lcdTitle">
                    Each channel is a {festival.city} venue&apos;s fans; the
                    setlist is the lineup.
                  </p>
                </div>
                <p className="lcdIdle">
                  {running
                    ? "Replaying the saved build: no new Qloo or Claude calls."
                    : `Press play: the AI agent solos one channel at a time, and the acts a venue's fans lift go to the setlist. ${venuesNote(bill?.first.placesListed ?? null, tested, festival.city)}`}
                </p>
              </>
            )}
          </div>

          <div
            className="strips"
            role="list"
            aria-label={`${festival.city} venues and the headliners' fans`}
          >
            {channels.map((channel) => (
              <div
                key={channel.id}
                role="listitem"
                className={`strip ${soloId === channel.id ? "solo" : ""}`}
              >
                <p className="scribble">{channel.name}</p>
                <p className="tested">{channel.tested}</p>
                <div className="controls">
                  <Meter lit={litOf(channel, current)} />
                  <Fader level={levelOf(channel)} cap={channel.cap} />
                </div>
                <p className="soloKey">Solo</p>
                {channel.venue ? (
                  <p className="lifted">
                    <strong>
                      {running
                        ? routedFrom(channel.id)
                        : (liftedBy.get(channel.id) ?? 0)}
                    </strong>
                    {liftedWords(
                      running
                        ? routedFrom(channel.id)
                        : (liftedBy.get(channel.id) ?? 0),
                    )}
                  </p>
                ) : (
                  <p className="lifted">
                    <strong>Base</strong>
                    every list starts here
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="sheet" aria-labelledby="setlist-title">
          <h2 id="setlist-title" className="sheetTitle">
            Setlist: the draft lineup
          </h2>
          <p className="small">{BILL_LINE}</p>
          {festival.feeBands.map((band) => {
            const billed = acts.filter((act) => act.band === band.id);
            return (
              <div key={band.id}>
                <div className="band">
                  <h2 className="bandName">{PLAIN_BAND[band.id]}</h2>
                  <p className="small">{band.slots} slots</p>
                </div>
                <ol className="acts">
                  {billed.map((act) =>
                    routed.has(act.entityId) ? (
                      <ActRow
                        key={act.entityId}
                        act={act}
                        cap={
                          capOf.get(act.anchorVenue.entityId) ?? "var(--cap-d)"
                        }
                        top={bill?.first.baselineTop[band.id]}
                      />
                    ) : (
                      <li key={act.entityId} className="open">
                        Open slot
                      </li>
                    ),
                  )}
                </ol>
                <p className="feeNote">{feeRangeLine(band)}</p>
              </div>
            );
          })}
          <p className="drafted">
            {draftedLine(calls, state.build?.createdAt)}
          </p>
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
      </footer>
    </div>
  );
}
