import { AiNotConfigured, createAgentModel } from "./ai";
import { createBuildStore } from "./build-store";
import { createQlooClient, type QlooClient } from "./qloo";
import { createQlooCache } from "./qloo-cache";

/** The route handlers' server wiring: keys from the environment, one shared cache. */

export function serverQloo(): QlooClient | null {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) return null;
  return createQlooClient({
    apiKey,
    cache: createQlooCache(),
    baseUrl: process.env.QLOO_BASE_URL || undefined,
  });
}

export function serverModel() {
  try {
    return createAgentModel();
  } catch (error) {
    if (error instanceof AiNotConfigured) return null;
    throw error;
  }
}

export function serverBuildStore() {
  return createBuildStore(createQlooCache());
}

/** Reads a small JSON body; an empty or invalid body reads as {}. */
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
