// node --import ./scripts/register-ts.mjs <script.ts>: see scripts/ts-hooks.mjs.
import { register } from "node:module";

register("./ts-hooks.mjs", import.meta.url);
