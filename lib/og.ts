/**
 * A page's card at runtime, from the browser: `/api/og` (app/api/og/route.ts).
 *
 * The fallback path. Cards normally render from the committed snapshot
 * (`content/og-snapshot.json`) or a manual `preview`; this runs only for a
 * link not yet snapshotted, or when an opt-in dev revalidation asks for the
 * page as it is now. The browser can't read another origin's HTML (CORS), so
 * the route reads it, and a CDN keeps its answer.
 */

import type { OGData } from "@/lib/og-core";

export async function fetchOGData(url: string): Promise<OGData> {
  const response = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as { ok: boolean; data: OGData };
  return body.data;
}
