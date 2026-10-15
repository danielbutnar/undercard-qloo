import type { LlmOnlyLineup, LlmOnlyPick } from "@/lib/llm-only";

export interface LlmOnlyState {
  status: "idle" | "loading" | "ready" | "error";
  lineup: LlmOnlyLineup | null;
  error: string | null;
}

function PickCard({ pick }: { pick: LlmOnlyPick }) {
  return (
    <article
      aria-label={pick.name}
      className="flex h-full flex-col gap-3 border-2 border-rule bg-surface p-3"
    >
      <h4 className="font-display text-name font-extrabold uppercase">
        {pick.name}
      </h4>
      <dl className="flex flex-col divide-y divide-muted/40 border-y border-muted/40">
        {["Qloo affinity", "Popularity", "Fee band"].map((label) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 py-1"
          >
            <dt className="text-label text-muted">{label}</dt>
            <dd className="text-label font-semibold">—</dd>
          </div>
        ))}
      </dl>
      <p className="text-label">
        <span className="font-semibold">Why Boise: </span>No local link.
      </p>
      <p className="text-label text-muted">
        <span className="font-semibold">The model: </span>
        {pick.note}
      </p>
    </article>
  );
}

/**
 * The LLM-only baseline: the model's own picks for the same brief, printed in black ink only.
 * With no Qloo data there is no affinity, no popularity to map to a fee band, no local link.
 */
export function LlmOnlyBoard({ state }: { state: LlmOnlyState }) {
  return (
    <section aria-labelledby="llm-only-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b-2 border-rule pb-1">
        <h3
          id="llm-only-title"
          className="font-display text-band font-extrabold uppercase"
        >
          LLM only
        </h3>
        <p className="rounded-sm border-2 border-danger px-2 font-display text-name font-extrabold uppercase text-danger">
          No Qloo data
        </p>
        <p className="text-label text-muted">
          The same brief, answered by the model alone
        </p>
      </div>
      {state.status === "loading" && (
        <p className="text-label">Asking the model, without Qloo…</p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-label font-semibold text-danger">
          {state.error}
        </p>
      )}
      {state.lineup && (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {state.lineup.picks.map((pick) => (
            <li key={pick.name}>
              <PickCard pick={pick} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
