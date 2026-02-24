// =============================================================================
// Music System Settings — localStorage persistence
// =============================================================================

/** YouTube Music playlist ID from environment */
export const PLAYLIST_ID =
  process.env.NEXT_PUBLIC_YOUTUBE_PLAYLIST_ID ?? "";

export interface MusicSettings {
  enabled: boolean;
}

const SETTINGS_KEY = "hux_music_settings";

export function getDefaultMusicSettings(): MusicSettings {
  return { enabled: true };
}

export function getMusicSettings(): MusicSettings {
  if (typeof window === "undefined") return getDefaultMusicSettings();
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return getDefaultMusicSettings();
    const parsed = JSON.parse(stored) as Partial<MusicSettings>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
    };
  } catch {
    return getDefaultMusicSettings();
  }
}

export function setMusicSettings(settings: MusicSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}
