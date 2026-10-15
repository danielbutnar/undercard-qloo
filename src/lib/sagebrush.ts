import seed from "../../seed/sagebrush-sound.json";
import { FestivalSchema, type Festival } from "./festival";

/**
 * The seeded demo festival, as `pnpm seed` writes it (seed/seed.ts): Sagebrush Sound, a
 * fictional festival in Boise, with 30 days of deterministic synthetic presale.
 */
export const SAGEBRUSH_SOUND: Festival = FestivalSchema.parse(seed);
