// M8a spike: can Qloo score how much each pair of acts on a saved bill shares an audience,
// within 10 calls per bill? For each act, one artist insights call seeded by that act with the
// results limited to the bill's other acts (filter.results.entities). One call at a time.
// Counts only on the console; the answers go to the gitignored .design/evidence. From the root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/clash-spike.ts boise austin denver nashville
import { existsSync, writeFileSync } from "node:fs";
import { townBySlug } from "@/lib/towns";
import { createBuildStore } from "@/server/build-store";
import { createQlooCache } from "@/server/qloo-cache";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) throw new Error("QLOO_API_KEY is not set (put it in .env.local).");
const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const store = createBuildStore(createQlooCache());
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let calls = 0;

type Entity = {
  entity_id: string;
  name: string;
  query?: { affinity?: number };
  tags?: { id?: string; tag_id?: string; type?: string; name?: string }[];
};

async function insights(seed: string, others: string[]) {
  const url = new URL("/v2/insights", BASE);
  url.searchParams.set("filter.type", "urn:entity:artist");
  url.searchParams.set("signal.interests.entities", seed);
  url.searchParams.set("filter.results.entities", others.join(","));
  url.searchParams.set("take", String(others.length + 5));
  for (let attempt = 0; attempt < 5; attempt++) {
    calls++;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey!, Accept: "application/json" },
    });
    if (response.status !== 429 && response.status < 500) {
      await pause(1500);
      const body = (await response.json().catch(() => null)) as {
        results?: { entities?: Entity[] };
      } | null;
      return {
        status: response.status,
        entities: body?.results?.entities ?? [],
      };
    }
    await pause(2000 * 2 ** attempt);
  }
  throw new Error("Qloo stayed busy");
}

const genres = (entity: Entity) =>
  new Set(
    (entity.tags ?? [])
      .filter((tag) => /genre/.test(tag.type ?? tag.id ?? tag.tag_id ?? ""))
      .map((tag) => tag.id ?? tag.tag_id ?? ""),
  );

const rows = [];
const raw: Record<string, unknown> = {};
const pairsAll: { shared: number; score: number | null }[] = [];
for (const slug of process.argv.slice(2)) {
  const festival = townBySlug(slug)?.festival;
  const saved = festival ? await store.latest(festival.id) : null;
  if (!saved) {
    rows.push({ slug, saved: false });
    continue;
  }
  const ids = saved.lineup.acts.map((act) => act.entityId);
  const before = calls;
  const scores = new Map<string, number[]>();
  const tags = new Map<string, Set<string>>();
  let outsideResults = 0;
  const statuses: number[] = [];
  for (const seed of ids) {
    const others = ids.filter((id) => id !== seed);
    const answer = await insights(seed, others);
    statuses.push(answer.status);
    for (const entity of answer.entities) {
      if (!others.includes(entity.entity_id)) {
        outsideResults++;
        continue;
      }
      tags.set(entity.entity_id, genres(entity));
      const affinity = entity.query?.affinity;
      if (typeof affinity !== "number") continue;
      const key = [seed, entity.entity_id].sort().join("|");
      scores.set(key, [...(scores.get(key) ?? []), affinity]);
    }
  }
  let scored = 0;
  const pairs = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const list = scores.get([ids[i], ids[j]].sort().join("|"));
      const score = list ? list.reduce((a, b) => a + b, 0) / list.length : null;
      if (score !== null) scored++;
      const a = tags.get(ids[i]);
      const b = tags.get(ids[j]);
      const shared = a && b ? [...a].filter((id) => b.has(id)).length : -1;
      pairs.push({ shared, score });
      pairsAll.push({ shared, score });
    }
  rows.push({
    slug,
    calls: calls - before,
    statuses: [...new Set(statuses)],
    pairs: pairs.length,
    scored,
    outsideResults,
    tagsKnown: tags.size,
  });
  raw[slug] = pairs;
}
const mean = (list: { score: number | null }[]) => {
  const values = list.flatMap((pair) =>
    pair.score === null ? [] : [pair.score],
  );
  return values.length
    ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4))
    : null;
};
const twoPlus = pairsAll.filter((pair) => pair.shared >= 2);
const none = pairsAll.filter((pair) => pair.shared === 0);
const result = {
  calls,
  rows,
  pairs: pairsAll.length,
  scored: pairsAll.filter((pair) => pair.score !== null).length,
  sharingTwoPlus: { pairs: twoPlus.length, meanScore: mean(twoPlus) },
  sharingNone: { pairs: none.length, meanScore: mean(none) },
  unknownTags: pairsAll.filter((pair) => pair.shared < 0).length,
};
console.log(JSON.stringify(result, null, 2));
writeFileSync(
  ".design/evidence/m8a-clash.json",
  `${JSON.stringify({ ranAt: new Date().toISOString(), ...result, raw }, null, 2)}\n`,
);
