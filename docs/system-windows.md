# Window System: chrome windows for apps

Tapping an app (home-screen **app shelf** or the ⌘K palette) opens it in a
draggable, resizable window. The metaphor is macOS/iPadOS "open an app", in a
Stage-Manager key: edge-to-edge content under a single floating **pill**. On a
phone the same app is a **sheet** instead, with one grip for chrome (see *Two
shapes*), because that is the idiom a screen that size already uses. One
window frame hosts two runtimes:

- **Web apps** load in an `<iframe>`.
- **Lynx apps** load in a **Lynx Player**: `@lynx-js/web-core`'s `<lynx-view>`
  element running a `.web.bundle`. It uses the same dual-thread (main +
  background Worker) model Lynx uses on-device, reproduced in the browser.

The chrome around them is identical; only the body differs: one window, two
runtimes.

## Overview

```
systems/windows/
├── provider.tsx                # WindowProvider + useWindows (state machine)
├── lib/
│   ├── types.ts                # WindowInstance, Rect, WindowMode
│   ├── geometry.ts             # size presets, placement, clamps, working area
│   └── lynx-shadow-css.ts      # generated: flattened web-elements layout CSS
├── components/
│   ├── window-layer.tsx        # <WindowLayer>: the fixed "desktop" surface
│   ├── window.tsx              # <Window>: sheet or window; DesktopWindow's gestures
│   ├── window-sheet.tsx        # <WindowSheet>: a window on a phone, as a sheet
│   ├── window-grip.tsx         # the pill ⇄ the sheet's handle, one object
│   ├── window-pill.tsx         # the traffic lights + the glass they sit on
│   ├── window-chrome.tsx       # the control dots (top-left desktop / centre mobile)
│   ├── window-menu.tsx         # the menu's rows + its sheet form (both shapes)
│   ├── minimized-dock.tsx      # <MinimizedWindows>: dock pills (direct restore)
│   ├── app-frame.tsx           # runtime switch: WebFrame vs LynxFrame
│   ├── web-frame.tsx           # <iframe> + "won't embed" fallback
│   ├── lynx-frame.tsx          # ssr:false boundary around the player
│   ├── lynx-player.tsx         # <lynx-view>: the Lynx Player
│   └── app-badge.tsx           # runtime marker (hover-revealed on shelf tiles)
├── lynx-view.d.ts              # <lynx-view> JSX typing
└── index.ts
```

## The app model

Apps are authored in [`content/apps.json`](../content/apps.json), the
**built-in registry**. Fields that drive the window system (see `AppLink` in
`lib/app-icon-core.ts`):

- `runtime`: `"web"` (default, an iframe) or `"lynx"` (the Lynx Player).
- `flavor`: for Lynx apps, `"react"` or `"vue"`. Cosmetic: it tints the badge.
- `bundleUrl`: the Lynx `.web.bundle`. Two sources, unified:
  - an `http(s)://…` URL → **online**, fetched at open time (the current apps);
  - a local `/…` path → **built-in** (offline), served from `public/`.
  The player passes remote URLs through untouched and origin-resolves local
  paths, so the same registry field supports either without a code change.
- `size`: preferred size preset (`portrait` / `landscape` / `max`); defaults to
  `portrait` for Lynx, `landscape` for web.
- `url`: canonical "open externally" target for every app.

```json
{
  "id": "busy-week",
  "title": "BusyWeek",
  "runtime": "lynx",
  "flavor": "vue",
  "bundleUrl": "https://huxpro.github.io/BusyWeek/main.web.bundle",
  "url": "https://huxpro.github.io/BusyWeek/",
  "featured": false
}
```

Lynx apps in the registry today load bundles two ways:

