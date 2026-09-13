// =============================================================================
// Theater System — Player helpers
//
// Reuses the Music system's YouTube IFrame API loader (single script tag, one
// global namespace). The Music system's global `YT` declarations don't include
// the single-video loading methods the theater needs (it drives a playlist),
// so we extend the Player type locally rather than mutating a shared ambient.
// =============================================================================

import type { VideoPlatform } from "@/lib/log";
import { extractYouTubeId } from "@/components/log/media/youtube";
import { extractBilibiliId } from "@/components/log/media/bilibili";
import { extractVimeoId } from "@/components/log/media/vimeo";

// Ensure the global `YT` namespace (declared by the music player module) is in
// scope for consumers of this file.
import "@/systems/music/lib/youtube-player";

export { loadYouTubeAPI } from "@/systems/music/lib/youtube-player";

/** YT.Player plus the single-video controls used for playlist playback. */
export interface YTPlayerExt extends YT.Player {
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getIframe(): HTMLIFrameElement;
}

/** Resolve a platform video id from a watch URL (null when unparseable). */
export function resolveVideoId(
  url: string,
  platform: VideoPlatform,
): string | null {
  switch (platform) {
    case "youtube":
      return extractYouTubeId(url);
    case "bilibili":
      return extractBilibiliId(url);
    case "vimeo":
      return extractVimeoId(url);
    default:
      return null;
  }
}

/** Build a non-YouTube autoplay embed URL for the stage iframe. */
export function embedUrlFor(url: string, platform: VideoPlatform): string | null {
  if (platform === "bilibili") {
    const trimmed = url.trim();
    let bvid: string | null = null;
    let aid: string | null = null;
    let page = 1;
    if (/^BV[0-9A-Za-z]+$/.test(trimmed)) {
      bvid = trimmed;
    } else {
      try {
        const u = new URL(trimmed);
        const parts = u.pathname.split("/").filter(Boolean);
        const idx = parts.indexOf("video");
        const raw = idx >= 0 ? parts[idx + 1]?.trim() : undefined;
        if (raw && /^BV[0-9A-Za-z]+$/.test(raw)) bvid = raw;
        const av = raw?.match(/^av(\d+)$/i);
        if (av?.[1]) aid = av[1];
        const p = u.searchParams.get("p");
        if (p && /^\d+$/.test(p)) page = Math.max(1, Number(p));
      } catch {
        return null;
      }
    }
    if (!bvid && !aid) return null;
    const player = new URL("https://player.bilibili.com/player.html");
    if (bvid) player.searchParams.set("bvid", bvid);
    if (aid) player.searchParams.set("aid", aid);
    player.searchParams.set("page", String(page));
    player.searchParams.set("high_quality", "1");
    player.searchParams.set("danmaku", "0");
    player.searchParams.set("autoplay", "1");
    return player.toString();
  }

  if (platform === "vimeo") {
    const id = extractVimeoId(url);
    return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
  }

  return null;
}

const FULLSCREEN_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";

/**
 * YouTube's IFrame API builds the embed without a reliable `allow=fullscreen`
 * token. On iPad / iOS that makes the native fullscreen control fall back to
 * Picture-in-Picture. Patch the iframe as soon as it exists.
 */
export function enableIframeFullscreen(root: HTMLElement | null): void {
  if (!root) return;
  const iframe = root.querySelector("iframe");
  if (!iframe) return;
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("webkitallowfullscreen", "true");
  const allow = iframe.getAttribute("allow") ?? "";
  if (!/(^|[;\s])fullscreen($|[;\s])/.test(allow)) {
    iframe.setAttribute("allow", allow ? `${allow}; fullscreen` : FULLSCREEN_ALLOW);
  }
}

/** Format seconds as `m:ss`. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
