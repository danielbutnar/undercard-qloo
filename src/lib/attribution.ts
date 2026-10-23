/**
 * Evidence section 35 (docs/evidence.md): with feature.explainability=true, does Qloo's answer
 * attribute an act's result to individual inputs of the call? The answer's shape isn't
 * documented here, so the act's record is walked for numbers tied to the call's input entity
 * ids, whichever way it holds them: a list of { entity_id, score }, inputs used as keys, or
 * [id, number] pairs. A per-input contribution needs the act's own venue among the inputs given
 * a number, and at least one other input beside it.
 */
export type Attribution = {
  /** The inputs given a number, in the call's order. */
  inputs: string[];
  ownVenue: boolean;
  perInput: boolean;
  /** Where the numbers sit, list positions as [] and the input's id as <input>: no values. */
  paths: string[];
};

export function perInputContributions(
  record: unknown,
  inputIds: string[],
  ownVenueId: string,
): Attribution {
  const byKey = new Map(inputIds.map((id) => [id.toLowerCase(), id]));
  const inputOf = (value: unknown) =>
    typeof value === "string" ? byKey.get(value.toLowerCase()) : undefined;
  const isNumber = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value);
  const found = new Set<string>();
  const paths = new Set<string>();
  const note = (id: string, path: string) => {
    found.add(id);
    paths.add(`${path}.<input>`);
  };
  const join = (path: string, key: string) => (path ? `${path}.${key}` : key);

  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      if (node.length === 2) {
        const id = inputOf(node[0]) ?? inputOf(node[1]);
        if (id && (isNumber(node[0]) || isNumber(node[1]))) note(id, path);
      }
      for (const child of node) walk(child, `${path}[]`);
      return;
    }
    if (!node || typeof node !== "object") return;
    const entries = Object.entries(node as Record<string, unknown>);
    // An object naming an input with a number beside it: { entity_id: <input>, score: 0.4 }.
    if (entries.some(([, value]) => isNumber(value)))
      for (const [, value] of entries) {
        const id = inputOf(value);
        if (id) note(id, path);
      }
    for (const [key, value] of entries) {
      const id = inputOf(key);
      // An input used as a key: { <input>: 0.4 } or { <input>: { score: 0.4 } }.
      if (id && isNumber(value)) {
        note(id, path);
        continue;
      }
      if (
        id &&
        value &&
        typeof value === "object" &&
        Object.values(value).some(isNumber)
      )
        note(id, path);
      walk(value, join(path, key));
    }
  };
  walk(record, "");

  const own = byKey.get(ownVenueId.toLowerCase());
  const ownVenue = own !== undefined && found.has(own);
  return {
    inputs: inputIds.filter((id) => found.has(id)),
    ownVenue,
    perInput: ownVenue && found.size >= 2,
    paths: [...paths],
  };
}
