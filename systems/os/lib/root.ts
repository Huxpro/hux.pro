import {
  DEFAULT_OS_THEME,
  getOsPlatform,
  getThemeMetadata,
  isOsThemeId,
  type OsThemeId,
  type ThemeMetadata,
} from "../themes";

// =============================================================================
// The theme on <html> — the one place the attributes are written after boot,
// and the one place code outside React reads them back.
//
//   data-os-theme     the theme id; every overlay rule and the `hux:` /
//                     `android:` variants key off it
//   data-os-platform  its family (apple / android), for rules a future theme
//                     of the same family would share
// =============================================================================

export function applyRootOsTheme(id: OsThemeId) {
  const root = document.documentElement;
  root.dataset.osTheme = id;
  root.dataset.osPlatform = getOsPlatform(id);
}

/**
 * The theme in force, read from <html>: for listeners and helpers that run
 * outside React (the ripple, haptics, the container transform). Falls back
 * to the default where nothing is set, which is what the page shows too.
 */
export function currentOsTheme(): OsThemeId {
  if (typeof document === "undefined") return DEFAULT_OS_THEME;
  const v = document.documentElement.dataset.osTheme;
  return isOsThemeId(v) ? v : DEFAULT_OS_THEME;
}

/** The metadata of the theme in force (see `currentOsTheme`). */
export function currentThemeMetadata(): ThemeMetadata {
  return getThemeMetadata(currentOsTheme());
}
