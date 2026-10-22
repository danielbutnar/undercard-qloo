import { describe, expect, it } from "vitest";
import { perInputContributions } from "@/lib/attribution";

// Invented ids: two headliners and two venues sent as the call's signal.
const H1 = "00000000-0000-4000-8000-000000000001";
const H2 = "00000000-0000-4000-8000-000000000002";
const V1 = "00000000-0000-4000-8000-000000000003";
const V2 = "00000000-0000-4000-8000-000000000004";
const INPUTS = [H1, H2, V1, V2];

describe("perInputContributions", () => {
  it("reads a list of inputs, each with its own number, the act's venue among them", () => {
    const act = {
      entity_id: "00000000-0000-4000-8000-000000000005",
      query: {
        affinity: 0.9,
        explainability: {
          "signal.interests.entities": [
            { entity_id: H1, score: 0.5 },
            { entity_id: V1, score: 0.3 },
          ],
        },
      },
    };
    const found = perInputContributions(act, INPUTS, V1);
    expect(found.inputs).toEqual([H1, V1]);
    expect(found.ownVenue).toBe(true);
    expect(found.perInput).toBe(true);
    expect(found.paths).toEqual([
      "query.explainability.signal.interests.entities[].<input>",
    ]);
  });

  it("reads inputs used as keys, and ids written in another case", () => {
    const act = {
      entity_id: "00000000-0000-4000-8000-000000000006",
      query: { contributions: { [H2.toLowerCase()]: 0.4, [V2]: 0.6 } },
    };
    const found = perInputContributions(act, INPUTS, V2);
    expect(found.inputs).toEqual([H2, V2]);
    expect(found.perInput).toBe(true);
    expect(found.paths).toEqual(["query.contributions.<input>"]);
  });

  it("reads [id, number] pairs", () => {
    const act = {
      query: {
        explain: [
          [H1, 0.2],
          [V1, 0.7],
          ["other", 1],
        ],
      },
    };
    expect(perInputContributions(act, INPUTS, V1).inputs).toEqual([H1, V1]);
  });

  it("doesn't count one score for the act as a whole", () => {
    const act = {
      entity_id: "00000000-0000-4000-8000-000000000007",
      query: { affinity: 0.8 },
    };
    const found = perInputContributions(act, INPUTS, V1);
    expect(found.inputs).toEqual([]);
    expect(found.perInput).toBe(false);
  });

  it("doesn't pass an act whose own venue gets no number", () => {
    const act = {
      query: {
        explainability: [
          { entity_id: H1, score: 0.5 },
          { entity_id: H2, score: 0.4 },
          { entity_id: V2, score: 0.1 },
        ],
      },
    };
    const found = perInputContributions(act, INPUTS, V1);
    expect(found.inputs).toEqual([H1, H2, V2]);
    expect(found.ownVenue).toBe(false);
    expect(found.perInput).toBe(false);
  });

  it("doesn't pass a number for the act's venue alone", () => {
    const act = { query: { explainability: [{ entity_id: V1, score: 1 }] } };
    const found = perInputContributions(act, INPUTS, V1);
    expect(found.ownVenue).toBe(true);
    expect(found.perInput).toBe(false);
  });

  it("ignores an input named with no number beside it", () => {
    const act = { query: { explainability: [{ entity_id: V1, name: "x" }] } };
    expect(perInputContributions(act, INPUTS, V1).inputs).toEqual([]);
  });
});
