import type { LlmOnlyLineup, LlmOnlyPick } from "@/lib/llm-only";

export interface LlmOnlyState {
  status: "idle" | "loading" | "ready" | "error";
  lineup: LlmOnlyLineup | null;
  error: string | null;
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

// No place, no climb, no venue colour, a blank sleeve: there is no Qloo data behind a pick.
function Pick({ pick }: { pick: LlmOnlyPick }) {
  return (
    <article aria-label={pick.name} className="pick">
      <span className="sleeve pick-sleeve sleeve-blank" aria-hidden />
      <div className="min-w-0">
        <h3 className="pick-name">{pick.name}</h3>
        <p className="pick-note">{pick.note}</p>
        <p className="pick-none">
          Picked without Qloo: no venue data, no fee check
        </p>
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
  state,
  onRetry,
}: {
  state: LlmOnlyState;
  onRetry: () => void;
}) {
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
              <Pick pick={pick} />
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
