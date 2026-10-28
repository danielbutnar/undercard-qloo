"use client";

import {
  liftedWords,
  noFanDataLine,
  switchLine,
} from "@/components/chart/words";
import { plusRetries } from "@/lib/agent-words";
import type { MethodStory } from "@/lib/method-story";

/*
 * How it works' "The AI agent's choices" (M10b, WS2): which venues' fans the AI agent read, and
 * how many acts each lifted. The walkthrough it sat in (FollowOneAct) gave way to the director's
 * cut (WS12 item 2) and is gone (WS12 item 7).
 */

/** Which venues' fans the AI agent read, and how many acts each put on the lineup. */
export function AgentChoices({
  story,
  city,
  hues,
}: {
  story: MethodStory;
  city: string;
  hues: ReadonlyMap<string, number>;
}) {
  const switches = story.switches ?? [];
  const noFanData = story.noFanData ?? [];
  // A venue the switch sentence names isn't said twice (WS2).
  const named = new Set(switches.map((entry) => entry.from.entityId));
  const quiet = story.venues.filter(
    (venue) => venue.lifted === 0 && !named.has(venue.entityId),
  );
  const none = quiet.filter((venue) => !noFanData.includes(venue.entityId));
  const unscored = quiet.filter((venue) => noFanData.includes(venue.entityId));
  return (
    <section aria-label="The AI agent's choices" className="panel how-choices">
      <h3 className="panel-title">The AI agent&apos;s choices</h3>
      <p className="panel-sub">
        {story.placesListed !== null &&
          `Qloo listed ${story.placesListed} live-music places in ${city}. `}
        The AI agent chose whose fans to read, in {story.calls} Qloo calls
        {plusRetries(story.retries)}. Here is how many acts each venue&apos;s
        fans lifted onto the whole lineup, mid-size and opening:
      </p>
      <ul className="how-venues">
        {story.venues.map((venue) => (
          <li
            key={venue.entityId}
            // WS12 item 7: a venue colour only where its fans lifted acts; grey otherwise.
            className={`how-venue ${venue.lifted > 0 && hues.has(venue.entityId) ? `venue-${hues.get(venue.entityId)}` : ""}`}
          >
            <i className="how-swatch" aria-hidden />
            <span className="how-venue-name">{venue.name}</span>
            <span className="how-venue-lifted">
              {liftedWords(venue.lifted)}
            </span>
          </li>
        ))}
      </ul>
      {none.length > 0 && (
        <p className="panel-sub">
          {none.map((venue) => venue.name).join(" and ")}: the agent read{" "}
          {none.length === 1 ? "its" : "their"} fans too, and they moved no act
          onto the lineup.
        </p>
      )}
      {/* Venues Qloo had no fan data for say so, from the server's Qloo cache (WS2). */}
      {unscored.length > 0 && (
        <p className="panel-sub">
          {noFanDataLine(unscored.map((venue) => venue.name))}
        </p>
      )}
      {/* The planner's venue switch, only where the saved trace shows one (WS2). */}
      {switches.map((entry) => (
        <p key={entry.to.entityId} className="panel-sub">
          {switchLine(entry, noFanData)}
        </p>
      ))}
    </section>
  );
}
