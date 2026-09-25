# Window System — chrome windows for apps

Tapping an app (home-screen **app shelf** or the ⌘K palette) opens it in a
draggable, resizable window — the macOS/iPadOS "open an app" metaphor, in a
Stage-Manager key: edge-to-edge content under a single floating **pill**. On a
phone the same app is a **sheet** instead, with one grip for chrome (see *Two
shapes*), because that is what a screen that size already speaks. One window
frame hosts two runtimes:

- **Web apps** load in an `<iframe>`.
- **Lynx apps** load in a **Lynx Player** — `@lynx-js/web-core`'s `<lynx-view>`
  element running a `.web.bundle`, the same dual-thread (main + background
  Worker) model Lynx uses on-device, reproduced in the browser.

The chrome around them is identical; only the body differs. That's the whole
idea — one window, whatever runs in it. Two more runtimes host the site's own
features and pages; see *Unified windows* below.

## Overview

```
systems/windows/
├── provider.tsx                # WindowProvider + useWindows (state machine)
├── lib/
│   ├── types.ts                # WindowInstance, Rect, WindowMode
│   ├── geometry.ts             # size presets, placement, clamps, working area
│   ├── builtins.ts             # the system apps + page apps (unified windows)
│   ├── unified.ts              # the unified-windows switch
│   ├── embed.ts                # "this document is a page in a window"
│   ├── os.ts                   # the bridge a page window hands things out through
│   └── lynx-shadow-css.ts      # generated: flattened web-elements layout CSS
├── components/
│   ├── window-layer.tsx        # <WindowLayer> — the fixed "desktop" surface
│   ├── window.tsx              # <Window> — sheet or window; DesktopWindow's gestures
│   ├── window-sheet.tsx        # <WindowSheet> — a window on a phone, as a sheet
│   ├── window-grip.tsx         # the pill ⇄ the sheet's handle, one object
│   ├── window-pill.tsx         # the traffic lights + the glass they sit on
│   ├── window-chrome.tsx       # the control dots (top-left desktop / centre mobile)
│   ├── window-menu.tsx         # the menu's rows + its sheet form (both shapes)
│   ├── minimized-dock.tsx      # <MinimizedWindows> — dock pills (direct restore)
│   ├── app-frame.tsx           # runtime switch: web / lynx / system / page
│   ├── system-app-frame.tsx    # a built-in's body, rendered in this document
│   ├── page-frame.tsx          # a route of this site, shrunk into a window
│   ├── use-expand-page.ts      # shrink a page into a window ⇄ expand it back
│   ├── os-chrome.tsx           # what only the top document draws; scope in a page
│   ├── host-window.tsx         # useHostWindow — the window a body is in
│   ├── web-frame.tsx           # <iframe> + "won't embed" fallback
│   ├── lynx-frame.tsx          # ssr:false boundary around the player
│   ├── lynx-player.tsx         # <lynx-view> — the Lynx Player
│   └── app-badge.tsx           # runtime marker (hover-revealed on shelf tiles)
├── lynx-view.d.ts              # <lynx-view> JSX typing
└── index.ts
```

## The app model

Apps are authored in [`content/apps.json`](../content/apps.json) — the
**built-in registry**. Fields that drive the window system (see `AppLink` in
`lib/app-icon-core.ts`):

- `runtime` — `"web"` (default, an iframe), `"lynx"` (the Lynx Player),
  `"system"` (a built-in, see below) or `"page"` (a route of this site).
- `flavor` — for Lynx apps, `"react"` or `"vue"`. Cosmetic: it tints the badge.
- `bundleUrl` — the Lynx `.web.bundle`. Two sources, unified:
  - an `http(s)://…` URL → **online**, fetched at open time (the current apps);
  - a local `/…` path → **built-in** (offline), served from `public/`.
  The player passes remote URLs through untouched and origin-resolves local
  paths, so the same registry field supports either without a code change.
- `size` — preferred size preset (`portrait` / `landscape` / `max`); defaults to
  `portrait` for Lynx, `landscape` for web.
- `url` — canonical "open externally" target for every app.

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

