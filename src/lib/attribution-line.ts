/**
 * One input of Qloo's split of an act's result (docs/evidence.md section 35), named as the saved
 * build names it: a headliner, or one of the act's fee range's venues. The share is Qloo's, 0 to
 * 1, as it comes; an act's shares add up to about 1.
 */
export interface SplitPart {
  input: "headliner" | "venue";
  entityId: string;
  name: string;
  share: number;
}
