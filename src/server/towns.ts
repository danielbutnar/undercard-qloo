import { TOWNS } from "@/lib/towns";
import type { BuildStore } from "./build-store";
import { readFirstBill } from "./first-bill";

/**
 * The towns the switcher shows: Boise, and each other town with a saved build. Only a build
 * that filled every slot is saved, so a town whose build left a band short never shows.
 */
export async function townsOnShow(
  store: Pick<BuildStore, "latest">,
): Promise<string[]> {
  const others = await Promise.all(
    TOWNS.slice(1).map(async (town) =>
      (await readFirstBill(store, town.festival.id)) ? town.slug : null,
    ),
  );
  return ["boise", ...others.filter((slug): slug is string => slug !== null)];
}