- **Online** — [BusyWeek](https://huxpro.github.io/BusyWeek/), a Vue Lynx
  todo app, fetches `main.web.bundle` from its GitHub Pages origin (which
  serves it with `Access-Control-Allow-Origin: *`). `@lynx-js/web-core`
  decodes it at open time in its background loader thread.
- **Built-in** — 逗猫棒 vendors `public/bundles/cat-toy.web.bundle` (the
  Vue Lynx `examples/touch-fx` playground) so it runs offline from this
  origin. Same `bundleUrl` field, a local `/…` path.

Beyond the registry, any bundle can be opened **over-the-air** by URL
(`openBundleUrl`) — see Launching.

## Runtime badge

Every tile wears a corner **badge** (`app-badge.tsx`) saying how it runs, the
way iOS overlays a glyph on Clip / AR / web-clip icons:

- **web** → a globe.
- **Lynx · React** → the Lynx head, tinted React blue (`#149eca`).
- **Lynx · Vue** → the Lynx head, tinted Vue green (`#42b883`).

Flavour is colour-only, so React-Lynx and Vue-Lynx read apart at a glance
without a second glyph. To keep the resting springboard clean, the badge is
**not** stamped on the tile permanently — it fades in on hover / keyboard-focus
(pointer users) and whenever the shelf is in jiggle-edit mode (the touch path,
via long-press). The runtime is also named in the window menu's header and on
its minimized dock pill, so it's never truly hidden.

## The manager

`WindowProvider` is a pure state machine — it owns the set of open windows and
their stacking, nothing visual (same split as the Dock system):

- **One window per app id.** Tapping an already-open app focuses (and
  un-minimizes) its window instead of spawning a duplicate — the home-screen
  mental model, not "⌘N a new document".
- **Focus = z-order.** A monotonic counter bumps the focused window above all
  others; `focusedId` is simply the highest-`z` non-minimized window.
- **Minimize** genies the window down toward the dock's live-activity band and
  parks it there as a pill (`components/minimized-dock.tsx`, rendered as a
  `<Dock>` child so it shares the row with the music / ambient activities).
  Tapping the pill — or the app's shelf icon (`openApp`) — springs it back and
  focuses it. Crucially, **minimize is not an unmount**: the layer keeps every
  window (minimized included) mounted and just animates it to opacity 0 +
  `inert`, so its iframe / `<lynx-view>` keeps running and **its state is
  preserved** (a counter at 5 restores at 5). Only **close** unmounts — that's
  the sole `<AnimatePresence>` exit (a shrink in place).
- **Size** is a preset (`portrait` / `landscape` / `max`), set via `setSizePreset`;
  `"max"` is the maximized state. **Zoom** (green light / double click) toggles
  `max` ⇄ the previous preset, stashing the pre-max rect.
- **Esc** closes the front window — but not while the ⌘K palette is open or a
  field is focused, so dismissing an overlay never nukes the window behind it.
  A window `resize` listener re-fits maximized windows and clamps the rest.

### Sizing

`geometry.ts` holds the pure math. The **working area** insets from the viewport
with a taller *top* inset (`DOCK_BAND`) so windows — and a maximized window's
top edge — clear the top-center live-activity dock. Presets:

- `portrait` — a phone-shaped card (Lynx / mobile web);
- `landscape` — a wide card (docs, desktop web);
- `max` — the whole working area (keeps the roomy top inset — a deliberate
  "留白", not literally fullscreen).

On phones every non-max preset fills the stage (and clears the dock by
construction). Clamps: `clampRect` (keep a window fully inside, used on resize)
and `clampDrag` (lenient — let a window hang off the edges, only guaranteeing
the chrome stays grabbable).

## Two shapes

An app window takes the shape the viewport asks for, and `Window`
(`window.tsx`) is only the fork:

| Width | Shape | What it is |
|-------|-------|-----------|
| `< sm` | **sheet** (`window-sheet.tsx`) | A `SurfaceSheet` from the bottom edge: three detents for its size, the shared stack for its depth, its grip for all of its chrome. |
| `≥ sm` | **window** (`DesktopWindow`) | The draggable, resizable box below. |

The decision is the surface system's breakpoint map — the same one that turns
the command palette into a sheet at the same width, and the same one
`isMobile` is defined from (`lib/geometry.ts`), so the rules that follow from
being a sheet — one app at a time — turn on exactly when the shape does. Where
a surface lives is a property of the viewport, not of the feature
([system-surface.md](./system-surface.md)). Crossing the breakpoint remounts
the app (two components, so the iframe reloads); resizing a phone into a
desktop mid-app is not a gesture anyone makes.

### A phone window is a sheet

- **Size** is the detent the finger left it at. Three of them, not the site's
  shared pair: a window opens where a desktop window's top edge sits — just
  clear of the live-activity dock band (`DOCK_BAND`, recomputed as a fraction
  of the viewport) — because that is the size an app wants; from there a drag
  takes it to the very top, or down to seven tenths to see the page behind it.
  (`SHEET_DETENTS` is for surfaces that stack level with one another; a window
  stacks with nothing, and the menu over it is content-height.) Portrait and
  landscape are a windowing idea — on a phone they resolved to the same
  rectangle anyway — so the menu drops them there.
- **It comes back the size it lives at.** A flick down ends at the lowest
  detent by definition, so a window restored from the dock returns to the dock
  detent rather than arriving shrunk.
- **Put away, not killed.** A drag down is `minimize`, never `close`. The sheet
  closes but `keepMounted` leaves its DOM in place, so the iframe or Lynx view
  keeps its document — the same promise `WindowLayer` makes for a minimized
  desktop window, kept by a different mechanism. It comes back from its dock
  pill. Close is the menu's destructive row and nothing else, so no stray flick
  can lose an app's state.
- **One at a time.** Opening or restoring an app on a phone puts the others in
  the dock (`soloOnPhone` in `provider.tsx`): a second sheet would bury the
  first rather than sit beside it, and the dock is the app switcher. Windows
  coexist from `sm` up, as windows do.
- **It stacks on whatever opened it.** A window sheet is a sheet like any
  other in the shared stack, so one opened from the attachment sheet (a
  `Visit`) sends that sheet a step back and brings it forward again when the
  window is put away — and paints above it even when the window was kept
  mounted from an earlier visit, because the stack's order is the paint order
  ([Surface System](./system-surface.md), "Stacking").
- **The menu** is a sheet stacked on the window — a React child of it, so Base
  UI treats it as a real nested drawer and sends the window a step back, the
  way iOS presents a sheet from a sheet.

### The grip — the window's pill, doing double duty

A sheet already has a grabber, so the pill does not stack on top of one: they
are the same object (`window-grip.tsx`). It is the window's own chrome,
unchanged — the centred, chromeless cluster of traffic lights floating over
edge-to-edge content, with nothing that reads as a title bar (the sheet gives
it a row of its own only when `gripOverlay` is off) — and it is also what you
drag the sheet by. A tap opens the menu.

It looks exactly like the desktop pill (`window-pill.tsx`), down to the
padding: chromeless with three dim dots at rest, lighting into glass under a
thumb and while its menu stands open. That light is the tap feedback, and CSS
cannot give it here — a touch never sets `:active` (the grip is `touch-none`
and the press is preventDefaulted out from under it), and a mouse press sets it
and then *never clears it*, because the popup captures the pointer and Chrome
never sees the release. So the lit state is ours, and it is built to be **safe
when stranded**: lit is glass with bright dots, rest is the pill the desktop
wears, and a press whose release goes missing leaves the pill looking pressed —
wrong, never missing. That is the bar anything on this control has to clear.

The one thing the phone pill does not borrow is its target. `::before` takes
the hit area to 72×44.5 from a pill of 48×28.5 (`globals.css`), because this
pill is also a handle. Target and look are deliberately separate — a pill that one
day shrinks into the 36×4 bar must not take its target down with it.

What failed that bar is worth keeping written down. The dots used to
become the site's 36×4 grabber while the sheet was dragged: proportional to the
live travel first (which a sheet with detents zeroes every time it lands on
one, so it flickered), then a phase machine in the grip (which had to know when
the gesture ended, and cannot — Base UI captures the pointer for everything
except touch, and the release then reaches nothing at all, so the phase stuck
and `keepMounted` carried it into the next time the app opened), then the
sheet's own gesture state (better, and still one flush of a nested drawer away
from being stranded). Every version had the same shape: something had to
*clear* the interesting state, whatever clears it can be missed, and what it
cleared was the controls themselves. Whatever a handle gains from changing
shape does not outweigh a window whose controls are sometimes missing — so
nothing changes shape, and if the morph returns it must be something that
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
  active window — a passive window's dots stay grey), and the ×/−/+ glyphs plus
  the app **title** fade in. Nothing changes position between states, so the
  buttons are stable mouse targets.
