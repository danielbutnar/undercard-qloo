import { QLOO_CALL_CAP } from "@/lib/agent-limits";
import type { FeeBand, FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { AgentModel } from "./ai";
import type { BuildStore, SavedBuild } from "./build-store";
import { QlooBusy, type QlooClient } from "./qloo";
import { recordRun } from "./undercard-build";

/**
 * WS13.11: the re-runs of the 29 towns with Agent 2.0, in windows Daniel names, run by the
 * orchestrator through scripts/rerun-towns.ts. Each town's build reads and writes a new cache
 * prefix, never the entries the saved 1.0 builds read, and is kept by its own id: no latest
 * pointer moves here. Moving one is a separate step, after Daniel's yes.
 */

/** Qloo answered 429: the run stops at once, as plan-to-9 asks of every window. */
export class RateLimited extends QlooBusy {
  constructor() {
    super();
    this.name = "RateLimited";
    this.message = "Qloo answered 429: the re-run stops here.";
  }
}

/** The window's MAX_CALLS would be passed: the run stops before the request. */
export class OverBudget extends QlooBusy {
  constructor(maxCalls: number) {
    super();
    this.name = "OverBudget";
    this.message = `The window's ${maxCalls} Qloo calls are spent or too few for another town.`;
  }
}

export interface CallBudget {
  used(): number;
  left(): number;
  /** Why the run stopped, once it has. */
  stoppedBy(): QlooBusy | null;
}

/**
 * A fetch that counts every HTTP attempt against the window's MAX_CALLS and stops the run at the
 * first 429. `onAnswer` sees each answer's body (the script writes them to .design/ only).
 */
export function countingFetch({
  fetch,
  maxCalls,
  onAnswer,
}: {
  fetch: typeof globalThis.fetch;
  maxCalls: number;
  onAnswer?: (url: string, status: number, body: unknown) => void;
}): CallBudget & { fetch: typeof globalThis.fetch } {
  let used = 0;
  let stopped: QlooBusy | null = null;
  const counted = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    if (stopped) throw stopped;
    if (used >= maxCalls) throw (stopped = new OverBudget(maxCalls));
    used++;
    const response = await fetch(input, init);
    if (response.status === 429) throw (stopped = new RateLimited());
    if (onAnswer)
      onAnswer(
        String(input instanceof Request ? input.url : input),
        response.status,
        await response
          .clone()
          .json()
          .catch(() => null),
      );
    return response;
  };
  return {
    fetch: counted as typeof globalThis.fetch,
    used: () => used,
    left: () => maxCalls - used,
    stoppedBy: () => stopped,
  };
}

/** Each tier's fill: its acts, and its slots left open. */
export type TierFill = Record<FeeBandId, { acts: number; open: number }>;

function fill(build: SavedBuild | null, bands: readonly FeeBand[]): TierFill {
  return Object.fromEntries(
    bands.map((band) => {
      const acts =
        build?.lineup.acts.filter((act) => act.band === band.id).length ?? 0;
      return [band.id, { acts, open: Math.max(0, band.slots - acts) }];
    }),
  ) as TierFill;
}

/** A town's 2.0 bill beside its saved 1.0 bill, tier by tier (Daniel, 2026-10-28). */
export function billBeside(
  saved: SavedBuild | null,
  rerun: SavedBuild | null,
  bands: readonly FeeBand[],
): Record<
  FeeBandId,
  {
    saved: { acts: number; open: number };
    rerun: { acts: number; open: number };
  }
> {
  const before = fill(saved, bands);
  const after = fill(rerun, bands);
  return Object.fromEntries(
    bands.map((band) => [
      band.id,
      { saved: before[band.id], rerun: after[band.id] },
    ]),
  ) as ReturnType<typeof billBeside>;
}

export interface RerunResult {
  festivalId: string;
  /** The 2.0 build kept by its id; null when the run booked no act or never started. */
  buildId: string | null;
  complete: boolean;
  calls: number;
  stoppedBy: QlooBusy | null;
}

/**
 * Re-runs each festival with Agent 2.0, one at a time, and keeps each build by its id only. A town
 * starts only while the window has a whole run's cap left; the first 429, or a request past the
 * window's calls, stops the run where it is.
 */
export async function rerunTowns({
  festivals,
  qloo,
  model,
  store,
  budget,
}: {
  festivals: readonly Festival[];
  /** A client over the re-run's own prefix, counting its requests against `budget`. */
  qloo: () => QlooClient;
  model: () => AgentModel;
  store: Pick<BuildStore, "keep">;
  budget: CallBudget;
}): Promise<RerunResult[]> {
  const results: RerunResult[] = [];
  for (const festival of festivals) {
    if (budget.left() < QLOO_CALL_CAP) {
      results.push({
        festivalId: festival.id,
        buildId: null,
        complete: false,
        calls: 0,
        stoppedBy:
          budget.stoppedBy() ?? new OverBudget(budget.used() + budget.left()),
      });
      break;
    }
    const before = budget.used();
    const { result, build } = await recordRun({
      festival,
      qloo: qloo(),
      model: model(),
    });
    const stoppedBy = budget.stoppedBy();
    // A run cut short by the window isn't a 2.0 build: nothing is kept.
    if (build && !stoppedBy) await store.keep(build);
    results.push({
      festivalId: festival.id,
      buildId: build && !stoppedBy ? build.id : null,
      complete: result.complete && !stoppedBy,
      calls: budget.used() - before,
      stoppedBy,
    });
    if (stoppedBy) break;
  }
  return results;
}
