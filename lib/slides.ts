// =============================================================================
// Slide decks — which URLs are playable reveal.js decks, and where they live.
//
// Framework-free so the theater's album builder (systems/theater/lib) and the
// /works cover component can share one answer without importing each other.
// =============================================================================

// =============================================================================
// Known deck detection (optional auto-route helper for <Media />)
// =============================================================================

/**
 * Paths that host self-contained reveal.js decks (not the wrapping keynote
 * blog posts under /YYYY/MM/DD/). Keep in sync with the slide repos under
 * github.com/Huxpro — served from huxpro.github.io (CNAME → og.hux.pro).
 *
 * `huangxuan.me/<deck>` used to work, but that domain now redirects to
 * hux.pro (which 404s these paths), so playable links must go through
 * huxpro.github.io.
 */
const SLIDE_DECK_PATHS = [
  "/js-module-7day",
  "/css-sucks-2015",
  "/pwa-in-my-pov",
  "/pwa-qcon2016",
  "/sw-101-gdgdf",
  "/jsconfcn2017",
];

/** Canonical host for playable decks after the huangxuan.me → hux.pro cutover. */
const SLIDES_HOST = "https://huxpro.github.io";

const SLIDES_HOSTS = new Set([
  "huxpro.github.io",
  "og.hux.pro",
  // Legacy — still recognized so we can rewrite to huxpro.github.io.
  "huangxuan.me",
  "www.huangxuan.me",
]);

function deckPathFromUrl(parsed: URL): string | null {
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  const deck = SLIDE_DECK_PATHS.find(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  return deck ?? null;
}

/**
 * True when `url` points at a playable HTML slide deck we can iframe.
 * Recognizes huxpro.github.io / og.hux.pro decks, legacy huangxuan.me
 * paths, and Wayback snapshots of the same.
 */
export function isPlayableSlidesUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    // Wayback Machine: …/web/<ts>/https://huangxuan.me/<deck>/
    if (host.includes("web.archive.org")) {
      const m = parsed.pathname.match(
        /\/web\/\d+(?:id_)?\/(https?:\/\/.+)$/i,
      );
      if (m?.[1]) return isPlayableSlidesUrl(m[1]);
      return false;
    }

    if (!SLIDES_HOSTS.has(host)) return false;
    return deckPathFromUrl(parsed) !== null;
  } catch {
    return false;
  }
}

/**
 * Normalize a deck URL to the playable huxpro.github.io host.
 *
 * - Legacy `huangxuan.me/<deck>` → `huxpro.github.io/<deck>/` (huangxuan.me
 *   now 302s to hux.pro, which 404s these paths).
 * - Wayback snapshots unwrap to the live deck, then rewrite as above.
 * - `og.hux.pro` (the GitHub Pages CNAME) is accepted as already playable
 *   and left alone so we don't bounce through an extra redirect.
 */
export function resolveSlidesEmbedUrl(url: string): string {
  try {
    let parsed = new URL(url);

    if (parsed.hostname.toLowerCase().includes("web.archive.org")) {
      const m = parsed.pathname.match(
        /\/web\/\d+(?:id_)?\/(https?:\/\/.+)$/i,
      );
      if (!m?.[1] || !isPlayableSlidesUrl(m[1])) return url;
      parsed = new URL(m[1]);
    }

    const host = parsed.hostname.toLowerCase();
    if (!SLIDES_HOSTS.has(host)) return url;

    const deck = deckPathFromUrl(parsed);
    if (!deck) return url;

    // og.hux.pro already serves the deck — keep hash/query for deep links.
    if (host === "og.hux.pro" || host === "huxpro.github.io") {
      const out = new URL(`${SLIDES_HOST}${deck}/`);
      out.search = parsed.search;
      out.hash = parsed.hash;
      // Prefer the authored github.io host even when given og.hux.pro, so
      // "Open fullscreen" / mobile new-tab links stay on huxpro.github.io.
      return out.toString();
    }

    // Legacy huangxuan.me → huxpro.github.io
    const out = new URL(`${SLIDES_HOST}${deck}/`);
    out.search = parsed.search;
    out.hash = parsed.hash;
    return out.toString();
  } catch {
    return url;
  }
}
