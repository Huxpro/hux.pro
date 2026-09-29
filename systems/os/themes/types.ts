// =============================================================================
// OS themes — what a theme *is*, as data.
//
// A theme here is the platform the site is drawn as: its surfaces, its type,
// how it answers a touch, how it moves. The registry (./index.ts) holds one
// object per theme, and this file says what every one of them must declare.
//
// Visual values are not here. Colours, radii, shadows and type live in CSS —
// the Hux theme is the site's own stylesheet, the Android theme's overlay is
// app/themes/android/ — because CSS is where they can switch before first
// paint without a render. What lives here is what code needs to *decide*:
// metadata that replaces every `theme === "android"` a component would
// otherwise write (the pattern ryOS's `ThemeMetadata` settled on).
// =============================================================================

import type { TranslationKey } from "@/lib/i18n";

export type OsThemeId = "hux" | "android";

/** The family a theme draws from — `data-os-platform` on <html>. */
export type OsPlatform = "apple" | "android";

export interface ThemeMetadata {
  platform: OsPlatform;
  /** How a press is answered: iOS's touch-down wash, or Android's ripple. */
  pressFeedback: "wash" | "ripple";
  /** The home grid's edit mode: every card jiggling, or the one worked on framed. */
  editMode: "jiggle" | "frame";
  /** How the grid reflows: the site's tween, or Material's expressive springs. */
  layoutMotion: "tween" | "spring";
  /** Whether the grid answers pickup, resize steps and drop with the motor. */
  haptics: boolean;
  /** Whether the palette is generated from the wallpaper (Material You). */
  dynamicColor: boolean;
  /** How a widget opens its page: a crossfade, or Material's container transform. */
  openPage: "crossfade" | "container-transform";
  /**
   * The theme's own material setting, offered only while it is active: the
   * Hux theme's Glass (Tinted / Clear), the Android theme's Wallpaper colors.
   */
  materialSetting: "glass" | "wallpaper-colors";
}

export interface OsTheme {
  id: OsThemeId;
  /** Its name in the UI ("Hux", "Android"). */
  label: TranslationKey;
  metadata: ThemeMetadata;
}
