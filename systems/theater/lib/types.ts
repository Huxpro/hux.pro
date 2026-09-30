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
 * What a track can be. The theater began as a video player; a slide deck is
 * the other thing a talk leaves behind, and it belongs on the same stage —
 * same 16:9 box, same title bar, same playlist rail, same prev / next. A deck
 * is a track with no audio and no transport, which is all that differs.
 */
export type TrackKind = "video" | "slides";

/** The language a recording is spoken in, or a deck written in. */
export type TrackLanguage = "en" | "zh";

interface TrackBase {
  /** Stable id — the source commit id, or a synthetic id for ad-hoc tracks. */
  id: string;
  kind: TrackKind;
  /**
   * The thing itself: a watch URL for a video (the "open externally"
   * affordance), a playable deck URL for slides (also what the stage frames).
   */
  url: string;
  title: string;
  /** Conference / publication / date line. */
  subtitle?: string;
  /** Cover image; null falls back to a branded placeholder. */
  thumbnail: string | null;
  /** Optional in-site link to the source commit / works page. */
  href?: string;
  /** The language of the version on the stage, when known. */
  language?: TrackLanguage;
  /** When it was given (the listing commit's date), `YYYY-MM`. */
  date?: string;
  /**
   * Every version of this piece, the one on the stage among them: the same
   * talk given in English and in Chinese is one track with two versions
   * (systems/theater/lib/library.ts). Absent or single for most tracks.
   */
  versions?: TrackVersion[];
}

/**
 * One version of a track: everything that differs between the English and
 * the Chinese telling of the same piece. `key` is the media's identity.
 */
export type TrackVersion = {
  key: string;
  language?: TrackLanguage;
  date?: string;
  url: string;
  title: string;
  subtitle?: string;
  thumbnail: string | null;
  href?: string;
} & (
  | { kind: "video"; platform: VideoPlatform; videoId: string | null }
  | { kind: "slides"; platform?: never; videoId?: never }
);

/**
 * A playable video. Derived from a commit's video media plus display
 * metadata (title / subtitle / cover) so the player chrome never needs the
 * commit itself.
 */
export interface VideoTrack extends TrackBase {
  kind: "video";
  platform: VideoPlatform;
  /**
   * YouTube video id when resolvable. Only YouTube tracks get JS-API control
   * (play / pause / seek / progress); other platforms play in a plain iframe.
   */
  videoId: string | null;
}

/**
 * An HTML slide deck (reveal.js). Plays in a plain iframe on the stage; the
 * deck drives itself — arrow keys, taps — so the theater draws no transport
 * for it. It still minimizes to the Live Activity like anything else on the
 * stage: the pill is a place to keep a deck open, not only a place to listen.
 */
export interface SlidesTrack extends TrackBase {
  kind: "slides";
  platform?: never;
  videoId?: never;
}

export type Track = VideoTrack | SlidesTrack;

/** A named shelf of the library — the theater's tabs. */
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
