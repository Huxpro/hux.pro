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

The morph is for a chrome that samples the page, which is iOS Safari. Pass
`chromeMorph={false}` (or `syncChrome(color, { morph: false })`) everywhere
else: `theme-color` is still set — Android Chrome and macOS Safari follow it —
and nothing is drawn. On a desktop window the morph would be 880ms of 8px
bands at the top and bottom edges, on every theme change, read by nobody.

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
| `scroll` | `data-bezel-scroll="container"` on `<html>`. The scroll position moves between the window and the container, and page scroll listeners fire. On iOS, a status-bar tap is forwarded to the container while the page is away from the top. |
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
pnpm bezel:status-tap   # needs playwright on the machine; skips without it
```

`bezel:status-tap` compiles the package's own sources into a container scroll
fixture and drives them in Chromium: arming and standing down, the tap at rest
and mid-fling, a fling that outlives the momentum kill, a finger landing on a
page already on its way up, a scroll lock taking `<html>` away, a rotation.

Every case runs twice. Chromium scrolls the main frame in the page's own
process, so `window.scrollTo` takes effect before the next line runs; iOS
scrolls it in the UI process, so it is a request and `scrollY` keeps reporting
the old offset until the answer comes back. The second run models that, and it
is the one a phone lives in — code that reads `scrollY` straight after asking
for the park and gives up on it cancels the park itself, and the gesture never
arms at all.

Safari's gesture cannot be produced there, but what it does to the page can:
it scrolls the main frame to 0, and everything that can go wrong afterwards is
on the page's side of that. Chromium shares the rendering loop the whole design
leans on — a frame's scroll events, then its animation frame callbacks. The one
thing only a phone can confirm is that the park sticks at all.

## The status-bar tap

Tapping the status bar scrolls to the top, and iOS gives that gesture to the
main `WKScrollView` alone: WebKit sets `scrollsToTop = NO` on every overflow
`UIScrollView` it creates, so the scroll container can never be handed it.

The window can. `<body>` is fixed at inset 0, so the document has nothing to
move and a few pixels of window scroll are invisible. While the page is away
from the top, `<html>` gets `data-bezel-status-tap`, a few pixels of scroll
range, and a park inside it. Safari taking that back to 0, with no finger on
the glass and no viewport change, is the gesture — and the container is eased
to the top on the chrome morph's curve, 280–640ms by distance. Reduced motion
jumps. A touch stops it where it is.

Four things it has to get right, all of them timing:

- **One decision per frame.** Scroll events are asynchronous and a frame can
  carry two, the container's and the window's. Nothing acts inside a scroll
  handler; they only schedule a reconcile in a `requestAnimationFrame`
  callback, which the rendering loop runs after that frame's scroll events.
  Acting in the handlers instead lets the container's handler re-park the
  window before the window's handler runs, and the tap is swallowed —
  intermittently, depending on which scroller moved first.
- **The tap usually lands mid-fling.** Momentum the compositor is still
  applying fights every `scrollTop` written under it. The fling is ended first
  — one frame of `overflow: hidden`, which has to span a frame or the
  compositor never sees it — and the return re-bases itself if the container
  moves under it anyway, rather than yanking it back onto a curve that stopped
  being true.
- **The park is a request, not a move.** On iOS the main frame is scrolled in
  the UI process, so `window.scrollY` still reports the old offset on the line
  after `window.scrollTo`. The park is therefore confirmed late, and only a
  confirmed park counts — an unconfirmed one is never read as a tap, and is
  never taken back on the strength of a reading that has not caught up yet.
- **Being armed unlocks the page.** `overflow: hidden` on `<html>` is how an
  overlay library decides the page is already locked (Base UI reads the
  computed `overflow-y` of the viewport scroller). While armed, `<html>` no
  longer reads that way, so the arming stands down the moment anything writes
  an inline overflow onto `<html>`, and re-arms when that clears. A park that
  does not stick backs off and tries again later; nothing latches off.

It is iOS-only — off the platform there is no gesture to catch and `<html>` is
better left alone — and container scroll is reachable elsewhere through the
devtool, so the check is real rather than assumed.

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
- Container scroll leaves the page looking scroll-locked to anyone who asks
  (`<html>` is `overflow: hidden`). A well-behaved overlay library sees that and
  stands down rather than locking on top of it — Base UI's dialogs do — so the
  host keeps its layout. One that locks unconditionally by writing `position:
  relative` and a height onto `<body>` will collapse this layout instead; check
  before adopting one. While a status-bar tap is armed, `<html>` does not read
  as locked, so a library that locks then will take over; on iOS Base UI's lock
  is an inline `overflow: hidden` on `<html>` and nothing else, and the arming
  gets out of its way for as long as it holds.
- The status-bar tap cannot be armed and a scroll lock held at the same time,
  so the gesture does nothing while a sheet is open. It comes back when the
  sheet closes.
- A window scroll to 0 that is not a status-bar tap — some other code calling
  `window.scrollTo` in container scroll — would read as one. Nothing on this
  site does; `scrollPageTo` moves the container.
