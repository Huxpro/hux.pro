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

/** Simplified player state for the UI */
export type PlayerState =
  | "idle" // No player / not initialized
  | "loading" // API loading or buffering
  | "playing"
  | "paused"
  | "ended"
  | "error";
