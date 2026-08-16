// =============================================================================
// Track Metadata — lazy title/author resolution for playlist entries.
//
// The YouTube IFrame API exposes playlist *video IDs* only (`getPlaylist()`),
// never titles. Titles are resolved client-side from the public oEmbed
// endpoint (no API key, static-export compatible) and cached in localStorage
// so the playlist browser converges to fully-labeled after the first visit.
// The currently-playing track's metadata (from `getVideoData()`) is seeded
// into the same cache for free as the user listens.
// =============================================================================

export interface TrackMeta {
  title: string;
  author: string;
}

const CACHE_KEY = "hux_music_track_meta";
/** Bound the cache so an evolving playlist can't grow it unboundedly. */
const CACHE_MAX_ENTRIES = 500;

type MetaCache = Record<string, TrackMeta>;

let memoryCache: MetaCache | null = null;

function loadCache(): MetaCache {
  if (memoryCache) return memoryCache;
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    memoryCache = stored ? (JSON.parse(stored) as MetaCache) : {};
  } catch {
    memoryCache = {};
  }
  return memoryCache;
}

function persistCache(): void {
  if (typeof window === "undefined" || !memoryCache) return;
  try {
    const ids = Object.keys(memoryCache);
    if (ids.length > CACHE_MAX_ENTRIES) {
      // Drop oldest-inserted keys (object key order) down to the cap.
      for (const id of ids.slice(0, ids.length - CACHE_MAX_ENTRIES)) {
        delete memoryCache[id];
      }
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch {
    // Ignore storage errors (private mode, quota)
  }
}

/** Same normalization as the provider: YouTube Music channels end in " - Topic". */
export function normalizeAuthor(author: string): string {
  return author.replace(/ - Topic$/, "");
}

export function getCachedTrackMeta(videoId: string): TrackMeta | null {
  return loadCache()[videoId] ?? null;
}

/** Seed the cache (e.g. from the player's own `getVideoData()`). */
export function cacheTrackMeta(videoId: string, meta: TrackMeta): void {
  const cache = loadCache();
  const prev = cache[videoId];
  if (prev && prev.title === meta.title && prev.author === meta.author) return;
  cache[videoId] = meta;
  persistCache();
}

async function fetchOEmbed(endpoint: string): Promise<TrackMeta | null> {
  const res = await fetch(endpoint);
  if (!res.ok) return null;
  const data = (await res.json()) as { title?: string; author_name?: string };
  if (!data.title) return null;
  return {
    title: data.title,
    author: normalizeAuthor(data.author_name ?? ""),
  };
}

/**
 * Resolve one video's title/author. Tries YouTube's oEmbed first, then
 * noembed.com (a CORS-friendly oEmbed proxy) as fallback. Returns null on
 * failure — callers render a positional fallback label instead.
 */
export async function fetchTrackMeta(videoId: string): Promise<TrackMeta | null> {
  const cached = getCachedTrackMeta(videoId);
  if (cached) return cached;

  const watchUrl = encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`,
  );
  const endpoints = [
    `https://www.youtube.com/oembed?url=${watchUrl}&format=json`,
    `https://noembed.com/embed?url=${watchUrl}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const meta = await fetchOEmbed(endpoint);
      if (meta) {
        cacheTrackMeta(videoId, meta);
        return meta;
      }
    } catch {
      // Network/CORS failure — try the next endpoint.
    }
  }
  return null;
}

/**
 * Resolve metadata for many videos with bounded concurrency, invoking
 * `onMeta` as each result lands so the UI fills in progressively.
 * Already-cached IDs resolve synchronously on the first pass.
 */
export function resolveTrackMetas(
  videoIds: string[],
  onMeta: (videoId: string, meta: TrackMeta) => void,
): () => void {
  let cancelled = false;
  const queue = [...videoIds];
  const CONCURRENCY = 4;

  const next = async (): Promise<void> => {
    while (!cancelled) {
      const videoId = queue.shift();
      if (!videoId) return;
      const meta = await fetchTrackMeta(videoId);
      if (cancelled) return;
      if (meta) onMeta(videoId, meta);
    }
  };

  for (let i = 0; i < CONCURRENCY; i++) void next();
  return () => {
    cancelled = true;
  };
}
