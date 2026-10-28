---
name: ui-tokens
description: The colour, text and material rules every visible change on hux.pro follows - ink-at-alpha text rungs, glass for floating surfaces, typography roles, text on the wallpaper, touch states. Use when writing or reviewing any UI: text colour, washes, borders, underlines, a surface's background, hover/press states.
---

# UI tokens

Text and washes are `--ink` at an alpha, so they hold up on every wallpaper
and tint. A fixed grey breaks that, and so does `/NN` on a *text* token (it
scales the wallpaper boost down). `/NN` on a wash (`bg-muted/50`,
`border-border/50`) is fine.

- **Text rungs**: `text-foreground`, `text-reading-foreground` (running
  text), `text-muted-foreground` (text that *is* the information),
  `text-tertiary-foreground` (annotates a neighbour: a date, a caption),
  `text-quaternary-foreground` (carries no information: separators). Ink at
  54 / 32 / 20 % (dark 60 / 36 / 22 %) plus the wallpaper boost. Never
  `text-muted-foreground/NN`: pick the rung.
- **Underlines**: `decoration-ink-line`, never `decoration-<token>/NN`
  (Safari draws no `color-mix()` there: invisible on iPhone).
- **Floating surfaces** paint with glass: `bg-glass`, `-strong` (each with a
  `-hover`), `-overlay`, `-sheet`, `-popover`, or `GLASS_PANEL` /
  `GLASS_CAPSULE` (`lib/glass.ts`). `bg-card/…` and `bg-popover/…` are a lint
  error outside `lib/glass.ts` (`no-restricted-syntax`, `eslint.config.mjs`).
- **Roles**: recurring recipes are in `lib/typography.ts` (`TYPE.label`,
  `TYPE.rowMeta`, `TYPE.kbd`, …). Use one where it fits.
- **On the wallpaper**: text sitting directly on it goes in an `.ink-bare`
  (top band) or `.ink-bare-mid` (middle band) zone: it gets the bare boost,
  relief and the flip. `.ink-flat` drops the shadow (an inverted chip, code).
  A new zone that swaps `--ink` must join THE LADDER's selector list in
  `app/globals.css`, or its rungs keep the root's ink.
- **Touch**: `hover:` only fires with a mouse. Anything with a hover wash
  also gets `pressable` and an `active:` colour.
- Greyscale palette; don't introduce colours.

Run `pnpm lint`. More: `docs/system-legibility.md`, `docs/system-glass.md`,
`docs/design-system.md`.
