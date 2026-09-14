// =============================================================================
// Bezel — the boot decision, and keeping it on <html>.
//
// The boot script in app/layout.tsx decides the frame before first paint and
// writes it onto <html>: the `bezel` class, the lock class on iOS, the colour
// and band properties and an inline background. It also records the same
// decision here, on `window`, because <html> is not a safe place to keep it.
//
// React owns <html>. When hydration fails — any text the server rendered that
// the client renders differently, React error #418 — React 19 renders the
// whole app again on the client and strips every attribute off <html> first.
// Measured on a Vercel preview on iOS 26.5: `class` and `style` both removed at
// hydration, so the frame had no colour, the document was no longer locked,
// and the provider, reading the class after the wipe, decided there was no
// frame and drew no corners. A local build that happened to hydrate cleanly
// never showed it.
//
// So the decision lives on `window`, which React never touches. The provider
// reads it from there, and <Bezel> puts the attributes back whenever they go
// missing. Nothing is re-decided: the same colour and lock go back on, so the
// page still keeps one frame for its whole life.
// =============================================================================

import { BEZEL_BAND_VAR, BEZEL_CLASS, BEZEL_COLOR_VAR } from "./metrics";
import { BEZEL_LOCK_CLASS } from "./page-scroll";

/** Property on `window` the boot script records its decision under. */
export const BEZEL_BOOT_GLOBAL = "__huxBezel";
/** Id of the `theme-color` meta the boot script creates. */
export const BEZEL_THEME_COLOR_ID = "hux-theme-color";

/** What the boot script decided, when it decided to frame the page. */
export interface BezelBootDecision {
  /** The frame colour, as painted. */
  color: string;
  /** The band at load, px. The live band comes from <Bezel>'s prop. */
  band: number;
  /** Whether the document is locked (iOS). */
  lock: boolean;
}

/** The boot script's decision, or `null` when the page is not framed. */
export function readBezelBoot(): BezelBootDecision | null {
  if (typeof window === "undefined") return null;
  const value = (window as unknown as Record<string, unknown>)[BEZEL_BOOT_GLOBAL];
  if (!value || typeof value !== "object") return null;
  const { color, band, lock } = value as Partial<BezelBootDecision>;
  if (typeof color !== "string" || typeof band !== "number") return null;
  return { color, band, lock: lock === true };
}

function isApplied(root: HTMLElement, boot: BezelBootDecision): boolean {
  return (
    root.classList.contains(BEZEL_CLASS) &&
    (!boot.lock || root.classList.contains(BEZEL_LOCK_CLASS)) &&
    root.style.getPropertyValue(BEZEL_COLOR_VAR) !== "" &&
    document.getElementById(BEZEL_THEME_COLOR_ID) !== null
  );
}

/** Write the boot decision onto the root element, as the boot script did. */
export function applyBezelBoot(
  root: HTMLElement,
  boot: BezelBootDecision,
  band: number
): void {
  root.classList.add(BEZEL_CLASS);
  if (boot.lock) root.classList.add(BEZEL_LOCK_CLASS);
  root.style.setProperty(BEZEL_COLOR_VAR, boot.color);
  root.style.setProperty(BEZEL_BAND_VAR, `${band}px`);
  root.style.backgroundColor = boot.color;
  if (!document.getElementById(BEZEL_THEME_COLOR_ID)) {
    const meta = document.createElement("meta");
    meta.id = BEZEL_THEME_COLOR_ID;
    meta.name = "theme-color";
    meta.content = boot.color;
    document.head.appendChild(meta);
  }
}

/**
 * Put the boot decision back whenever it goes missing from the root element,
 * now and for as long as this runs. Returns the cleanup.
 *
 * A mutation observer's callback runs before the next paint, so a wipe is
 * repaired in the same frame it happened in. The repair's own writes trigger
 * the observer once more, find everything in place, and stop.
 */
export function keepBezelBoot(
  root: HTMLElement,
  boot: BezelBootDecision,
  currentBand: () => number
): () => void {
  const restore = () => {
    if (!isApplied(root, boot)) applyBezelBoot(root, boot, currentBand());
  };
  restore();
  const observer = new MutationObserver(restore);
  observer.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
  return () => observer.disconnect();
}
