---
name: ui-tokens
description: The colour, text and material rules every visible change on hux.pro follows - ink-at-alpha text rungs, glass for floating surfaces, typography roles, text on the wallpaper, touch states. Use when writing or reviewing any UI: text colour, washes, borders, underlines, a surface's background, hover/press states.
---

# UI tokens

Text and washes are `--ink` at an alpha, so they hold up on every wallpaper
and tint. A fixed grey, or an opacity on a token, breaks that.

- **Text rungs**: `text-foreground`, `text-reading-foreground` (running
  text), `text-muted-foreground` (text that *is* the information),
  `text-tertiary-foreground` (annotates a neighbour: a date, a caption),
  `text-quaternary-foreground` (carries no information: separators). Never
  `text-muted-foreground/NN`: pick the rung.
- **Underlines**: `decoration-ink-line`, never `decoration-<token>/NN`
  (Safari draws no `color-mix()` there: invisible on iPhone).
- **Floating surfaces** paint with glass: `bg-glass`, `-strong`, `-overlay`,
  `-sheet`, `-popover`, or `GLASS_PANEL` / `GLASS_CAPSULE` (`lib/glass.ts`).
  `bg-card/…` and `bg-popover/…` are a lint error outside `lib/glass.ts`.
- **Roles**: recurring recipes are in `lib/typography.ts` (`TYPE.label`,
  `TYPE.rowMeta`, `TYPE.kbd`, …). Use one where it fits.
- **On the wallpaper**: text sitting directly on it goes in an `.ink-bare`
  (or `.ink-bare-mid`) zone.
- **Touch**: `hover:` only fires with a mouse. Anything with a hover wash
  also gets `pressable` and an `active:` colour.
- Greyscale palette; don't introduce colours.

Run `pnpm lint`. More: `docs/system-legibility.md`, `docs/system-glass.md`,
`docs/design-system.md`.
