import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { serverBuildStore } from "@/server/deps";
import { readFirstBill } from "@/server/first-bill";

// M9d's blind tournament: each screen's candidates, served only when UNDERCARD_LAB=1 is set on
// a local server. The deployed demo never sets it, so there these pages are a 404.
export const instant = false;

async function firstBill() {
  "use cache";
  cacheLife("minutes");
  return readFirstBill(serverBuildStore(), SAGEBRUSH_SOUND.id);
}

const FIRST = {
  a: undefined,
  b: "ledger",
  c: "focus",
  d: "rail-left",
  e: "ledger-cta",
  f: "ledger-bars",
  g: "poster-compact",
} as const;
const CLIMB = {
  a: undefined,
  b: "rail",
  c: "wide",
  d: "stepper",
  e: "progress",
  f: "focus",
  g: "from",
} as const;
const METHOD = {
  a: "current",
  b: "qa-first",
  c: "two-column",
  d: "table-first",
  e: "two-column-wide-diagram",
  f: "two-column-swapped",
  g: "two-column-table-below",
} as const;

export default async function Lab({
  params,
}: {
  params: Promise<{ screen: string; variant: string }>;
}) {
  if (process.env.UNDERCARD_LAB !== "1") notFound();
  const { screen, variant } = await params;
  if (!["a", "b", "c", "d", "e", "f", "g"].includes(variant)) notFound();
  const v = variant as "a" | "b" | "c" | "d" | "e" | "f" | "g";
  if (screen === "method") return <MethodPage arrangement={METHOD[v]} />;
  const bill = await firstBill();
  if (screen === "first")
    return (
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={bill}
        design={{ first: FIRST[v] }}
      />
    );
  if (screen === "build")
    return (
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={bill}
        design={{ climb: CLIMB[v] }}
      />
    );
  notFound();
}
