import { android } from "./android";
import { hux } from "./hux";
import type { OsPlatform, OsTheme, OsThemeId, ThemeMetadata } from "./types";

// =============================================================================
// The theme registry. Adding a theme is: an object here, its CSS overlay in
// app/themes/<id>/, its label in lib/i18n.ts — and `pnpm themes:check`
// (scripts/check-themes.mjs) says whether the overlay is properly scoped.
// =============================================================================

export const OS_THEMES: Record<OsThemeId, OsTheme> = { hux, android };

export const OS_THEME_IDS = Object.keys(OS_THEMES) as OsThemeId[];

/** The theme a visitor who never chose sees: Android (Material 3 Expressive). */
export const DEFAULT_OS_THEME: OsThemeId = "android";

export function isOsThemeId(value: unknown): value is OsThemeId {
  return typeof value === "string" && value in OS_THEMES;
}

export function getThemeMetadata(id: OsThemeId): ThemeMetadata {
  return OS_THEMES[id].metadata;
}

export function getOsPlatform(id: OsThemeId): OsPlatform {
  return OS_THEMES[id].metadata.platform;
}

/** The theme after this one, for the command palette's toggle. */
export function nextOsTheme(id: OsThemeId): OsThemeId {
  const i = OS_THEME_IDS.indexOf(id);
  return OS_THEME_IDS[(i + 1) % OS_THEME_IDS.length];
}

export type { OsPlatform, OsTheme, OsThemeId, ThemeMetadata } from "./types";