- **Online**: [BusyWeek](https://huxpro.github.io/BusyWeek/), a Vue Lynx
  todo app, fetches `main.web.bundle` from its GitHub Pages origin (which
  serves it with `Access-Control-Allow-Origin: *`). `@lynx-js/web-core`
  decodes it at open time in its background loader thread.
- **Built-in**: 逗猫棒 vendors `public/bundles/cat-toy.web.bundle` (the
  Vue Lynx `examples/touch-fx` playground) so it runs offline from this
  origin. Same `bundleUrl` field, a local `/…` path.

Beyond the registry, any bundle can be opened **over-the-air** by URL
(`openBundleUrl`); see Launching.

## Runtime badge

Every tile wears a corner **badge** (`app-badge.tsx`) saying how it runs, the
way iOS overlays a glyph on Clip / AR / web-clip icons:

- **web** → a globe.
- **Lynx · React** → the Lynx head, tinted React blue (`#149eca`).
- **Lynx · Vue** → the Lynx head, tinted Vue green (`#42b883`).

Flavour is colour-only, so React-Lynx and Vue-Lynx read apart at a glance
without a second glyph. To keep the resting springboard clean, the badge is
**not** stamped on the tile permanently. It fades in on hover / keyboard-focus
(pointer users) and whenever the shelf is in jiggle-edit mode (the touch path,
via long-press). The runtime is also named in the window menu's header and on
its minimized dock pill, so hiding the badge never hides the runtime.

## The manager

`WindowProvider` is a pure state machine. It owns the set of open windows and
their stacking and nothing visual (same split as the Dock system):

- **One window per app id.** Tapping an already-open app focuses (and
  un-minimizes) its window instead of spawning a duplicate, following the
  home-screen mental model rather than "⌘N a new document".
- **Focus = z-order.** A monotonic counter bumps the focused window above all
  others; `focusedId` is simply the highest-`z` non-minimized window.
- **Minimize** genies the window down toward the dock's live-activity band and
  parks it there as a pill (`components/minimized-dock.tsx`, rendered as a
  `<Dock>` child so it shares the row with the music / ambient activities).
  Tapping the pill (or the app's shelf icon, `openApp`) springs it back and
  focuses it. **Minimize is not an unmount**: the layer keeps every
  window (minimized included) mounted and just animates it to opacity 0 +
  `inert`, so its iframe / `<lynx-view>` keeps running and **its state is
  preserved** (a counter at 5 restores at 5). Only **close** unmounts; it is
  the sole `<AnimatePresence>` exit (a shrink in place).
- **Size** is a preset (`portrait` / `landscape` / `max`), set via `setSizePreset`;
  `"max"` is the maximized state. **Zoom** (green light / double click) toggles
  `max` ⇄ the previous preset, stashing the pre-max rect.
- **Esc** closes the front window, except while the ⌘K palette is open or a
  field is focused, so dismissing an overlay never nukes the window behind it.
  A window `resize` listener re-fits maximized windows and clamps the rest.

### Sizing

`geometry.ts` holds the pure math. The **working area** insets from the viewport
with a taller *top* inset (`DOCK_BAND`) so windows, including a maximized
window's top edge, clear the top-center live-activity dock. Presets:

- `portrait`: a phone-shaped card (Lynx / mobile web);
- `landscape`: a wide card (docs, desktop web);
- `max`: the whole working area, still with the roomy top inset (a
  deliberate "留白"; it is not literally fullscreen).

On phones every non-max preset fills the stage (and clears the dock by
construction). Clamps: `clampRect` (keep a window fully inside, used on resize)
and `clampDrag` (lenient: a window may hang off the edges; only the chrome is
guaranteed to stay grabbable).

## Two shapes

An app window takes the shape the viewport asks for, and `Window`
(`window.tsx`) is only the fork:

| Width | Shape | What it is |
|-------|-------|-----------|
| `< sm` | **sheet** (`window-sheet.tsx`) | A `SurfaceSheet` from the bottom edge: three detents for its size, the shared stack for its depth, its grip for all of its chrome. |
| `≥ sm` | **window** (`DesktopWindow`) | The draggable, resizable box below. |

The decision is the surface system's breakpoint map. The same map turns the
command palette into a sheet at the same width, and `isMobile` is defined from
it (`lib/geometry.ts`), so the rules that follow from being a sheet (one app at
a time) turn on exactly when the shape does. Where
a surface lives is a property of the viewport, not of the feature
([system-surface.md](./system-surface.md)). Crossing the breakpoint remounts
the app (two components, so the iframe reloads); resizing a phone into a
desktop mid-app is not a gesture anyone makes.

### A phone window is a sheet

- **Size** is the detent the finger left it at. There are three, not the
  site's shared pair. A window opens where a desktop window's top edge sits,
  just clear of the live-activity dock band (`DOCK_BAND`, recomputed as a
  fraction of the viewport), because that is the size an app wants. From there
  a drag takes it to the very top, or down to seven tenths to see the page
  behind it. (`SHEET_DETENTS` is for surfaces that stack level with one
  another; a window stacks with nothing, and the menu over it is
  content-height.) Portrait and landscape are a windowing idea, and on a phone
  they resolved to the same rectangle anyway, so the menu drops them there.
- **The grip is the only handle.** Every other sheet drags from anywhere; a
  window's body belongs to the app, because a game that follows a finger
  (逗猫棒) would otherwise slide the window away under it. The body carries
  Base UI's `data-base-ui-swipe-ignore`, so a touch starting there never
  becomes a swipe. An iframe never needed it, since its touches don't reach
  this document. A Lynx view lives in the DOM, though, and so does the loading
  spinner before either runtime arrives.
- **It comes back the size it lives at.** A flick down ends at the lowest
  detent by definition, so a window restored from the dock returns to the dock
  detent rather than arriving shrunk.
- **Put away, not killed.** A drag down is `minimize`, never `close`. The sheet
  closes but `keepMounted` leaves its DOM in place, so the iframe or Lynx view
  keeps its document. `WindowLayer` makes the same promise for a minimized
  desktop window and keeps it by a different mechanism. It comes back from its
  dock pill. Close is the menu's destructive row and nothing else, so no stray
  flick can lose an app's state.
- **One at a time.** Opening or restoring an app on a phone puts the others in
  the dock (`soloOnPhone` in `provider.tsx`): a second sheet would bury the
  first rather than sit beside it, and the dock is the app switcher. Windows
  coexist from `sm` up, as windows do.
- **It stacks on whatever opened it.** A window sheet is a sheet like any
  other in the shared stack, so one opened from the attachment sheet (a
  `Visit`) sends that sheet a step back and brings it forward again when the
  window is put away. It also paints above it even when the window was kept
  mounted from an earlier visit, because the stack's order is the paint order
  ([Surface System](./system-surface.md), "Stacking").
- **The menu** is a sheet stacked on the window. It is a React child of the
  window, so Base UI treats it as a real nested drawer and sends the window a
  step back, the way iOS presents a sheet from a sheet.

### The grip: the window's pill, doing double duty

A sheet already has a grabber, so the pill does not stack on top of one: they
are the same object (`window-grip.tsx`). It is the window's own chrome,
unchanged: the centred, chromeless cluster of traffic lights over edge-to-edge
content, with nothing that reads as a title bar (the sheet gives it a row of
its own only when `gripOverlay` is off). It is also what you drag the sheet
by. A tap opens the menu.

It looks exactly like the desktop pill (`window-pill.tsx`), down to the
padding: chromeless with three dim dots at rest, lighting into glass under a
thumb and while its menu stands open. That light is the tap feedback, and CSS
cannot give it here. A touch never sets `:active` (the grip is `touch-none`
and the press is preventDefaulted out from under it), and a mouse press sets it
and then *never clears it*, because the popup captures the pointer and Chrome
never sees the release. So the lit state is ours, and it is built to be **safe
when stranded**: lit is glass with bright dots, rest is the pill the desktop
wears, and a press whose release goes missing leaves the pill looking pressed:
wrong, but never missing. That is the bar anything on this control has to clear.

The one thing the phone pill does not borrow is its target. `::before` takes
the hit area to 72×44.5 from a pill of 48×28.5 (`globals.css`), because this
pill is also a handle. Target and look are separate on purpose: a pill that one
day shrinks into the 36×4 bar must not take its target down with it.

What failed that bar is worth keeping written down. The dots used to become
the site's 36×4 grabber while the sheet was dragged, driven three ways in turn.
First, proportional to the live travel, which a sheet with detents zeroes every
time it lands on one, so it flickered. Then a phase machine in the grip, which
had to know when the gesture ended and cannot: Base UI captures the pointer for
everything except touch, and the release then reaches nothing at all, so the
phase stuck and `keepMounted` carried it into the next time the app opened.
Then the sheet's own gesture state: better, and still one flush of a nested
drawer away from being stranded. Every version had the same shape: something
had to *clear* the interesting state, whatever clears it can be missed, and
what it cleared was the controls themselves. Whatever a handle gains from
changing shape does not outweigh a window whose controls are sometimes missing.
So nothing changes shape. If the morph returns, it must be something that
cannot persist: an animation that always ends where it started, not a state
someone has to clear.

The one thing the grip still owns is the tap, which is the one thing that can
be lost harmlessly (no menu opens; the next tap works). It opens the menu
*after* the release rather than inside it: the grip listens in the capture
phase, ahead of Base UI, and flushing a nested drawer into the middle of the
sheet's own gesture bookkeeping leaves the sheet believing it is still held.

The dots themselves are shared with the desktop pill, so the two can't drift;
on a grip they are an indicator rather than three targets (inert, and Base UI
would refuse to start a swipe from a `<button>` anyway).

## The chrome

This is the chrome of a *windowed* window; a phone window wears the grip above
instead. Content is **edge-to-edge**; the controls (`window-chrome.tsx`) are the
classic red/amber/green dots, placed to feel native per platform:

- **Desktop (pointer)** → a top-**left** cluster (macOS). The dots are always
  full-size but sit **dim grey on a chromeless (invisible) pill** at rest; on
  hover the pill fills in with glass, the dots take their colour (only for the
  active window; a passive window's dots stay grey), and the ×/−/+ glyphs plus
  the app **title** fade in. Nothing changes position between states, so the
  buttons are stable mouse targets.
- **Mobile (touch)** → a small, **centred**, always-grey ••• pill. The dots are
  inert on touch (an indicator, not three tiny targets); a tap opens the menu,
  which on touch is an **action sheet**, not a popover.

The window **menu** (title header + size presets + Reload + Open in browser +
Minimize + Close) opens via **right-click**, a **tap on the title**, or a **long-press**
(including long-pressing a dot). A stray touch never opens it: armPointer
(`lib/pointer.ts`) disambiguates *tap → menu*, *hold → menu*, *move → drag*.
There's deliberately **no caret**. Clicking the green dot zooms; double-clicking
the top band zooms too.

What the menu offers is one list (`WindowMenuBody` in `window-menu.tsx`); where
it is offered is three containers, so the shapes can't drift apart:

- **Pointer** → a **popover** under the pill: portaled to `<body>` with a
  full-viewport scrim (so a click anywhere dismisses it, even over an iframe,
  whose pointer events don't bubble), left-aligned under the pill and clamped
  into the viewport.
- **Touch, windowed** → a **`SurfaceSheet`** ([Surface System](./system-surface.md))
  from the bottom edge, content height (`fitContent`), with the app header on
  top, the actions as thumb-sized rows in the same order, and Close in a group of
  its own, in red. This is iOS's answer to "long-press an object, get its actions".
  Nothing computes a position for it: the sheet brings its own scrim (above the
  window layer and its iframes), its own Escape, drag-to-dismiss and the shared
  stack, so a playlist or wallpaper sheet already up steps back under it.
- **Touch, on a phone** → the same sheet, `nestedIn` the window's own, and
  without the size presets (the detent is the size).

A row **dismisses the sheet and then acts**: `close` unmounts the window, and
with it a sheet that would otherwise vanish mid-animation. iOS does the same.

Gesture handling in `window.tsx`:

- **Drag** (the pill, or a thin band along the top edge as a grab tolerance)
  and **resize** (edges + corners; top-height resize lives on the top corners
  since the top edge is the drag band) write geometry **straight to the DOM
  node** for the gesture's duration and commit once on pointer-up. That avoids
  per-frame React churn, which iframes and Web Workers repaint badly on.
- Drag is **free**: you can tuck a window mostly off-screen. On release it
  springs back just far enough to keep the chrome grabbable, with a small
  overshoot as a friendly **edge bounce** (we never force the whole app to stay
  on-screen).
- A transparent **gesture shield** covers the body while dragging/resizing, so
  the iframe can't swallow the `pointermove` stream and freeze the drag.

`WindowLayer` is a single `position: fixed; inset: 0` surface mounted once at
the app root (in `app/layout.tsx`), `pointer-events: none` so it never steals
page clicks. A phone window paints in the surface system's own layer instead
(the sheet is portaled, at `z-60`), and holds `AnimatePresence` open through
`usePresence` so its exit plays before the window is dropped. `WindowLayer`
sits at `z-40`, below the dock (`z-50`) and the command palette (`z-60`), so ⌘K
always wins. `AnimatePresence` plays the open/close spring.

## The runtimes

**WebFrame.** An `<iframe>` (defensively sandboxed) with a graceful fallback:
many sites refuse framing via `X-Frame-Options` / CSP `frame-ancestors`, and
the browser blocks that at a layer JS can't read cross-origin. So instead of
faking detection, it waits for the frame's `load`; if that never fires within
a grace window, a non-blocking banner offers to open the app in a real tab.

**LynxFrame → LynxPlayer.** `<lynx-view>` and its runtime instantiate Web
Workers the moment their module is imported, so the player **cannot touch the
server**. `lynx-frame.tsx` loads it through `next/dynamic` with `ssr: false`,
which keeps these two side-effect imports off the server entirely:

```ts
import "@lynx-js/web-elements/index.css"; // element styles
import "@lynx-js/web-core/client";         // registers <lynx-view> + runtime
```

`@lynx-js/web-core` also needs `@lynx-js/lynx-core`
installed (it dynamically imports `@lynx-js/lynx-core/web` for the background
thread). No COOP/COEP headers are required. The bundle fetch happens in
web-core's background loader thread: a **built-in** (`/…`) bundle is served
same-origin from `public/`, and an **online** (`http(s)://…`) bundle is
fetched cross-origin, so the remote host must send permissive CORS.
BusyWeek's origin serves its `.web.bundle` with
`Access-Control-Allow-Origin: *`.

Two fidelity details let *arbitrary* Lynx cards (not just our inline-styled
demos) render correctly: a **per-instance `lynx-group-id`** so concurrent
windows never share a background Worker, and **container-query units**
(`container-type: size` + `--rpx-unit: calc(100cqw / 750)`, `transform-vh/vw`)
so Lynx's `rpx` / `vh` / `vw` resolve against the *window* rather than the
viewport, and a real card scales to the window it's in.

`SystemInfo` is a third. web-core defaults `pixelWidth` / `pixelHeight` to
`window.screen`, so a card that places itself in "screen" coordinates (逗猫棒's
orb) would land off-canvas in a portrait window. The player measures the
container and passes `browser-config` before loading the bundle, so
`SystemInfo` matches the window the card is in.

### Shadow-root layout CSS

`web-core` styles each `<lynx-view>` shadow root by importing its layout CSS
Vite-style (`import css from '…/in_shadow.css?inline'`) and Blob-ing that
string into a `<link>`. Under **Turbopack** (and Webpack) `?inline` does *not*
yield the CSS string: the `.css` module's default export is `undefined`, so the
Blob becomes the literal text `"undefined"` and the shadow root gets **no**
web-elements layout CSS. Flex defaults silently break: a `<view>` renders
`flex-direction: row` instead of Lynx's `column`. `in_shadow.css` also opens
with `@import url("@lynx-js/web-elements/index.css")`, a bare specifier a
Blob-URL stylesheet could never resolve anyway.

Because this repo builds with **Turbopack**, the usual Webpack fix
(`NormalModuleReplacementPlugin` + `asset/source`) doesn't apply. Instead:

1. `pnpm lynx:shadow-css` (`scripts/lynx-shadow-css-bundle.mjs`) recursively
   flattens `in_shadow.css` + every `@import` (bare *and* relative) into one
   self-contained string, emitted as `systems/windows/lib/lynx-shadow-css.ts`.
   `predev` / `prebuild` regenerate it so CI stays consistent.
2. `lynx-player.tsx` injects that string as a `<style>` into each shadow root
   itself (first child, so a card's own styles still win). This is
   bundler-agnostic and sidesteps web-core's broken `?inline` path entirely.

Verified: after the fix a fresh `x-view` in the shadow root computes
`flex-direction: column` (244 rules applied) instead of the broken `row`.

## Launching

Three ways in, all routing through `useWindows()`:

- **Folder.** `components/apps/app-folder.tsx` icons stay real anchors to each
  app's `url`, so ⌘/middle-click still opens the site in a new tab. A plain
  left-click is intercepted (`openApp`) to open the window instead. This is
  progressive enhancement, and it composes with the folder's drag-to-reorder
  and snap-paged overflow.
- **Command palette.** Spotlight-style Apps strip in ⌘K
  (`systems/command/apps-launcher.tsx`): a headerless horizontal icon row
  (same for browse + search; hidden when nothing matches). **Load…** opens an
  in-palette glass form (URL only) instead of `window.prompt`.
- **Over-the-air.** `openBundleUrl(url)` opens an ad-hoc Lynx window for any
  `.web.bundle` URL. Reachable from the palette action above and from the
  DevTool.
- **In-app browser.** `openUrl(url, { title })` opens any web page in a
  window with the same frame, pill and menu an app gets, keyed by URL so the
  same page focuses its window rather than opening a second. This is where a
  link card a commit attaches opens (see
  [Attachments System](./system-attachments.md)): a window on a desktop, and
  on a phone the window sheet, stacked over the attachment sheet the `Visit`
  came from, the way a mobile app opens a link in its own in-app browser and
  returns to the screen underneath when it is put away. Pages whose headers
  refuse framing never get here; they go to a tab. `Open in browser` in the
  menu is the way out. The browser is an app with `runtime: "web"`; a second
  runtime for links (a reader, a different frame) would only need another
  `AppLink` and another row in the attachments policy.

## DevTool inspector

The DevTool panel (`systems/devtool/panel.tsx`) has a **Windows** section: the
open windows, front-most first, each with its focused / minimized state and
its metadata (runtime and flavor, source, size preset, reload count, rect, and
the bundle or page URL). It only inspects; launching an app and loading a
bundle by URL are the command palette's (⌘K → Apps → Load bundle).
```
