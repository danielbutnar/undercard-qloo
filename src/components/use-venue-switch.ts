"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  switchedLineup,
  type SwitchedLineup,
  type VenueSwitchData,
} from "@/lib/venue-switch";

export type VenueSwitchStatus = "loading" | "ready" | "unavailable";

/**
 * The venue switch on the client: every combination is worked out on the server from the saved
 * build on screen (GET /api/venue-switch), fetched once per build, so switching a venue off and
 * on is a lookup. Nothing here calls Qloo or a model, and data worked out from any other build is
 * never shown against the one on screen.
 */
export function useVenueSwitch(
  festivalId: string,
  /** The saved build on screen: the switch is worked out from it, and refetched when it changes. */
  buildId: string | null,
  enabled = true,
) {
  // What came back, and for which build; a build whose answer failed.
  const [answer, setAnswer] = useState<{
    build: string;
    data: VenueSwitchData;
  } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  // The venues switched off, kept with the build they were switched off on.
  const [switched, setSwitched] = useState<{
    build: string | null;
    off: ReadonlySet<string>;
  }>({ build: buildId, off: new Set() });

  useEffect(() => {
    if (!enabled || !buildId) return;
    const controller = new AbortController();
    fetch(
      `/api/venue-switch?festival=${encodeURIComponent(festivalId)}&build=${encodeURIComponent(buildId)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as VenueSwitchData;
        // A synthetic build carries no id; any other answer must be for the build asked about.
        if (data.buildId && data.buildId !== buildId) throw new Error("stale");
        setAnswer({ build: buildId, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedFor(buildId);
      });
    return () => controller.abort();
  }, [festivalId, buildId, enabled]);

  // Data from an earlier build on this screen is never shown against the one there now.
  const current = answer && answer.build === buildId ? answer.data : null;
  const off: ReadonlySet<string> = useMemo(
    () => (switched.build === buildId ? switched.off : new Set()),
    [switched, buildId],
  );

  const toggle = useCallback(
    (venueId: string) =>
      setSwitched((previous) => {
        const next = new Set(previous.build === buildId ? previous.off : []);
        if (next.has(venueId)) next.delete(venueId);
        else next.add(venueId);
        return { build: buildId, off: next };
      }),
    [buildId],
  );

  const reset = useCallback(
    () => setSwitched({ build: buildId, off: new Set() }),
    [buildId],
  );

  /** The lineup with every venue on (the saved one), once the switch is in. */
  const base = useMemo(
    () =>
      current
        ? switchedLineup(
            current,
            new Set(current.venues.map((venue) => venue.entityId)),
          )
        : null,
    [current],
  );

  /** The re-formed lineup while any venue is off; null when every venue is on. */
  const lineup: SwitchedLineup | null = useMemo(() => {
    if (!current || off.size === 0) return null;
    const on = new Set(
      current.venues
        .map((venue) => venue.entityId)
        .filter((id) => !off.has(id)),
    );
    return switchedLineup(current, on);
  }, [current, off]);

  const status: VenueSwitchStatus =
    !enabled || !buildId || failedFor === buildId
      ? "unavailable"
      : current
        ? "ready"
        : "loading";

  return {
    status,
    basePlaces: base?.places ?? null,
    baseActs: base?.acts ?? null,
    venues: current?.venues ?? [],
    off,
    toggle,
    reset,
    lineup,
  };
}
