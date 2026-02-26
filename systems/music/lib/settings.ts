// =============================================================================
// Music System Settings — localStorage persistence
// =============================================================================

/** YouTube Music playlist ID (public playlist, hardcoded) */
export const PLAYLIST_ID = "PL-jBC8h6o17TB-M8F9ekiJWJZjGnhD18H";

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
