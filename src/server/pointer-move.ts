import { BUILD_PREFIX, SavedBuildSchema } from "./build-store";
import { cacheTtlSeconds, type QlooCache } from "./qloo-cache";

/**
 * Moving festivals' latest pointers to builds kept by their id: the 29 re-run builds, with the 2.0
 * deploy (Daniel, 2026-10-28 23:10). Saved production state fails closed (memory
 * saved-state-fails-closed): every pointer is read with getOrThrow inside a time limit, so an
 * outage never reads as "nothing there", and nothing is written unless every move is clean.
 */
export interface PointerMove {
  festivalId: string;
  /** The build the pointer must hold now: the pinned record's. */
  from: string;
  /** The build it moves to, stored by its id for the same festival. */
  to: string;
}

export type MoveStatus =
  "move" | "already" | "mismatch" | "missing" | "unreadable";

export interface MoveRow extends PointerMove {
  status: MoveStatus;
  /** The pointer as read; null when there is none or it couldn't be read. */
  current: string | null;
}

/** Reads every pointer and target build, reading only; one row per move. */
export async function planMoves(
  cache: QlooCache,
  moves: readonly PointerMove[],
  { timeoutMs = 4000 }: { timeoutMs?: number } = {},
): Promise<MoveRow[]> {
  const strict = cache.getOrThrow;
  if (!strict)
    throw new Error(
      "A pointer move needs a cache whose read can fail (getOrThrow): nothing planned.",
    );
  const read = async <T>(key: string): Promise<T | null> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("read timed out")), timeoutMs);
    });
    try {
      return await Promise.race([
        strict.call(cache, key) as Promise<T | null>,
        late,
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const rows: MoveRow[] = [];
  for (const move of moves) {
    try {
      const current = await read<string>(
        `${BUILD_PREFIX}latest:${move.festivalId}`,
      );
      const target = SavedBuildSchema.safeParse(
        await read(`${BUILD_PREFIX}id:${move.to}`),
      );
      const status: MoveStatus =
        !target.success || target.data.festivalId !== move.festivalId
          ? "missing"
          : current === move.to
            ? "already"
            : current === move.from
              ? "move"
              : "mismatch";
      rows.push({
        ...move,
        current: typeof current === "string" ? current : null,
        status,
      });
    } catch {
      rows.push({ ...move, current: null, status: "unreadable" });
    }
  }
  return rows;
}

/** Writes every planned move only when each row is a move or already moved; else nothing. */
export async function applyMoves(
  cache: QlooCache,
  rows: readonly MoveRow[],
  now: () => number = Date.now,
): Promise<{ written: number; refused: MoveRow[] }> {
  const refused = rows.filter(
    (row) => row.status !== "move" && row.status !== "already",
  );
  if (refused.length > 0) return { written: 0, refused };
  let written = 0;
  for (const row of rows)
    if (row.status === "move") {
      await cache.set(
        `${BUILD_PREFIX}latest:${row.festivalId}`,
        row.to,
        cacheTtlSeconds(now()),
      );
      written++;
    }
  return { written, refused: [] };
}
