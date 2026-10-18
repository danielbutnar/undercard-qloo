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
 * build (GET /api/venue-switch), fetched once after the screen opens, so switching a venue off
 * and on is a lookup. Nothing here calls Qloo or a model.
 */
export function useVenueSwitch(festivalId: string, enabled = true) {
  const [data, setData] = useState<VenueSwitchData | null>(null);
  const [status, setStatus] = useState<VenueSwitchStatus>("loading");
  const [off, setOff] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch(`/api/venue-switch?festival=${encodeURIComponent(festivalId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        setData((await response.json()) as VenueSwitchData);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("unavailable");
      });
    return () => controller.abort();
  }, [festivalId, enabled]);

  const toggle = useCallback((venueId: string) => {
    setOff((current) => {
      const next = new Set(current);
      if (next.has(venueId)) next.delete(venueId);
      else next.add(venueId);
      return next;
    });
  }, []);

  const reset = useCallback(() => setOff(new Set()), []);

  /** The re-formed lineup while any venue is off; null when every venue is on. */
  const lineup: SwitchedLineup | null = useMemo(() => {
    if (!data || off.size === 0) return null;
    const on = new Set(
      data.venues.map((venue) => venue.entityId).filter((id) => !off.has(id)),
    );
    return switchedLineup(data, on);
  }, [data, off]);

  /** Every act's places with every venue on, once the switch is in. */
  const basePlaces = useMemo(() => {
    if (!data) return null;
    return switchedLineup(data, new Set(data.venues.map((venue) => venue.entityId)))
      .places;
  }, [data]);

  return {
    status: enabled ? status : ("unavailable" as const),
    basePlaces,
    venues: data?.venues ?? [],
    off,
    toggle,
    reset,
    lineup,
  };
}
