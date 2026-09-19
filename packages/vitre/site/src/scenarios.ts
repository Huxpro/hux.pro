import { BEZEL_BAND_MAX, BEZEL_RADIUS_MAX } from "vitre";
import type { DemoAction, DemoConfig } from "./config";

// =============================================================================
// Scenarios: small scripted demonstrations of one feature each. The docs page
// runs one per section into the phone; the demo page runs them from its cards.
// A scenario returns its own cancel.
// =============================================================================

export interface ScenarioHost {
  patch(patch: Partial<DemoConfig>): void;
  action(action: DemoAction): void;
  /** Tap the status bar. Only the docs' phone has one to tap. */
  statusTap(): void;
}

export interface Scenario {
  /** The config the scenario starts from, over the defaults. */
  base?: Partial<DemoConfig>;
  run?(host: ScenarioHost): () => void;
  /**
   * On a phone, where the user performs the gesture themselves: what the card
   * sets up instead of `run`.
   */
  onPhone?(host: ScenarioHost): () => void;
}

function every(ms: number, steps: ((host: ScenarioHost) => void)[]) {
  return (host: ScenarioHost) => {
    let i = 0;
    steps[0](host);
    const id = window.setInterval(() => {
      i = (i + 1) % steps.length;
      steps[i](host);
    }, ms);
    return () => window.clearInterval(id);
  };
}

function wave(key: "band" | "radius", max: number, periodMs: number) {
  return (host: ScenarioHost) => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % periodMs) / periodMs;
      host.patch({ [key]: Math.round(((1 - Math.cos(t * Math.PI * 2)) / 2) * max) });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  };
}

export const SCENARIOS = {
  intro: {},
  enabled: {
    run: every(1800, [(h) => h.patch({ enabled: true }), (h) => h.patch({ enabled: false })]),
  },
  band: { run: wave("band", Math.min(40, BEZEL_BAND_MAX), 3200) },
  radius: { run: wave("radius", Math.min(48, BEZEL_RADIUS_MAX), 3200) },
  color: {
    run: every(1800, [
      (h) => h.patch({ colorMode: "black" }),
      (h) => h.patch({ colorMode: "custom", customColor: "#c1440e" }),
      (h) => h.patch({ colorMode: "custom", customColor: "#2d5a3d" }),
      (h) => h.patch({ colorMode: "dark" }),
    ]),
  },
  theme: {
    base: { colorMode: "theme" },
    run: every(2200, [(h) => h.patch({ theme: "light" }), (h) => h.patch({ theme: "dark" })]),
  },
  // Container, then window. The page scrolls itself here, so the docs'
  // simulated toolbar holds, as Safari's does, until the scroll reaches the top.
  scroll: {
    run: every(1600, [
      (h) => h.patch({ scroll: "container" }),
      (h) => h.action("scroll-middle"),
      (h) => h.action("scroll-top"),
      (h) => h.patch({ scroll: "window" }),
      (h) => h.action("scroll-middle"),
      (h) => h.action("scroll-top"),
    ]),
  },
  backdrop: {
    run: every(1800, [
      (h) => h.patch({ backdrop: "aurora" }),
      (h) => h.patch({ backdrop: "sunset" }),
      (h) => h.patch({ backdrop: "none" }),
    ]),
  },
  chrome: {
    run: every(2000, [
      (h) => h.patch({ enabled: true, colorMode: "black" }),
      (h) => h.patch({ enabled: false }),
      (h) => h.patch({ enabled: true, colorMode: "custom", customColor: "#2d5a3d" }),
      (h) => h.patch({ enabled: false }),
    ]),
  },
  boot: {},
  // The docs phone's status bar is tapped for you; on a phone, the card scrolls
  // down and leaves the tap to you.
  statusTap: {
    base: { scroll: "container" },
    run: every(2400, [(h) => h.action("scroll-bottom"), (h) => h.statusTap()]),
    onPhone: (h) => {
      h.action("scroll-bottom");
      return () => {};
    },
  },
  pageScroll: {
    run: every(1500, [
      (h) => h.action("scroll-middle"),
      (h) => h.action("scroll-bottom"),
      (h) => h.action("scroll-top"),
    ]),
  },
  state: {},
  api: {},
  safari: {},
} satisfies Record<string, Scenario>;

export type ScenarioName = keyof typeof SCENARIOS;
