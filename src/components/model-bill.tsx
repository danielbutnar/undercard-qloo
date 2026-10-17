import { BillHeader, formatSavedAt, SHEET } from "@/components/draft-bill";
import type { Festival } from "@/lib/festival";
import type { LlmOnlyLineup, LlmOnlyPick } from "@/lib/llm-only";

export interface LlmOnlyState {
  status: "idle" | "loading" | "ready" | "error";
  lineup: LlmOnlyLineup | null;
  error: string | null;
}

// Black ink only: the model's own reason, then two plain facts. No score or tally.
function Pick({ pick }: { pick: LlmOnlyPick }) {
  return (
    <article aria-label={pick.name} className="flex flex-col gap-1">
      <h3 className="font-display text-figure font-extrabold uppercase">
        {pick.name}
      </h3>
      <p className="text-label">{pick.note}</p>
      <p className="text-label text-muted">
        No Boise room · fee band not checked
      </p>
    </article>
  );
}

/**
 * Without Qloo: the same bill reprinted with the model's own picks for the same brief, in
 * black ink under a red "No Qloo data" stamp. With no Qloo data there is no Boise room behind
 * a pick and no popularity to check it against a fee band.
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
  return (
    <section aria-label="Without Qloo: the model's picks" className={SHEET}>
      <BillHeader festival={festival} stamp="No Qloo data">
        Headliners booked. The same brief, answered by the model alone.
      </BillHeader>
      <section
        aria-labelledby="model-picks"
        className="mt-3 flex w-full flex-col items-center border-t-2 border-rule pt-2"
      >
        <div className="flex flex-wrap items-baseline justify-center gap-x-3">
          <h2
            id="model-picks"
            className="font-display text-name font-extrabold uppercase"
          >
            The model&apos;s picks
          </h2>
          <p className="text-label text-muted">
            no popularity data, so no fee band check
          </p>
        </div>
        {state.status === "loading" && (
          <p className="mt-3 text-label">Asking the model, without Qloo…</p>
        )}
        {state.status === "error" && (
          <div className="mt-3 flex flex-col items-center gap-1">
            <p role="alert" className="text-label font-semibold text-danger">
              {state.error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="text-label text-ink underline underline-offset-2 hover:text-accent"
            >
              Try again
            </button>
          </div>
        )}
        {state.lineup && (
          <ol className="mt-2.5 grid w-full grid-cols-1 gap-x-8 gap-y-3 text-left sm:grid-cols-2">
            {state.lineup.picks.map((pick) => (
              <li key={pick.name}>
                <Pick pick={pick} />
              </li>
            ))}
          </ol>
        )}
      </section>
      <p className="mt-auto w-full border-t border-rule pt-2.5 text-label text-muted">
        {state.lineup
          ? `Answered by the model alone, with no tools · saved ${formatSavedAt(state.lineup.createdAt)} UTC`
          : "The model alone, with no tools."}
      </p>
    </section>
  );
}
