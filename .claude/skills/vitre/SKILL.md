---
name: vitre
description: The vitre package (packages/vitre) - the page's edge on iOS Safari - bezel, container scroll, browser chrome colour. Use when touching page scroll, scroll-driven CSS, full-screen fixed layers, theme-color, the bezel, a scroll-lock or overlay library, or the package itself, its demo or its lab docs.
---

# vitre

With the bezel on an iPhone, the page scrolls in a container, not the
window. Code that assumes window scroll breaks there and only there.

- **API**: `packages/vitre/vitre.d.ts` is the public contract (the
  implementation is type-checked against it). Every export and prop also
  needs an entry in `packages/vitre/site/src/docs/api.ts`, or
  `pnpm vitre:typecheck` and `next build` fail.
- **Scroll**: `pageScrollTop()`, `scrollPageTo()`, `onPageScroll()`,
  `usePageScroll()`, never `window.scrollY` / `window.scrollTo`. In container
  scroll a `window.scrollTo(0)` reads as a status-bar tap.
- **Scroll-driven CSS**: `animation-timeline: --page-scroll`
  (`PAGE_SCROLL_TIMELINE`) or `scroll(nearest)`; `scroll(root)` is silent in
  container scroll.
- **Full-screen layers**: in container scroll `body > .fixed` turns absolute;
  any other full-screen layer carries `VITRE_LAYER_ATTRIBUTE`.
- **Chrome colour**: iOS 26 Safari ignores later `theme-color` changes and
  never re-reads the root background; vitre's `syncChrome` morphs the bezel
  bands to show a change (iOS only).
- **Libraries** that lock scroll by sizing `<body>` collapse the layout in
  container scroll. Check before adopting one.
- **This site's settings** live in `systems/ambient/lib/bezel.ts` only (bezel
  on/off per wallpaper family: `WALLPAPER_FAMILY_EDGES`).

Demo: `pnpm vitre:site` (`pnpm dev` rebuilds it only when stale). More:
`packages/vitre/README.md` (the measured Safari findings), `docs/system-lab.md`.
