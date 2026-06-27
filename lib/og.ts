"use server";

/**
 * Server Action to fetch Open Graph metadata from a URL.
 *
 * Thin wrapper over the framework-agnostic core in `lib/og-core.ts` (the same
 * code the build-time snapshot uses). This runs server-side because the browser
 * can't fetch cross-origin HTML (CORS); the actual crawl goes out from the
 * current server process — the local `next dev` process in development, a
 * Vercel function in production.
 *
 * Role in the data pipeline: this is the *fallback / live* path. Cards normally
 * render from the committed snapshot (`content/og-snapshot.json`) or a manual
 * `preview`; this action only runs for links not yet in the snapshot, or when
 * an opt-in dev revalidation explicitly asks for the latest online version.
 */

import { fetchOG, type OGData } from "@/lib/og-core";

export type { OGData };

export async function fetchOGData(url: string): Promise<OGData> {
  const result = await fetchOG(url, 86400 /* 24h Next Data Cache TTL */);
  if (!result.ok) {
    console.error(`Failed to fetch OG data for ${url}: ${result.error}`);
  }
  return result.data;
}
