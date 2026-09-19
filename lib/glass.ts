// =============================================================================
// Glass recipes — the class strings that make a surface System glass.
//
// A surface only follows the Glass material setting (Tinted / Clear, see
// docs/system-glass.md) if it paints with the `--glass*` tokens. A surface that
// hardcodes its own `bg-card/NN` simply will not respond — it stays an opaque
// slab beside washed-out neighbours, which is the bug the tokens exist to
// prevent. `no-restricted-syntax` in eslint.config.mjs enforces that.
//
// Only recipes used by more than one surface belong here. A one-off surface
// should just write `bg-glass…` inline.
// =============================================================================

/**
 * The lifted translucent panel — the Dock Live Activity's expanded state, and
 * anything that wants to look like it. Deliberately no shadow: the shadow
 * belongs to whatever is the *visible* surface, so callers opt into
 * `shadow-raised` themselves.
 */
export const GLASS_PANEL =
  "rounded-lg border border-border/50 bg-glass-overlay backdrop-blur-xl";

/**
 * The chip a glyph gets when it sits on artwork rather than on a surface —
 * a wallpaper tile's Live / Preset mark, the mark a media cover wears
 * (components/log/media/media-mark.tsx). One recipe, so a chip on a picture
 * arrives the same way wherever the picture is.
 */
export const ARTWORK_CHIP =
  "bg-black/35 text-white ring-1 ring-white/25 backdrop-blur-[2px]";

/**
 * The same chip at rest — a cover on the page, not yet looked at. Lighter,
 * so a row of covers is not a row of stamps; the cover's hover raises it to
 * `ARTWORK_CHIP`, and a cover standing alone in a peek is raised from the
 * start (media-mark.tsx).
 */
export const ARTWORK_CHIP_REST =
  "bg-black/20 text-white/85 ring-1 ring-white/10 backdrop-blur-[2px]";
