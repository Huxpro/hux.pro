// =============================================================================
// Theater System — Types
//
// The Theater is the immersive video system: an album (playlist) of tracks
// (videos) played in a large desktop modal, a floating cross-platform
// Picture-in-Picture window, or a minimized "now playing" Live Activity. It
// mirrors the Music system's persistent-player philosophy so playback survives
// mode changes and route navigation.
// =============================================================================

import type { VideoPlatform } from "@/lib/log";

/**
 * A single playable video. Derived from a commit's video media plus display
 * metadata (title / subtitle / cover) so the player chrome never needs the
 * commit itself.
 */
export interface Track {
  /** Stable id — the source commit id, or a synthetic id for ad-hoc tracks. */
  id: string;
  platform: VideoPlatform;
  /** Original watch URL (used for the "open externally" affordance). */
  url: string;
  /**
   * YouTube video id when resolvable. Only YouTube tracks get JS-API control
   * (play / pause / seek / progress); other platforms play in a plain iframe.
   */
  videoId: string | null;
  title: string;
  /** Conference / publication / date line. */
  subtitle?: string;
  /** Cover image; null falls back to a branded placeholder. */
  thumbnail: string | null;
  /** Optional in-site link to the source commit / works page. */
  href?: string;
}

/** A named playlist — one of the home widget's "albums" (React / Lynx / …). */
export interface Album {
  id: string;
  title: string;
  tracks: Track[];
}

/**
 * Where the player is currently surfaced:
 *  - `closed`  — not shown; player stopped.
 *  - `theater` — the large immersive modal (tablet+ / desktop default).
 *  - `pip`     — the floating Picture-in-Picture window (phone default, or a
 *                fallback toggled from theater).
 */
export type TheaterMode = "closed" | "theater" | "pip";

/** Simplified player phase for the UI (mirrors the Music system's PlayerState). */
export type PlayerPhase =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "ended"
  | "error";

/** A viewport-anchored rectangle for the persistent stage element. */
export interface StageRect {
  top: number;
  left: number;
  width: number;
  height: number;
}
