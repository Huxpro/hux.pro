# @hux/bezel

A bezel around the page, the browser chrome kept in step with it, and a page
that can scroll in a container while the window stays locked. Built for iOS
Safari, where each of those is harder than it looks.

The public API is [`bezel.d.ts`](./bezel.d.ts). `src/contract.ts` fails the
type check if the implementation drifts from it.

## Words

| Word | Means | Never used for |
|---|---|---|
| **bezel** | The border drawn around the page: a band on each edge, rounded inner corners, one colour. | — |
| **chrome** | The browser's own UI: Safari's status bar and toolbar. | The bezel. |
| **scroll** | Where the page scrolls: `window`, or `container` with the window locked. | — |

"Frame" and "letterbox" are gone. They were two more names for the bezel.

## What iOS Safari does

Measured in the iOS 26.5 simulator by reading screenshot pixels, and checked
against the same builds on a phone. iOS 18.5 is noted where it differs.

| Behaviour | iOS 26.5 | iOS 18.5 |
|---|---|---|
| Chrome colour at load | The root background, or `position: fixed` content spanning the viewport edge (whose composited pixels it copies, even when the content is transparent) | `theme-color` |
| Chrome colour after a later change to the root background | Not re-read. The chrome keeps the old colour. | Not re-read |
| Chrome colour after a later change to `theme-color` | Ignored | Followed |
| Fixed content at the edge, added later | Followed live, from 6 CSS px thick (5 does not register), and the colour stays after the content is removed | — |
| Toolbar collapse | Only when the document scrolls. Each collapse re-samples the chrome. | Same |
| Safe-area insets in portrait | All 0 | All 0 |
| React 19 failed hydration (error #418) | Strips every attribute off `<html>` | Same |

## Does anything need a reload?

No. Everything is live, as long as each change is shown to the chrome.

The rule "one colour per page load" was a workaround for the second row
above, not a platform limit. `syncChrome(color, { band, radius })` shows Safari
the new colour as a morph of the bezel: a fixed bezel in the new colour grows
from the current band to 8px (160ms), holds (440ms), and eases back (280ms),
with its corners riding the inner edge. It sets `theme-color` for iOS 18 too.
`<Bezel>` calls it whenever the colour the chrome should show changes.

Two details make it work, both measured:

- **Each band is its own fixed element.** A transparent full-screen fixed
  container with coloured children did not change the chrome: Safari samples
  what is composited beneath a fixed element's box.
- **The pieces are children of `<html>`.** In container scroll, fixed children
  of `<body>` become absolute, and absolute content is not sampled.

A recording of the bezel turning on over a light page: the chrome eases from
white to black within one 50ms frame of the band reaching the edge, the 8px band
holds for about 450ms, and the chrome stays black after it shrinks to 0px.

| Change, without a reload | Without `syncChrome` | With it |
|---|---|---|
| Bezel turned on | Chrome stays the ground colour | Bezel colour |
| Bezel turned off | Chrome stays the bezel colour | Ground colour |
| Tint changed, black to dark | Not tested | Chrome `(26, 26, 26)` |
| Theme flipped, bezel colour following the theme | Chrome stays white | `(26, 26, 26)`, then white again |
| Theme flipped, bezel off | Chrome stays white | Chrome `(26, 26, 26)`, then white again |
| Theme flipped, bezel on | — | Chrome keeps the bezel colour, as it should |

## What is live, and how

Every prop of `<Bezel>` is live:

| Change | Mechanism |
|---|---|
| `enabled`, `color`, `band` | Written to `<html>` (`data-bezel`, `--bezel-color`, `--bezel-band`, background) in a layout effect. The chrome colour is resynced. |
| `radius` | Re-rendered corners. |
| `scroll` | `data-bezel-scroll="container"` on `<html>`. The scroll position moves between the window and the container, and page scroll listeners fire. |
| `ground` | The chrome colour is resynced while the bezel is off. |
| Something strips `<html>` | A mutation observer re-applies the state before the next paint. |

## Using it

```tsx
import { Bezel, BEZEL_INSET, BEZEL_LAYER_ATTRIBUTE, bezelBootScript } from "@hux/bezel";

// <head>: paint the first frame right, before React.
<script dangerouslySetInnerHTML={{ __html: bezelBootScript(resolverSource) }} />

// Around the page.
<Bezel
  enabled={on}          // null until the client knows; holds what the boot script applied
  color="#000000"
  band={0}
  radius={16}
  scroll={on && isIOS ? "container" : "window"}
  ground={theme === "dark" ? "#1a1a1a" : "#ffffff"}
  backdrop={<div {...{ [BEZEL_LAYER_ATTRIBUTE]: "" }} style={{ position: "fixed", ...BEZEL_INSET }} />}
>
  {page}
</Bezel>
```

In a component anywhere on the page:

```tsx
usePageScroll(() => measure());    // scroll in either mode
const { enabled, scroll } = useBezel();
```

Outside React, read and drive page scroll with `pageScrollTop`,
`scrollPageTo`, `onPageScroll` and the rest. `window.scrollY` reads 0 in
container scroll.

## Testing

```bash
pnpm bezel:typecheck
```

## Limits

- Fixed overlays rendered inside the scroll container can still reach the
  viewport edge while shown, and tint the chrome for that time.
- The morph is visible: an 8px band in the new colour for about 600ms.
- In window scroll, the next toolbar collapse re-samples the chrome from the
  page, which can undo a sync unless the band is at least `CHROME_SAMPLE_PX`.
- iOS 18's expanded bottom toolbar follows neither `theme-color` nor the root
  background.
- The stylesheet makes `body > .fixed` absolute in container scroll. `.fixed`
  is Tailwind's class; other hosts mark such layers with `BEZEL_LAYER_ATTRIBUTE`.
