# Window System — chrome windows for apps

Tapping an app on the home-screen **app shelf** opens it in a draggable,
resizable **chrome window** — the macOS/iPadOS "open an app on the desktop"
metaphor. One window frame hosts two runtimes:

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
│   └── geometry.ts             # placement, clamping, working area
├── components/
│   ├── window-layer.tsx        # <WindowLayer> — the fixed "desktop" surface
│   ├── window.tsx              # <Window> — drag / resize / traffic lights
│   ├── traffic-lights.tsx      # close · minimize · zoom controls
│   ├── app-frame.tsx           # runtime switch: WebFrame vs LynxFrame
│   ├── web-frame.tsx           # <iframe> + "won't embed" fallback
│   ├── lynx-frame.tsx          # ssr:false boundary around the player
│   ├── lynx-player.tsx         # <lynx-view> — the Lynx Player
│   └── app-badge.tsx           # runtime marker drawn on each app icon
├── lynx-view.d.ts              # <lynx-view> JSX typing
└── index.ts
```

## The app model

Apps are authored in [`content/apps.json`](../content/apps.json). Two fields
drive the window system (see `AppLink` in `lib/app-icon-core.ts`):

- `runtime` — `"web"` (default, an iframe) or `"lynx"` (the Lynx Player).
- `flavor` — for Lynx apps, `"react"` or `"vue"`. Cosmetic: it tints the badge.
- `bundleUrl` — for Lynx apps, the `.web.bundle` the player loads (falls back
  to `url`). `url` stays the canonical "open externally" target for every app.

```json
{
  "id": "lynx-react-counter",
  "title": "Counter",
  "runtime": "lynx",
  "flavor": "react",
  "bundleUrl": "/lynx/react-counter.web.bundle",
  "url": "https://lynxjs.org"
}
```

The demo Lynx bundles under `public/lynx/` are built with `@lynx-js/rspeedy`
(the `web` environment target emits `main.web.bundle`) from small React-Lynx
and Vue-Lynx apps, then served as static assets.

## Runtime badge

Every tile wears a corner **badge** (`app-badge.tsx`) saying how it runs, the
way iOS overlays a glyph on Clip / AR / web-clip icons:

- **web** → a globe.
- **Lynx · React** → the Lynx head, tinted React blue (`#149eca`).
- **Lynx · Vue** → the Lynx head, tinted Vue green (`#42b883`).

Flavour is colour-only, so React-Lynx and Vue-Lynx read apart at a glance
without a second glyph. The same badge appears in each window's title bar.

## The manager

`WindowProvider` is a pure state machine — it owns the set of open windows and
their stacking, nothing visual (same split as the Dock system):

- **One window per app id.** Tapping an already-open app focuses (and
  un-minimizes) its window instead of spawning a duplicate — the home-screen
  mental model, not "⌘N a new document".
- **Focus = z-order.** A monotonic counter bumps the focused window above all
  others; `focusedId` is simply the highest-`z` non-minimized window.
- **Minimize** keeps the window in the manager but drops it from the render;
  tapping its icon (`openApp` → restore) brings it back.
- **Zoom** toggles maximize ⇄ restore, stashing the pre-maximize rect.
- **Esc** closes the front window. A window `resize` listener re-clamps every
  window (and re-fits maximized ones) to the working area.

`geometry.ts` holds the pure math: a **working area** inset from the viewport,
a **cascade** so stacked opens fan out, and two clamps — `clampRect` (keep a
window fully inside, used on resize) and `clampDrag` (macOS-style: let a window
hang off the edges but never lose its title bar).

## The chrome

`window.tsx` renders one window. The load-bearing detail is gesture handling:

- **Drag** (title bar) and **resize** (eight edges) write geometry **straight
  to the DOM node** for the duration of the gesture — no per-frame React
  churn, which iframes and Web Workers repaint badly on. The final rect is
  committed to the provider once, on pointer-up.
- A transparent **gesture shield** covers the body while dragging/resizing.
  Without it, the iframe swallows the `pointermove` stream the instant the
  cursor crosses into it and the drag freezes.
- Position/size changes the *manager* makes (maximize, restore, resize-clamp)
  ride a CSS transition; gestures switch it off so dragging stays 1:1.

`WindowLayer` is a single `position: fixed; inset: 0` surface mounted once at
the app root (in `app/layout.tsx`). It's `pointer-events: none` so it never
steals clicks from the page; each window re-enables events for itself.
`AnimatePresence` plays the open/close spring.

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
thread). No COOP/COEP headers are required; the bundle is served same-origin
from `public/` so the Worker fetch isn't cross-origin.

## Opening from the shelf

`components/home/app-shelf.tsx` icons stay real anchors to each app's `url`, so
⌘/middle-click still opens the site in a new tab and the tile is a proper link
at rest. A plain left-click is intercepted (`useOptionalWindows().openApp`) to
open the chrome window instead — progressive enhancement, and it composes with
the shelf's existing nested drag-to-reorder without swallowing either gesture.
```
