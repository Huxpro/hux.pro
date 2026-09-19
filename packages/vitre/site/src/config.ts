// =============================================================================
// Demo configuration: every knob vitre has, as one serialisable object.
//
// The demo page renders <Bezel> from it, the devtool edits it, the docs page
// drives it through postMessage, and the boot resolver reads the saved copy
// before first paint. Nothing here knows about the hux.pro site.
// =============================================================================

import type { BezelScroll } from "vitre";
import { DEFAULT_CONFIG, GROUND, STORAGE_KEY, type DemoConfig } from "./defaults";

export {
  DEFAULT_CONFIG,
  GROUND,
  type Backdrop,
  type ColorMode,
  type DemoConfig,
  type ScrollMode,
  type ThemeMode,
} from "./defaults";

export function resolveColor(config: DemoConfig, theme: "light" | "dark"): string {
  switch (config.colorMode) {
    case "black":
      return "#000000";
    case "dark":
      return GROUND.dark;
    case "theme":
      return GROUND[theme];
    case "custom":
      return config.customColor;
  }
}

/**
 * Container scroll wherever the bezel is on: that is what keeps a band thinner
 * than CHROME_SAMPLE_PX in step with the chrome, and the toolbar still.
 */
export function resolveScroll(config: DemoConfig): BezelScroll {
  if (config.scroll !== "auto") return config.scroll;
  return config.enabled ? "container" : "window";
}

// -----------------------------------------------------------------------------
// Persistence — only the standalone demo saves; the phone inside the docs page
// is driven by the docs and starts from the defaults every time.
// -----------------------------------------------------------------------------

export function isFramed(): boolean {
  return new URLSearchParams(location.search).has("frame");
}

export function loadConfig(): DemoConfig {
  if (isFramed()) return DEFAULT_CONFIG;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<DemoConfig>;
    return { ...DEFAULT_CONFIG, ...saved };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: DemoConfig): void {
  if (isFramed()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Private mode: the demo still works, it just does not remember.
  }
}

// -----------------------------------------------------------------------------
// Which page this is
// -----------------------------------------------------------------------------

/**
 * The demo itself on a phone or inside the docs' phone frame; the docs page on
 * anything wider. The boot resolver repeats this test in plain JS.
 */
export function isDemoPage(): boolean {
  return isFramed() || matchMedia("(max-width: 767px)").matches;
}

// -----------------------------------------------------------------------------
// Messages between the docs page and the phone
// -----------------------------------------------------------------------------

export type DemoAction = "scroll-top" | "scroll-middle" | "scroll-bottom" | "reset";

export type ToPhone =
  | { type: "bezel-demo:patch"; patch: Partial<DemoConfig> }
  | { type: "bezel-demo:action"; action: DemoAction }
  | { type: "bezel-demo:lang"; lang: "en" | "zh" };

/** Sent by the phone on every page scroll, so the docs can move its toolbar. */
export interface PhoneScroll {
  type: "bezel-demo:scroll";
  top: number;
  scroll: BezelScroll;
  /** Whether the user scrolled, rather than the page scrolling itself. */
  user: boolean;
}

export interface PhoneReport {
  type: "bezel-demo:report";
  theme: "light" | "dark";
  state: Record<string, unknown>;
  themeColor: string | null;
  scrollTop: number;
}
