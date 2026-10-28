import { NextRequest, NextResponse } from "next/server";
import { fetchOG, type OGData } from "@/lib/og-core";
import { assertPublicUrl } from "@/lib/og-guard";
import { siteCardOf } from "@/lib/site-card";

/**
 * GET /api/og?url=…: a page's card, read at runtime. The fallback for a
 * link the snapshot (`pnpm og:snapshot`) has not recorded.
 *
 * - One of this site's pages answers from the function the page publishes
 *   its Open Graph with (`siteCardOf`), with no request at all, so it is the
 *   same card the snapshot would hold.
 * - Anyone else's is crawled, but only a public web page (`assertPublicUrl`,
 *   checked for every redirect), within `fetchOG`'s time and size bounds.
 *
 * A GET, not a Server Action, so a CDN can keep the answer: a card for a
 * day, a failure for an hour. The answer is always 200 with `ok`, so a
 * failure is cached like a card instead of being retried by every visitor.
 *
 * Off in production unless `NEXT_PUBLIC_OG_RUNTIME=1`: the site ships without API
 * routes (AGENT.md, Portability), and every link it shows is written in the
 * repo, so the snapshot can hold them all. In development it is what paints
 * a link you have just written, before `pnpm og:snapshot`.
 */

const CARD_TTL = 60 * 60 * 24;
const MISS_TTL = 60 * 60;

export interface OGRouteResponse {
  ok: boolean;
  data: OGData;
}

function answer(body: OGRouteResponse, ttl: number) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${ttl * 7}`,
    },
  });
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_OG_RUNTIME !== "1") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const url = request.nextUrl.searchParams.get("url") ?? "";
  if (!url || url.length > 2048) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    const card = siteCardOf(url);
    return card
      ? answer({ ok: true, data: { ...card, url } }, CARD_TTL)
      : answer({ ok: false, data: { url } }, MISS_TTL);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "not a URL" }, { status: 400 });
  }
  const result = await fetchOG(parsed.href, { guard: assertPublicUrl });
  const ok = result.ok && !!(result.data.title || result.data.image);
  return answer({ ok, data: { ...result.data, frame: result.frame } }, ok ? CARD_TTL : MISS_TTL);
}
