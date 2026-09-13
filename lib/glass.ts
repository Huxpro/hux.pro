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
