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
export { ThemeProvider, useTheme } from "./theme";
export { VisitorProvider, useVisitor, type LastVisitedItem } from "./visitor";
