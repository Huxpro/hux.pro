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
  SITE_STYLES,
  STYLE_BOOT,
  STYLE_GROUND,
  getStyleLabel,
  isSiteStyle,
  type SiteStyle,
} from "./style-core";
export { StyleRootSync, nextSiteStyle, setSiteStyle, useSiteStyle } from "./style";
export { ThemeProvider, useSunThemeSlot, useTheme, type ThemePreference } from "./theme";
export { VisitorProvider, useVisitor, type LastVisitedItem } from "./visitor";
