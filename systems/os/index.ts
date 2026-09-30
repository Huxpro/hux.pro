// =============================================================================
// OS System — the platform the site is drawn as (Hux or Android).
//
// The setting lives in services/os-theme.tsx; the registry of themes and
// their metadata in ./themes; the boot script and the <html> attributes in
// ./lib; the slot for structure that differs by theme in ./components. What
// the Android theme needs beyond its stylesheet (app/themes/android/) is in
// ./android: dynamic colour, the ripple, haptics, Expressive shapes, the
// loading indicator, the container transform, Wallpaper colors.
//
// See docs/system-os-theme.md.
// =============================================================================

export {
  DEFAULT_OS_THEME,
  OS_THEMES,
  OS_THEME_IDS,
  getThemeMetadata,
  isOsThemeId,
  nextOsTheme,
  type OsTheme,
  type OsThemeId,
  type ThemeMetadata,
} from "./themes";
export { currentOsTheme, currentThemeMetadata } from "./lib/root";
export { Themed } from "./components/themed";

// The Android theme's implementation.
export { DynamicColorBridge } from "./android/components/dynamic-color-bridge";
export { MaterialRipple } from "./android/components/material-ripple";
export { haptic, type Haptic } from "./android/lib/haptics";
export {
  FALLBACK_SEED,
  SCHEME_STYLES,
  schemeRoles,
  seedFromTint,
  type SchemeStyle,
} from "./android/lib/scheme";
export { ExpressiveShape } from "./android/components/expressive-shape";
export { LoadingIndicator } from "./android/components/loading-indicator";
export { SHAPES, shapePath, starPath, type ShapeName } from "./android/lib/shapes";
