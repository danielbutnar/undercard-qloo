import type { ControlRef, RankedArtist } from "@/lib/assemble-lineup";
import type { FeeBandId } from "@/lib/fee-bands";
import type { BuildContext } from "./build-store";
import type { ArtistsQuery, QlooClient } from "./qloo";

/**
 * A 2.0 build's matched control for a venue in a tier, as its context records it (WS13.3):
 * undefined on a 1.0 build, which has no controls; null where no room had fan data, so no act
 * can be booked from that venue.
 */
export function recordedControl(
  context: Pick<BuildContext, "controls">,
  band: FeeBandId,
  venueId: string,
): ControlRef | null | undefined {
  if (!context.controls) return undefined;
  return (
    context.controls[band]?.find((entry) => entry.venueId === venueId)
      ?.control ?? null
  );
}

/**
 * The control's ranking for a refill or a redraft (WS13.3, Daniel's must-fix of 2026-10-28): the
 * venue's own query with the control in its place, so both leave out the same acts and the local
 * lift compares like with like. Null when the call fails: the venue then books nothing.
 */
export async function controlRanking(
  reader: QlooClient,
  query: ArtistsQuery,
  venueId: string,
  control: ControlRef,
  excluded: readonly string[],
): Promise<{
  run: { venue: ControlRef; artists: RankedArtist[] } | null;
  call: Awaited<ReturnType<QlooClient["artists"]>>["call"] | null;
  error?: unknown;
}> {
  try {
    const result = await reader.artists({
      ...query,
      signalEntityIds: query.signalEntityIds.map((id) =>
        id === venueId ? control.entityId : id,
      ),
    });
    return {
      run: {
        venue: control,
        artists: result.data.filter(
          (artist) => !excluded.includes(artist.entityId),
        ),
      },
      call: result.call,
    };
  } catch (error) {
    return { run: null, call: null, error };
  }
}
