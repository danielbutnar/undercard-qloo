// pnpm seed: writes Sagebrush Sound with 30 days of deterministic presale to
// seed/sagebrush-sound.json, the file the app loads. Same output on every run.
//   pnpm seed                 writes seed/sagebrush-sound.json
//   pnpm seed --out <path>    writes somewhere else (the tests use this)
import { writeFileSync } from "node:fs";
import { buildSeed, SEED_FILE, seedJson } from "./festival.ts";

const outFlag = process.argv.indexOf("--out");
const out = outFlag >= 0 ? process.argv[outFlag + 1] : SEED_FILE;

const festival = buildSeed();
writeFileSync(out, seedJson(festival));
const sold = festival.presale.reduce((total, day) => total + day.sold, 0);
console.log(
  `Wrote ${festival.name}: ${festival.presale.length} days of presale (${festival.presale[0].date} to ${festival.presale.at(-1)?.date}, ${sold} tickets) to ${out}`,
);
