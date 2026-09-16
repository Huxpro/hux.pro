# Window System — chrome windows for apps

Tapping an app (home-screen **app shelf** or the ⌘K palette) opens it in a
draggable, resizable window — the macOS/iPadOS "open an app" metaphor, in a
Stage-Manager key: edge-to-edge content under a single floating **pill**. One
window frame hosts two runtimes:

- **Web apps** load in an `<iframe>`.
- **Lynx apps** load in a **Lynx Player** — `@lynx-js/web-core`'s `<lynx-view>`
  element running a `.web.bundle`, the same dual-thread (main + background
  Worker) model Lynx uses on-device, reproduced in the browser.

The chrome around them is identical; only the body differs. That's the whole
idea — one window, two runtimes.

## Overview

```
systems/windows/
├── provider.tsx                # WindowProvider + useWindows (state machine)
├── lib/
│   ├── types.ts                # WindowInstance, Rect, WindowMode
│   ├── geometry.ts             # size presets, placement, clamps, working area
│   └── lynx-shadow-css.ts      # generated: flattened web-elements layout CSS
├── components/
│   ├── window-layer.tsx        # <WindowLayer> — the fixed "desktop" surface
│   ├── window.tsx              # <Window> — drag / resize / edge-bounce
│   ├── window-chrome.tsx       # the control dots (top-left desktop / centre mobile)
│   ├── minimized-dock.tsx      # <MinimizedWindows> — dock pills (direct restore)
│   ├── app-frame.tsx           # runtime switch: WebFrame vs LynxFrame
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

- `runtime` — `"web"` (default, an iframe) or `"lynx"` (the Lynx Player).
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

## The chrome

Content is **edge-to-edge**; the controls (`window-chrome.tsx`) are the classic
red/amber/green dots, placed to feel native per platform:

- **Desktop (pointer)** → a top-**left** cluster (macOS). The dots are always
  full-size but sit **dim grey on a chromeless (invisible) pill** at rest; on
  hover the pill fills in with glass, the dots take their colour (only for the
  active window — a passive window's dots stay grey), and the ×/−/+ glyphs plus
  the app **title** fade in. Nothing changes position between states, so the
  buttons are stable mouse targets.
- **Mobile (touch)** → a small, **centred**, always-grey ••• pill. The dots are
  inert on touch (an indicator, not three tiny targets); a tap opens the menu,
  which on touch is an **action sheet**, not a popover.

The window **menu** (title header + size presets + Open in browser + Minimize +
Close) opens via **right-click**, a **tap on the title**, or a **long-press**
(including long-pressing a dot) — never from a stray touch, since armPointer
(`lib/pointer.ts`) disambiguates *tap → menu*, *hold → menu*, *move → drag*.
There's deliberately **no caret**. Clicking the green dot zooms; double-clicking
the top band zooms too.

The menu takes the shape the device asks for, and only the shape — both render
the same `WindowMenuBody`, so the two can't drift apart:

- **Desktop** → a **popover** under the pill: portaled to `<body>` with a
  full-viewport scrim (so a click anywhere — even over an iframe, whose pointer
  events don't bubble — dismisses it), left-aligned under the pill and clamped
  into the viewport.
- **Touch** → a **`SurfaceSheet`** ([Surface System](./system-surface.md)) from
  the bottom edge, content height (`height="auto"`), with the app header on top,
  the actions as thumb-sized rows in the same order, and Close in a group of its
  own, in red — iOS's answer to "long-press an object, get its actions". Nothing
  in `window-chrome.tsx` computes a position for it: the sheet brings its own
  scrim (above the window layer and its iframes), its own Escape, drag-to-dismiss
  and the shared stack, so a playlist or wallpaper sheet already up steps back
  under it. A row **dismisses the sheet and then acts** — `close` unmounts the
  chrome, and with it a sheet that would otherwise vanish mid-animation.

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

`WindowLayer` is a single `position: fixed; inset: 0` surface mounted once at
the app root (in `app/layout.tsx`), `pointer-events: none` so it never steals
page clicks. It sits at `z-40` — below the dock (`z-50`) and the command palette
(`z-60`), so ⌘K always wins. `AnimatePresence` plays the open/close spring.

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

## DevTool inspector

The DevTool panel (`systems/devtool/panel.tsx`) has an **Apps** section: an
OTA bundle-URL input + Load, a live list of open windows with full metadata
(runtime, flavor, source, size preset, rect, bundle/url), and the registry with
Open / open-externally. Handy for inspecting *any* app's config and for loading
a bundle you're iterating on.
```
