// =============================================================================
// Ambient System - Weather-based ambient UI
// =============================================================================

// Provider and hooks
export { AmbientProvider, useLocation, useWeather, useAmbientTime } from "./provider";

// Components
export {
  AmbientGreeting,
  AmbientSurface,
  WeatherGradientBackground,
  WeatherIcon,
  WeatherWidget,
} from "./components";

// Lib (for advanced usage / devtool panel)
export * from "./lib";
