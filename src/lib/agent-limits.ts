/**
 * The most Qloo calls one Agent 2.0 build may make, cached answers included (Daniel, 2026-10-24):
 * 7 fixed calls, one find_venues in the control town, and up to 5 venue reads in each of the two
 * tiers, each with its matched control. A 1.0 build's cap was 12.
 */
export const QLOO_CALL_CAP = 28;
