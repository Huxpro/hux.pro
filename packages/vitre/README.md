# vitre

Safari `theme-color` for iOS 26, and safe page edges. vitre draws a bezel around
the page, tints Safari's glass toolbar and status bar live in the colour you
choose, and scrolls the page in a container so the viewport and its edges hold
still. For React.

*Vitre* is French for a windowpane: the glass set in a frame. Safari on iOS 26
draws its bars as glass over the edges of the page and tints them from what it
finds there. vitre is the frame and the pane at those edges.

The public API is [`vitre.d.ts`](./vitre.d.ts). `src/contract.ts` fails the
type check if the implementation drifts from it.

## Words

| Word | Means | Never used for |
|---|---|---|
| **bezel** | The border drawn around the page: a band on each edge, rounded inner corners, one colour. | — |
| **chrome** | The browser's own UI: Safari's status bar and toolbar. | The bezel. |
| **scroll** | Where the page scrolls: `window`, or `container` with the window locked. | — |

## What iOS Safari does

Measured in the iOS 26.5 simulator by reading screenshot pixels, and checked
against the same builds on a phone. iOS 18.5 is noted where it differs.

| Behaviour | iOS 26.5 | iOS 18.5 |
|---|---|---|
| Chrome colour at load | The root background, or `position: fixed` content spanning the viewport edge (whose composited pixels it copies, even when the content is transparent) | `theme-color` |
| Chrome colour after a later change to the root background | Not re-read. The chrome keeps the old colour. | Not re-read |
| Chrome colour after a later change to `theme-color` | Ignored | Followed |
| Fixed content at the edge, added later | Followed live, from 6 CSS px thick (5 does not register), and the colour stays after the content is removed | — |
| Toolbar collapse | When the user scrolls the document down; scrolling up expands it. A script's scroll leaves it as it is, except that reaching the top expands it. Each collapse re-samples the chrome. | Same for the user's scroll; a script's scroll not measured |
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
import { Bezel, BEZEL_INSET, BEZEL_LAYER_ATTRIBUTE, bezelBootScript } from "vitre";

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

## Scroll

`scroll` picks the page's scroller: the window, or a container inside the bezel
with `<html>` and `<body>` held still. `<Bezel>` writes the choice to `<html>`
(`data-bezel-scroll`), and everything else reads it from there. It is
independent of `enabled`, `color` and `band`; container scroll is the one to use
while the bezel is on.

| | `window` | `container` |
|---|---|---|
| Scroller | The document | A container inside the bezel |
| Safari's toolbar | Collapses and expands with scroll | Stays expanded |
| `getScrollContainer()` | `null` | The container |
| `window.scrollY`, `scrollTo`, `scroll` event | The page | Not the page's scroll |
| Tap on the status bar | Scrolls to the top | Scrolls to the top (on iOS; see [The status-bar tap](#the-status-bar-tap)) |
| Full-screen fixed layers (`body > .fixed`, `BEZEL_LAYER_ATTRIBUTE`) | fixed | absolute |
| `position: sticky`, IntersectionObserver, `scrollIntoView`, anchors | Work | Work |

Switching carries the scroll position across and notifies page scroll
listeners.

### Page scroll API

Two layers, the second built on the first:

- **The scroller.** `getScrollContainer()` returns the container in container
  scroll and `null` in window scroll, the platform's value for the viewport (as
  in an IntersectionObserver's `root`). Hand it to anything that takes a scroll
  element, and bind again when `useBezel().scroll` changes.
- **The page.** `pageScrollTop`, `pageScrollHeight`, `pageViewportHeight`,
  `pageOffsetOf`, `scrollPageTo`, `onPageScroll`, `usePageScroll` and
  `emitPageScroll` read the mode at every call, so they work in both modes,
  across a live switch, and outside React. Without `<Bezel>` they act on the
  window. `scrollPageTo(top, { behavior: "smooth" })` animates.

| Your page | Use |
|---|---|
| Only `position: sticky`, IntersectionObserver, `scrollIntoView` and anchors | Nothing more |
| Always window scroll | `window` |
| Always container scroll | `getScrollContainer()`, as any scroll container |
| Switches mode live, or a component that does not know the host's mode | The page helpers |
| A library that takes a scroll element | `getScrollContainer()`, bound again on `useBezel().scroll` |

```tsx
usePageScroll(() => setProgress(pageScrollTop() / (pageScrollHeight() - pageViewportHeight())));
scrollPageTo(pageOffsetOf(heading) - 96, { behavior: "smooth" });

const { scroll } = useBezel();
useEffect(() => {
  const target = getScrollContainer() ?? window;
  target.addEventListener("scroll", onScroll, { passive: true });
  return () => target.removeEventListener("scroll", onScroll);
}, [scroll]);
```

### Window scroll on iOS Safari

Measured in the iOS 26.5 simulator:

- **Edge leak.** Each time the toolbar collapses or expands, a strip of page
  content up to about 50px shows below the bottom band for about 200ms, while
  Safari still draws fixed elements at the old viewport size.
- **Live changes.** A toolbar collapse makes Safari sample the edge again, and in
  rare cases the chrome keeps the wrong colour after a live change until a
  reload.

## Demo and documentation site

`packages/vitre/site` is the package's own website, built with Vite and importing
only `vitre`. It is served by hux.pro at `/vitre`.

- **On a phone** it is the demo itself: a small site inside `<Bezel>`, with
  cards that each run one feature and a devtool that edits every prop and
  shows what the package resolved, wrote to `<html>` and set as `theme-color`.
  Settings are saved, and the boot script paints the next load from them, so
  Safari's real chrome can be tested.
- **On anything wider** it is a single documentation page: a simulated iPhone
  running the demo stays on screen while the article scrolls, and the section
  in view drives the phone. Every export and every prop is documented, and
  that reference is type-checked against `vitre.d.ts`.

```bash
pnpm vitre:site
```

Then open `http://localhost:5173/vitre/` on a desktop browser, or on the iOS
simulator or a phone on the same network.

Scroll-driven CSS should not use `animation-timeline: scroll(root)`. The
package names the live scroller `--page-scroll` (root in window scroll,
`#bezel-scroll` in container scroll); bind to that, or to
`scroll(nearest)`.

## Testing

```bash
pnpm vitre:typecheck
```

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
  does not stick is not fatal either: nothing latches off, and the next
  scroll, mutation or resize — every reason a park fails ends in one — comes
  back around and tries again.

It is iOS-only — off the platform there is no gesture to catch and `<html>` is
better left alone — and container scroll is reachable elsewhere through the
devtool, so the check is real rather than assumed.

## Limits

- Fixed overlays rendered inside the scroll container can still reach the
  viewport edge while shown, and tint the chrome for that time.
- The morph is visible: an 8px band in the new colour for about 600ms.
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
