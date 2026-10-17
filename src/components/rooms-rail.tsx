import type { FeeBand } from "@/lib/fee-bands";
import type { RoomLine } from "@/lib/rooms";

function testedFor(room: RoomLine, bands: readonly FeeBand[]): string {
  const labels = bands
    .filter((band) => room.bands.includes(band.id))
    .map((band) => band.label);
  const tested = labels.length ? `tested for ${labels.join(" and ")}` : "";
  return [room.short, tested].filter(Boolean).join(" · ");
}

/**
 * The Boise rooms behind the bill: how many places Qloo listed, which rooms' crowds the agent
 * tested, and how many acts each lifted, a zero included. A room is its crowd, not a stage.
 */
export function RoomsRail({
  rooms,
  bands,
  placesListed,
  city = "Boise",
  compact = false,
}: {
  rooms: readonly RoomLine[];
  bands: readonly FeeBand[];
  /** Boise live-music places Qloo listed; null when the build didn't record it. */
  placesListed: number | null;
  /** The festival's town, which the rooms are in. */
  city?: string;
  /** Names and counts only, while the trace below needs the room. */
  compact?: boolean;
}) {
  const tested = rooms.filter((room) => room.bands.length > 0).length;
  return (
    <section
      aria-labelledby="rooms-title"
      className={`flex flex-col border-2 border-rule bg-surface ${compact ? "gap-1 p-3" : "gap-2 p-4"}`}
    >
      <h2 id="rooms-title" className="text-body font-bold">
        {city} venue crowds behind this bill
      </h2>
      {!compact && (
        <p className="text-label text-muted">
          {placesListed !== null
            ? `Qloo listed ${placesListed} ${city} live-music places; the agent tested ${tested} of their crowds against the headliners' fans.`
            : `The agent tested ${tested} ${city} rooms' crowds against the headliners' fans.`}{" "}
          These venues stand for the town&apos;s taste: the acts won&apos;t
          necessarily play there.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-muted/50">
        {rooms.map((room) => (
          <li
            key={room.venue.entityId}
            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 ${compact ? "py-1" : "py-2"}`}
          >
            <p className="text-body leading-tight font-semibold">
              {room.venue.name}
            </p>
            <p
              className={`flex items-end ${compact ? "flex-row items-baseline gap-1.5" : "row-span-2 flex-col"}`}
            >
              <span
                className={`leading-none font-bold ${compact ? "text-name" : "text-figure"} ${room.lifted ? "text-accent" : "text-muted"}`}
              >
                {room.lifted}
              </span>{" "}
              <span
                className={`text-label font-semibold ${room.lifted ? "text-accent" : "text-muted"}`}
              >
                {room.lifted === 0
                  ? "lifted none"
                  : `${room.lifted === 1 ? "act" : "acts"} lifted`}
              </span>
            </p>
            {!compact && (
              <p className="text-label text-muted">{testedFor(room, bands)}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
