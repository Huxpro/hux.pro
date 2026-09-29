// =============================================================================
// Skin System — the platform the home screen's widgets are drawn in.
//
// The setting lives in services/skin.tsx (like glass); this system owns what
// the Material skin needs beyond a stylesheet: the dynamic-color scheme from
// the wallpaper (lib/scheme.ts) and the bridge that publishes it.
//
// See docs/system-skin.md.
// =============================================================================

export { DynamicColorBridge } from "./components/dynamic-color-bridge";
export { MaterialRipple } from "./components/material-ripple";
export { haptic, type Haptic } from "./lib/haptics";
export {
  FALLBACK_SEED,
  SCHEME_STYLES,
  schemeRoles,
  seedFromTint,
  type SchemeStyle,
} from "./lib/scheme";
export { ExpressiveShape } from "./components/expressive-shape";
export { SHAPES, shapePath, starPath, type ShapeName } from "./lib/shapes";
