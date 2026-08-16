// =============================================================================
// Music System — Types
// =============================================================================

/** A track currently loaded in the player */
export type MusicTrack = {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
};

/**
 * One entry of the loaded playlist. Video IDs come from the player at
 * runtime (authoritative order); title/author are resolved lazily from
 * oEmbed and may be null until (or unless) resolution succeeds.
 */
export type PlaylistEntry = {
  videoId: string;
  title: string | null;
  author: string | null;
  thumbnailUrl: string;
};

/** Simplified player state for the UI */
export type PlayerState =
  | "idle" // No player / not initialized
  | "loading" // API loading or buffering
  | "playing"
  | "paused"
  | "ended"
  | "error";
