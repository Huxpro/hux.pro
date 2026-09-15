import type { ChromeSyncOptions } from "../bezel";
import { CHROME_MORPH_PX, THEME_COLOR_ID } from "./constants";

// =============================================================================
// Chrome — the browser's own UI, kept in the colour the page asks for.
//
// Measured on iOS 26.5 Safari:
//
//   - At load, the chrome takes the root background (or fixed content at the
//     edge). After load it does NOT look at the root background again: a
//     bezel turned on, a tint changed or a theme flipped left the status bar
//     and toolbar in the old colour.
//   - It DOES follow `position: fixed` content at the viewport edge live, from
//     6 CSS px thick, and keeps that colour after the content goes.
//   - `theme-color` is ignored. iOS 18.5 is the reverse: it follows
//     `theme-color`, including a mutated one.
//
// So a change is shown to Safari as a morph of the bezel: a fixed bezel in the
// new colour grows to CHROME_MORPH_PX, holds while Safari samples it, and eases
// back to the band on screen.
//
// Two details are load-bearing, both measured:
//
//   - Each band and corner is its OWN fixed element with its own background.
//     One transparent full-screen fixed container holding coloured children
//     did not change the chrome at all: for a fixed element at the edge,
//     Safari samples what is composited beneath that element's box.
//   - The pieces are children of <html>, not <body>, so container scroll does
//     not make them absolute. The page's own bezel is absolute there, and
//     absolute content is not sampled.
// =============================================================================

const GROW_MS = 160;
const HOLD_MS = 440;
const SHRINK_MS = 280;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

let current: { parts: HTMLElement[]; timers: number[] } | null = null;

function themeColorMeta(): HTMLMetaElement {
  let meta = document.getElementById(THEME_COLOR_ID) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.id = THEME_COLOR_ID;
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  return meta;
}

/** Set `theme-color` without touching Safari 26's chrome. */
export function setThemeColor(color: string): void {
  const meta = themeColorMeta();
  if (meta.content !== color) meta.content = color;
}

function cancel(): void {
  if (!current) return;
  current.timers.forEach((t) => window.clearTimeout(t));
  current.parts.forEach((part) => part.remove());
  current = null;
}

function fixed(css: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = `position:fixed;pointer-events:none;z-index:2147483647;${css}`;
  document.documentElement.appendChild(el);
  return el;
}

export function syncChrome(color: string, options: ChromeSyncOptions = {}): void {
  if (typeof document === "undefined") return;
  setThemeColor(color);

  // A second change within the morph replaces the first.
  cancel();

  const band = Math.max(0, options.band ?? 0);
  const radius = Math.max(0, options.radius ?? 0);
  const peak = Math.max(band, CHROME_MORPH_PX);

  // Every piece is its OWN fixed element with its own background. Measured on
  // iOS 26.5: for a fixed element at the edge Safari samples that element's
  // box as composited — a transparent full-screen container with coloured
  // children does not work, two fixed bars do.
  const top = fixed(`left:0;right:0;top:0;height:${band}px;background:${color}`);
  const bottom = fixed(`left:0;right:0;bottom:0;height:${band}px;background:${color}`);
  const corners =
    radius > 0
      ? (
          [
            ["top", "left", "100% 100%"],
            ["top", "right", "0 100%"],
            ["bottom", "left", "100% 0"],
            ["bottom", "right", "0 0"],
          ] as const
        ).map(([v, h, at]) =>
          fixed(
            `${v}:${band}px;${h}:0;width:${radius}px;height:${radius}px;background:radial-gradient(circle at ${at}, transparent 0 ${radius - 0.5}px, ${color} ${radius}px)`
          )
        )
      : [];

  const setBand = (px: number, ms: number) => {
    const transition = `${ms}ms ${EASE}`;
    for (const bar of [top, bottom]) {
      bar.style.transition = `height ${transition}`;
      bar.style.height = `${px}px`;
    }
    corners.forEach((corner, i) => {
      const side = i < 2 ? "top" : "bottom";
      corner.style.transition = `${side} ${transition}`;
      corner.style[side] = `${px}px`;
    });
  };

  // Commit the starting band, then grow, hold while Safari samples, shrink.
  void top.offsetHeight;
  setBand(peak, GROW_MS);
  current = {
    parts: [top, bottom, ...corners],
    timers: [
      window.setTimeout(() => setBand(band, SHRINK_MS), GROW_MS + HOLD_MS),
      window.setTimeout(cancel, GROW_MS + HOLD_MS + SHRINK_MS),
    ],
  };
}
