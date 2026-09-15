// =============================================================================
// Ambient System — the ambient background and everything derived from it.
//
// The background is a single wallpaper stack fed by one source at a time:
// the live weather/sun-event gradient, or a picture wallpaper from the
// built-in catalog (lib/wallpaper.ts). Weather is a kind of wallpaper, not a
// separate background system — which is what makes the two mutually exclusive
// without any arbitration.
// =============================================================================

// Provider and hooks
export {
  AmbientProvider,
  useLocation,
  useWeather,
  useAmbientTime,
  useSolarTheme,
  useWallpaper,
  useOptionalWallpaper,
} from "./provider";

// Components
export {
  AmbientGreeting,
  AmbientSurface,
  AmbientPhaseActivity,
  MoonPhaseIcon,
  SolarThemeSync,
  SolarThemeToast,
  WallpaperBackground,
  WallpaperSheet,
  TiltPrimerSheet,
  WeatherIcon,
  WeatherWidget,
  WeatherNow,
  useDisplayWeather,
} from "./components";

// Lib (for advanced usage / devtool panel)
export * from "./lib";
