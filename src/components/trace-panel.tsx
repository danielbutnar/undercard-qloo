const CALL_CAP = 12;

/**
 * The job ticket beside the board: the Build button and the list of Qloo calls the agent makes.
 * The agent arrives in M2, so for now the button is disabled and the trace is empty.
 */
export function TracePanel() {
  return (
    <aside
      aria-labelledby="trace-title"
      className="flex flex-col border-2 border-rule bg-surface"
    >
      <div className="border-b-2 border-rule p-4">
        <button
          type="button"
          disabled
          className="w-full rounded-sm border-2 border-accent bg-accent px-4 py-2 font-display text-figure font-extrabold uppercase text-on-accent hover:border-rule disabled:cursor-not-allowed disabled:border-muted disabled:bg-surface disabled:text-muted"
        >
          Build undercard
        </button>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="trace-title"
            className="font-display text-name font-extrabold uppercase"
          >
            Qloo calls
          </h2>
          <p className="text-label text-muted">0 of {CALL_CAP}</p>
        </div>
        <p className="text-label text-muted">
          Every Qloo call the agent makes will list here, with its parameters
          and result count.
        </p>
      </div>
    </aside>
  );
}
