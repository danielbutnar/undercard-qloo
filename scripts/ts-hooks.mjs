// Module hooks that let plain Node (22.18 or later strips TypeScript types itself) run the
// app's server modules from a script, with no package: "@/..." maps to src/, an import
// without an extension tries .ts, and a JSON import loads as a module's default export.
// Registered by scripts/register-ts.mjs. The app uses a TypeScript parameter property, so run
// with --experimental-transform-types (see scripts/agent-offline.ts for the full command).
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = new URL("../src/", import.meta.url);

function withExtension(href) {
  const path = fileURLToPath(href);
  if (existsSync(path) && statSync(path).isFile()) return href;
  for (const extension of [".ts", ".tsx", "/index.ts"])
    if (existsSync(path + extension))
      return pathToFileURL(path + extension).href;
  return href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/"))
    return nextResolve(
      withExtension(new URL(specifier.slice(2), SRC).href),
      context,
    );
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  )
    return nextResolve(
      withExtension(new URL(specifier, context.parentURL).href),
      context,
    );
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json"))
    return {
      format: "module",
      source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`,
      shortCircuit: true,
    };
  return nextLoad(url, context);
}
