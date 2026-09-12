// =============================================================================
// Ambient System - Weather-based ambient UI
// =============================================================================

// Provider and hooks
export {
  AmbientProvider,
  useLocation,
  useWeather,
  useOptionalWeather,
  useAmbientTime,
} from "./provider";

// Components
export {
  AmbientGreeting,
  AmbientSurface,
  AmbientPhaseActivity,
  WeatherGradientBackground,
  WeatherIcon,
  WeatherWidget,
  WeatherNow,
  useDisplayWeather,
} from "./components";

// Lib (for advanced usage / devtool panel)
export * from "./lib";