- **Mobile (touch)** → a small, **centred**, always-grey ••• pill. The dots are
  inert on touch (an indicator, not three tiny targets); a tap opens the menu,
  which on touch is an **action sheet**, not a popover.

The window **menu** (title header + size presets + Reload + Open in browser +
Minimize + Close) opens via **right-click**, a **tap on the title**, or a **long-press**
(including long-pressing a dot) — never from a stray touch, since armPointer
(`lib/pointer.ts`) disambiguates *tap → menu*, *hold → menu*, *move → drag*.
There's deliberately **no caret**. Clicking the green dot zooms; double-clicking
the top band zooms too.

What the menu offers is one list (`WindowMenuBody` in `window-menu.tsx`); where
it is offered is three containers, so the shapes can't drift apart:

- **Pointer** → a **popover** under the pill: portaled to `<body>` with a
  full-viewport scrim (so a click anywhere — even over an iframe, whose pointer
  events don't bubble — dismisses it), left-aligned under the pill and clamped
  into the viewport.
- **Touch, windowed** → a **`SurfaceSheet`** ([Surface System](./system-surface.md))
  from the bottom edge, content height (`fitContent`), with the app header on
  top, the actions as thumb-sized rows in the same order, and Close in a group of
  its own, in red — iOS's answer to "long-press an object, get its actions".
  Nothing computes a position for it: the sheet brings its own scrim (above the
  window layer and its iframes), its own Escape, drag-to-dismiss and the shared
  stack, so a playlist or wallpaper sheet already up steps back under it.
- **Touch, on a phone** → the same sheet, `nestedIn` the window's own, and
  without the size presets (the detent is the size).

A row **dismisses the sheet and then acts** — `close` unmounts the window, and
with it a sheet that would otherwise vanish mid-animation. It is also what iOS
does.

Gesture handling in `window.tsx`:

- **Drag** (the pill, or a thin band along the top edge — a grab tolerance) and
  **resize** (edges + corners; top-height resize lives on the top corners since
  the top edge is the drag band) write geometry **straight to the DOM node** for
  the gesture's duration — no per-frame React churn, which iframes and Web
  Workers repaint badly on — then commit once on pointer-up.
- Drag is **free**: you can tuck a window mostly off-screen. On release it
  springs back just far enough to keep the chrome grabbable, with a small
  overshoot as a friendly **edge bounce** (we never force the whole app to stay
  on-screen).
- A transparent **gesture shield** covers the body while dragging/resizing, so
  the iframe can't swallow the `pointermove` stream and freeze the drag.

`WindowLayer` is mounted once at the app root (in `app/layout.tsx`) and draws
no box of its own: each window is `position: fixed` in the root stacking
context, at a z-index from its **rank** in the window order (`windowZIndex`:
40 + rank, capped at 49) — below the dock (`z-50`) and the command palette
(`z-60`), so ⌘K always wins. Rank rather than the raw focus counter, because
the band is ten levels wide. And one stacking context per window rather than
one for the layer, so that something which is not a window can stand *between*
two windows: the theater's stage (see *Unified windows*). A phone window paints
in the surface system's own layer instead (the sheet is portaled, at `z-60`),
and holds `AnimatePresence` open through `usePresence` so its exit plays before
the window is dropped. `AnimatePresence` plays the open/close spring.

## The runtimes

**WebFrame.** An `<iframe>` (defensively sandboxed) with a graceful fallback:
many sites refuse framing via `X-Frame-Options` / CSP `frame-ancestors`, and
the browser blocks that at a layer JS can't read cross-origin. So instead of
faking detection, it waits for the frame's `load`; if that never fires within
a grace window, a non-blocking banner offers to open the app in a real tab.

**LynxFrame → LynxPlayer.** `<lynx-view>` and its runtime instantiate Web
Workers the moment their module is imported, so the player **cannot touch the
server**. `lynx-frame.tsx` loads it through `next/dynamic` with `ssr: false`,
which keeps the two side-effect imports —

```ts
import "@lynx-js/web-elements/index.css"; // element styles
import "@lynx-js/web-core/client";         // registers <lynx-view> + runtime
```

— off the server entirely. `@lynx-js/web-core` also needs `@lynx-js/lynx-core`
installed (it dynamically imports `@lynx-js/lynx-core/web` for the background
thread). No COOP/COEP headers are required. The bundle fetch happens in
web-core's background loader thread: a **built-in** (`/…`) bundle is served
same-origin from `public/`, and an **online** (`http(s)://…`) bundle is
fetched cross-origin, so the remote host must send permissive CORS —
BusyWeek's origin serves its `.web.bundle` with
`Access-Control-Allow-Origin: *`.

Two fidelity details let *arbitrary* Lynx cards (not just our inline-styled
demos) render correctly: a **per-instance `lynx-group-id`** so concurrent
windows never share a background Worker, and **container-query units**
(`container-type: size` + `--rpx-unit: calc(100cqw / 750)`, `transform-vh/vw`)
so Lynx's `rpx` / `vh` / `vw` resolve against the *window* rather than the
viewport — a real card scales to the window it's in.

`SystemInfo` is a third. web-core defaults `pixelWidth` / `pixelHeight` to
`window.screen`, so a card that places itself in "screen" coordinates (逗猫棒's
orb) would land off-canvas in a portrait window. The player measures the
container and passes `browser-config` before loading the bundle, so
`SystemInfo` matches the window the card is in.

### Shadow-root layout CSS

`web-core` styles each `<lynx-view>` shadow root by importing its layout CSS
Vite-style — `import css from '…/in_shadow.css?inline'` — and Blob-ing that
string into a `<link>`. Under **Turbopack** (and Webpack) `?inline` does *not*
yield the CSS string: the `.css` module's default export is `undefined`, so the
Blob becomes the literal text `"undefined"` and the shadow root gets **no**
web-elements layout CSS — flex defaults silently break (a `<view>` renders
`flex-direction: row` instead of Lynx's `column`). `in_shadow.css` also opens
with `@import url("@lynx-js/web-elements/index.css")`, a bare specifier a
Blob-URL stylesheet could never resolve anyway.

Because this repo builds with **Turbopack**, the usual Webpack fix
(`NormalModuleReplacementPlugin` + `asset/source`) doesn't apply. Instead:

1. `pnpm lynx:shadow-css` (`scripts/lynx-shadow-css-bundle.mjs`) recursively
   flattens `in_shadow.css` + every `@import` (bare *and* relative) into one
   self-contained string, emitted as `systems/windows/lib/lynx-shadow-css.ts`.
   `predev` / `prebuild` regenerate it so CI stays consistent.
2. `lynx-player.tsx` injects that string as a `<style>` into each shadow root
   itself (first child, so a card's own styles still win) — bundler-agnostic,
   and it sidesteps web-core's broken `?inline` path entirely.

Verified: after the fix a fresh `x-view` in the shadow root computes
`flex-direction: column` (244 rules applied) instead of the broken `row`.

## Launching

Three ways in, all routing through `useWindows()`:

- **Folder.** `components/apps/app-folder.tsx` icons stay real anchors to each
  app's `url`, so ⌘/middle-click still opens the site in a new tab. A plain
  left-click is intercepted (`openApp`) to open the window instead —
  progressive enhancement that composes with the folder's drag-to-reorder and
  snap-paged overflow.
- **Command palette.** Spotlight-style Apps strip in ⌘K
  (`systems/command/apps-launcher.tsx`): a headerless horizontal icon row
  (same for browse + search; hidden when nothing matches). **Load…** opens an
  in-palette glass form (URL only) instead of `window.prompt`.
- **Over-the-air.** `openBundleUrl(url)` opens an ad-hoc Lynx window for any
  `.web.bundle` URL. Reachable from the palette action above and from the
  DevTool.
- **In-app browser.** `openUrl(url, { title })` opens any web page in a
  window — the same frame, pill and menu an app gets, keyed by URL so the same
  page focuses its window rather than opening a second. This is where a link
  card a commit attaches opens (see
  [Attachments System](./system-attachments.md)): a window on a desktop, and
  on a phone the window sheet, stacked over the attachment sheet the `Visit`
  came from, the way a mobile app opens a link in its own in-app browser and
  returns to the screen underneath when it is put away. Pages whose headers
  refuse framing never get here, they go to a tab. `Open in browser` in the
  menu is the way out. The browser is an app with `runtime: "web"`; a second
  runtime for links — a reader, a different frame — would be another `AppLink`
  and another row in the attachments policy, nothing more.

## Unified windows

A design direction under trial, behind one switch: ⌘K → **Unified Windows**
(`hux_windows_unified` in localStorage, `lib/unified.ts`). Off, nothing
changes. On, every built-in the site opens lives in this window system rather
than in a surface of its own, and a fullscreen page can shrink into a window
too.

The site had grown three window systems. Apps were windows. The music
playlist and the wallpaper picker were `AdaptiveSurface`s whose desktop shape
is a `SurfaceWindow` — floating, draggable, but not in the z-order, not in the
dock, not minimizable. The theater had a modal and a PiP of its own. Three
kinds of floating box, each with its own rules for moving, stacking and going
away. The direction is one: everything is an app, and an app is a window.

### Two more runtimes

| Runtime | Body | What it is |
|---------|------|-----------|
| `system` | the feature's own component, in this document (`SystemAppFrame`) | Music, Wallpaper, Theater (`SYSTEM_APPS`) |
| `page` | a same-origin frame of the route, scoped to its section (`PageFrame`) | Writing, Prompt, Works — any route but home (`pageApp`) |

Both are ordinary `AppLink`s with icons in `public/app-icons/`, so the ⌘K
strip, the dock pill, the menu and the badge (a small window for system, a
folded page for page) all speak them without special cases. With the switch
on they lead the ⌘K Apps strip.

**System apps render in this document**, which is the point: the music a
window shows is the music the dock is playing, the wallpaper it picks is the
one behind it. The window system does not import the features — the layout
hands it their bodies (`components/apps/desktop-windows.tsx` →
`SystemAppsProvider`), as it hands the dock its activities. Each body is given
the surface context answering as a window (`sheet` on a phone), and the window
it is in (`useHostWindow`: its instance, its shape, its z-index).

**The switchboard.** Every existing way in still asks the feature: the dock's
playlist button calls `openPlaylist`, ⌘K's Wallpaper row `openPicker`, a talk
card `openVideo`. `DesktopWindows` turns the ask into the window, and the
features only learn one thing — with the switch on, keep the old surface shut.
Music and Wallpaper are a yes/no, mirrored both ways (the feature asked to open
brings its window forward; the window put away closes the feature's surface).

**An app with a Live Activity is its Live Activity in the dock.** Music and
Theater carry `activity: true`: minimized, their window takes no pill of its
own, because the music card / the "now watching" card already stands there, and
brings the window back.

### Music

On a phone the window is a sheet, and it stays what the playlist sheet was: the
now-playing card over the list. On a desktop it is an app, and gets to be one
(`music-window.tsx`): the artwork blurred behind the whole window under a veil
of the page ground, a scrubber you can drag (`seek` on the music provider), a
transport sized for a pointer, and Music.app's three sizes, chosen from the
window's own box — not the viewport's:

| Layout | When | What |
|--------|------|------|
| wide | ≥ 620 × 380 (it opens `landscape`) | the now-playing pane beside the playlist |
| compact | a portrait window | the player on top, the list under it |
| mini | under 340 wide or 300 tall | the artwork is the window; title, scrubber and transport ride on it |

The track list's columns read their container (a container query) rather than
the shape they were given, so the list breaks into columns wherever it has the
room.

### Theater

The window is the modal, gathered into a window — the same player, not a
second one. On a screen with room for the theater, `open` resolves to mode
`window` (a phone keeps its PiP, as it always has, and never gets the window).

The stage is the provider's singleton — the element the YouTube player lives
in, which is why playback survives every change of mode — and a window cannot
hold it: moving it into the window's DOM would reload the video. So the window
keeps a **slot** and hands it to the provider (`setWindowSlot`); the stage
stands over the slot, every frame (`useFollow` in `stage.tsx` — windows drag and
resize by writing their DOM, and open and genie with transforms, so the box is
only known by measuring it), at **the window's own z-index**: above the Theater
window, below any window in front of it. That is what the rank-based z-index
above is for.

Everything around the stage is the modal's: the title and the cluster (source
link, the surface switch) above, the glass orbs either side, the album tabs and
the rail below, on the modal's frosted ground. The close is the window's own.
And the switch means what it always meant, so **window ⇄ PiP ⇄ audio** are the
one player moving: PiP hands the stage to the PiP corner and the window goes
(handed off, not ended); PiP's Theater brings the window back and the stage
glides into its slot; Audio is the window in the dock, as the "now watching"
Live Activity. Closing the window by hand ends the session.

### Shrinking a page

⌘K → **Shrink to Window** on any page but home. The route opens in a page
window that grows out of the whole viewport (`origin` on the window instance:
the first frame is the full-screen rect, expressed about the centre, so the
dock genie needs no special case), and the top document goes home — to the
desktop the window now sits on. One window per section: shrinking another
article while Writing is open sends that window there.

**A page window holds a section, not the site.** A whole page of this site can
do anything the site can — navigate anywhere, play videos, open windows — and
left alone, a page window was a second copy of the site running inside the
first: follow the right links and it held the home page. So the frame's name
carries its scope (`hux-window|/writing`), and inside it (`EmbeddedPage` in
`os-chrome.tsx`) everything past the section is handed to the top document —
the OS — through the bridge the top publishes on `window.__huxOS`
(`lib/os.ts`):

| What leaves | How it is caught | Where it goes |
|-------------|------------------|---------------|
| a link to another section (or home) | a capture-phase click listener, ahead of the page's router — whatever the link's target | the top navigates there; the window stays |
| a navigation without a link (a widget's `router.push`) | the pathname, on arrival | the top goes there; the window goes back to where it was |
| a video, a deck | the theater provider's `openVideo` / `openMedia` | the top's theater — one player |
| a window (the in-app browser a link card opens) | the window provider's `openApp` | the top's desktop |
| ⌘K, `/` | a capture-phase key listener | the top's palette |

Files (`/img/…`, a poster a lightbox opens) are content, not places, and stay
the page's. Inside its section the window browses freely: Writing goes from the
list to an article and back.

The frame also knows to draw none of the OS: a boot script in `<head>`
(`EMBED_BOOT_SCRIPT`, before the bezel's) marks `<html data-embedded="window">`
when a framed document carries the name, so `OsChrome` — dock, window layer,
palette, FAB, devtool, the OS's sheets — is hidden by CSS from the first frame
and unmounted once hydrated, and the wallpaper and the bezel stay off. The name
rather than a query parameter, because a frame's name survives every
navigation inside it.

**Expand to page** (the window menu, page windows only) reads where the frame
has got to — not where it started — sends the top document there and closes
the window.

### Open questions

- **The springboard.** The home app folder still lists only `content/apps.json`
  apps: its saved order reconciles against that list, and would drop built-in
  ids whenever the switch is off. Once the direction settles, built-ins belong
  there — the site's own apps first.
- **A minimized Music app before anything played** has no Live Activity yet,
  so no dock presence; it comes back from ⌘K or the home widget.
- **The backstop shows the page it bounces.** A navigation without a link is
  caught on arrival, so the window paints the other section for a moment
  before going back. Links — nearly every way out — never get that far.
- **Cost.** A page window is a second copy of the app shell. Fine for one or
  two; a desktop of ten would want the pages rendered in-document instead.

## DevTool inspector

The DevTool panel (`systems/devtool/panel.tsx`) has an **Apps** section: an
OTA bundle-URL input + Load, a live list of open windows with full metadata
(runtime, flavor, source, size preset, rect, bundle/url), and the registry with
Open / open-externally. Handy for inspecting *any* app's config and for loading
a bundle you're iterating on.
```
