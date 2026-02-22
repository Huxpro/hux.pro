// =============================================================================
// Services - Simple global state providers (no UI)
// =============================================================================

export { ThemeProvider, useTheme } from "./theme";
export {
  LocaleProvider,
  useLocale,
  t,
  translations,
  localeNames,
  locales,
  defaultLocale,
  type Locale,
  type TranslationKey,
} from "./locale";
export {
  VisitorProvider,
  useVisitor,
  type LastVisitedItem,
} from "./visitor";
export { InputCapabilityProvider, useInputCapability } from "./input-capability";
