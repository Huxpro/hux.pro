// =============================================================================
// Services - Simple global state providers (no UI)
// =============================================================================

export {
  InputCapabilityProvider,
  useInputCapability,
} from "./input-capability";
export {
  LocaleProvider,
  defaultLocale,
  localeNames,
  locales,
  t,
  translations,
  useLocale,
  type Locale,
  type TranslationKey,
} from "./locale";
export {
  GLASS_MATERIALS,
  GlassProvider,
  getGlassLabel,
  useGlass,
  type GlassMaterial,
  GLASS_TINTS,
  getTintLabel,
  type GlassTint,
} from "./glass";
export {
  DEFAULT_SKIN,
  SKINS,
  SkinProvider,
  getSchemeStyleLabel,
  getSkinLabel,
  useOptionalSkin,
  useSkin,
  type Skin,
} from "./skin";
export { ThemeProvider, useSunThemeSlot, useTheme, type ThemePreference } from "./theme";
export { VisitorProvider, useVisitor, type LastVisitedItem } from "./visitor";
