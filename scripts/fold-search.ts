// The folded searches (WS8, item 15): every model pick with letters beyond ASCII in the 29
// checked towns' saved answers (read from the cache, never the model) whose own search found no
// match, searched again on Qloo with its accents folded ("Altın Gün" as "Altin Gun"). Each
// answer lands in the Qloo cache, where the Without Qloo checks read it (src/server/pick-checks.ts).
// The console gets names and counts only; each folded search's raw answer goes to
// .design/fold-search/ (git-ignored), never the repository. From the root:
//   DRY=1 node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/fold-search.ts
// DRY=1 lists the picks and the folded searches the cache already holds, calling nothing.
// LIVE=1 MAX_CALLS=<n> makes at most n folded searches (one Qloo /search call each).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { foldAccents, foundOnQloo, hasNonAscii } from "@/lib/pick-tests";
import { checkedFestival } from "@/lib/towns";
import { savedLlmOnly } from "@/server/llm-only";
import { createQlooCache } from "@/server/qloo-cache";
import { createQlooClient, QlooCacheMiss } from "@/server/qloo";

const DRY = process.env.DRY === "1";
const LIVE = process.env.LIVE === "1";
const MAX_CALLS = Number(process.env.MAX_CALLS ?? 0);
if (DRY === LIVE) throw new Error("set exactly one of DRY=1 and LIVE=1");
if (LIVE && !(MAX_CALLS > 0)) throw new Error("LIVE=1 needs MAX_CALLS=<n>");

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const cache = createQlooCache();
if (cache.kind !== "upstash") throw new Error("no Upstash settings found");

const cached = createQlooClient({
  apiKey: "",
  cache,
  cacheOnly: true,
  fetch: async () => {
    throw new Error("the cache only");
  },
});
let calls = 0;
const live = createQlooClient({
  apiKey: LIVE ? (process.env.QLOO_API_KEY ?? "") : "",
  cache,
  cacheOnly: !LIVE,
  fetch: async (input, init) => {
    calls++;
    if (calls > MAX_CALLS)
      throw new Error(`over the ${MAX_CALLS} Qloo calls approved`);
    return fetch(input, init);
  },
});

/** A search's answer from the cache, or null when the cache doesn't hold it. */
async function fromCache(query: string) {
  try {
    return (await cached.search({ query })).data;
  } catch (error) {
    if (error instanceof QlooCacheMiss) return null;
    throw error;
  }
}

const out = ".design/fold-search";
if (LIVE) mkdirSync(out, { recursive: true });
const seen = new Set<string>();
const rows: Record<string, unknown>[] = [];
for (const town of CHECKED_TOWNS) {
  const festival = checkedFestival(town);
  const answer = await savedLlmOnly(festival, cache);
  for (const pick of answer?.picks ?? []) {
    if (!hasNonAscii(pick.name) || seen.has(pick.name)) continue;
    seen.add(pick.name);
    const own = await fromCache(pick.name);
    const ownMatch = own ? foundOnQloo(pick.name, own) !== null : null;
    const folded = foldAccents(pick.name);
    let answerFolded = await fromCache(folded);
    if (!answerFolded && LIVE && ownMatch !== true) {
      answerFolded = (await live.search({ query: folded })).data;
      writeFileSync(
        `${out}/${encodeURIComponent(folded)}.json`,
        JSON.stringify(answerFolded, null, 2),
      );
    }
    const row = {
      festival: festival.id,
      pick: pick.name,
      folded,
      ownSearch: own === null ? "not cached" : ownMatch ? "match" : "no match",
      foldedSearch:
        answerFolded === null
          ? "not cached"
          : foundOnQloo(folded, answerFolded)
            ? "match"
            : "no match",
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
console.log(
  JSON.stringify({
    dry: DRY,
    picksBeyondAscii: rows.length,
    foldedMatches: rows.filter((row) => row.foldedSearch === "match").length,
    qlooCalls: calls,
  }),
);
