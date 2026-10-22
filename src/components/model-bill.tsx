import { Sleeve } from "@/components/chart/sleeve";
import { pickCheckLine } from "@/components/chart/words";
import type { Festival } from "@/lib/festival";
import type { LlmOnlyLineup, LlmOnlyPick, PickCheck } from "@/lib/llm-only";

export interface LlmOnlyState {
  status: "idle" | "loading" | "ready" | "error";
  lineup: LlmOnlyLineup | null;
  error: string | null;
  /** Each pick on Qloo, from the cache only (prompt-4); absent when none came with the answer. */
  checks?: readonly PickCheck[];
}

const savedAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** When a build or an answer was saved, as "Oct 15, 14:02". */
export const formatSavedAt = (iso: string) => savedAt.format(new Date(iso));

// No place, no climb, no venue colour: no Qloo data went into a pick. Its cover is the drawn
// sleeve an act without a photo gets, with no genres to draw from; its small line says how
// Qloo's data, read afterwards from the cache, places it.
function Pick({ pick, line }: { pick: LlmOnlyPick; line: string }) {
  return (
    <article aria-label={pick.name} className="pick">
      <Sleeve
        genres={[]}
        id={pick.name}
        label={false}
        className="pick-sleeve"
      />
      <div className="min-w-0">
        <h3 className="pick-name">{pick.name}</h3>
        <p className="pick-note">{pick.note}</p>
        <p className="pick-none">{line}</p>
      </div>
    </article>
  );
}

/**
 * Without Qloo: the same brief answered by the model alone, in grey under a "No Qloo data"
 * stamp. With no Qloo data there is no venue behind a pick, no climb to draw and no popularity
 * to check against a fee range.
 */
export function ModelBill({
  festival,
  state,
  onRetry,
}: {
  festival: Festival;
  state: LlmOnlyState;
  onRetry: () => void;
}) {
  const checks = new Map(state.checks?.map((check) => [check.name, check]));
  return (
    <section
      aria-label="Without Qloo: an AI model's picks alone"
      className="model"
    >
      <div className="model-head">
        <div>
          <h2 className="band-name">The model&apos;s picks</h2>
          <p className="panel-sub">
            Headliners booked. The same brief, answered by the model alone: no
            popularity data, so no fee range check.
          </p>
        </div>
        <p className="stamp model-stamp">No Qloo data</p>
      </div>
      {(state.status === "loading" || state.status === "idle") && (
        <p className="model-wait" role="status">
          Asking the model, without Qloo…
        </p>
      )}
      {state.status === "error" && (
        <div className="model-wait">
          <p role="alert" className="alert">
            {state.error}
          </p>
          <button type="button" onClick={onRetry} className="tool mt-2">
            Try again
          </button>
        </div>
      )}
      {state.lineup && (
        <ol className="picks">
          {state.lineup.picks.map((pick) => (
            <li key={pick.name}>
              <Pick
                pick={pick}
                line={pickCheckLine(checks.get(pick.name), festival)}
              />
            </li>
          ))}
        </ol>
      )}
      <p className="drafted">
        {state.lineup
          ? `Answered by the model alone, with no tools · saved ${formatSavedAt(state.lineup.createdAt)} UTC`
          : "The model alone, with no tools."}
      </p>
    </section>
  );
}
