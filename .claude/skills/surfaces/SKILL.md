---
name: surfaces
description: How to add a sheet, panel, window or popover on hux.pro, or tell the visitor something in one line. Use when building UI that opens over the page, choosing a sheet's height, or about to reach for a toast, modal or dialog. (Editing the sheet primitive itself is the base-ui-drawer skill.)
---

# Surfaces

- **Declare, don't branch on the viewport.** `<AdaptiveSurface presentation=…>`
  picks the shape per breakpoint: `ADAPTIVE_PRESENTATION` (sheet → panel →
  window), `ANCHORED_PRESENTATION` (sheet → popover; pass
  `popover={{ anchor }}`), both in `systems/surface/presentation.ts`; any other
  map is written inline. A surface that can be a window registers its `id` in
  `DRAGGABLE_DEFAULTS` (or it never drags) and `DRAGGABLE_INSTANCES`, both in
  `systems/devtool/provider.tsx`. `useSurfaceContext()` answers container
  questions (columns, density), never "is this a phone".
- **Sheet heights.** `snapPoints={SHEET_DETENTS}` for a list,
  `height={detentHeight(1)}` for a full fixed sheet, `fitContent` for one
  short thing.
- **Non-modal by default**: no scrim, the page stays live. `modal` is for a
  launcher like the palette.
- **Measure with `offsetTop` / `offsetHeight`**, not
  `getBoundingClientRect`: a receded sheet is `scale()`d.
- **A sheet over a sheet with a text field** passes `restoreFocus={false}`.
- **One-line messages** are `showNotice({ id, icon, title, … })` from
  `@/systems/dock`, at the top. There is no bottom toast (it covered the ⌘K
  bar), and a notice offers no choices: anything that asks is a sheet.
- **Shape says what it is**: a capsule (`GLASS_CAPSULE`) is one line to
  glance at; a rounded rectangle is for reading or acting.
- A field inside any of these: the keyboard-input skill.

More: `docs/system-surface.md`, `docs/system-dock.md` (notices).
