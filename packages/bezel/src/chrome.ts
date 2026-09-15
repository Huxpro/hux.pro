import { CHROME_SAMPLE_PX, THEME_COLOR_ID } from "./constants";

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
// So a change is shown to Safari: strips of the new colour at the top and
// bottom edges for a moment, and `theme-color` for iOS 18. The strips are
// children of <html>, not <body>, so container scroll does not make them
// absolute.
// =============================================================================

const STRIP_PX = CHROME_SAMPLE_PX + 2;
const STRIP_MS = 600;

let strips: HTMLElement[] = [];
let stripTimer: number | undefined;

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

export function syncChrome(color: string): void {
  if (typeof document === "undefined") return;
  setThemeColor(color);

  // A second change within the window replaces the first's strips.
  window.clearTimeout(stripTimer);
  strips.forEach((el) => el.remove());
  strips = (["top", "bottom"] as const).map((edge) => {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = `position:fixed;left:0;right:0;${edge}:0;height:${STRIP_PX}px;background:${color};z-index:2147483647;pointer-events:none`;
    document.documentElement.appendChild(el);
    return el;
  });
  stripTimer = window.setTimeout(() => {
    strips.forEach((el) => el.remove());
    strips = [];
  }, STRIP_MS);
}
