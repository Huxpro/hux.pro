---
skills: [base-ui-drawer]
---

# Window System: chrome windows for apps

Tapping an app (the home-screen **app folder** or the ⌘K Apps strip) opens it
in a draggable, resizable window. The metaphor is macOS/iPadOS "open an app",
in a Stage-Manager key: edge-to-edge content under a single floating **pill**.
On a phone the same app is a **sheet** instead, with one grip for chrome,
because that is the idiom a screen that size already uses. One window frame
hosts two runtimes:

- **Web apps** load in an `<iframe>`.
- **Lynx apps** load in a **Lynx Player**: `@lynx-js/web-core`'s `<lynx-view>`
  element running a `.web.bundle`. It uses the same dual-thread (main +
  background Worker) model Lynx uses on-device, reproduced in the browser.

The chrome around them is identical; only the body differs.

This is not the `window` shape of `AdaptiveSurface` (the wallpaper picker, the
playlist), which is a floating panel for site UI and is covered in
[Surface System](./system-surface.md). An app window is its own system, with its
own drag, and registers nothing in the devtool's draggable lists.

## What it looks like done well

![Cat Wand, a Lynx app, open in a portrait window on the desk: edge-to-edge black content, the traffic-light pill lit at its top left with the app's title beside it.](/img/docs/system-windows/desk-window.png)

A Lynx app (Cat Wand, opened from the ⌘K Apps strip) on a 1280px desk, with
the pointer on its pill. At rest the pill is invisible and its dots are dim
grey; under the pointer it fills with glass, the dots take their colours and
the title slides in. There is no title bar.

![The window menu as a popover under the pill: the app header (Cat Wand, Lynx · Vue), Portrait (checked), Landscape, Maximize, then Reload, Minimize, Close.](/img/docs/system-windows/desk-menu.png)

The same window's menu, from a right-click on the pill. A Lynx app has no
"Open in browser" row; a web app would have one between Reload and Minimize.

![The Dock band at the top of the page holding one capsule: Cat Wand's icon with its Lynx badge, and its name.](/img/docs/system-windows/minimized.png)

Minimized, it parks as a capsule in the Dock's live-activity band. The Lynx
view behind it is still running; a tap brings it back where it was, in the
state it was in.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-windows/phone-sheet.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="Cat Wand on a phone: a sheet from the bottom edge with the app edge to edge, three dim dots floating centred at its top as the only chrome." />
  <img src="/img/docs/system-windows/phone-menu.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same window after a tap on the dots: the dots lit on glass, the window stepped back, and the menu as a sheet stacked on it with Reload, Minimize and a red Close." />
</div>

The same app on a phone (393pt wide, headless, so no safe-area insets). Left:
a sheet resting just under the Dock band, its grip the three dots floating
over the content. Right: a tap on the grip lights it and stacks the menu as a
sheet on the window, which steps back. No size rows: the detent is the size.

What to hold a change to:

- The app owns its body. Nothing over it but the pill, and the pill is
  invisible until wanted.
- Putting an app away never loses it. Only Close (and Reload) restarts one.
- One window per app. Opening it again focuses it.
- The menu is the same list everywhere; only its container changes.
- No control can go missing: whatever state the grip is stranded in, it still
  shows the dots.

## How it works

```
systems/windows/
├── provider.tsx                # WindowProvider + useWindows (the state machine)
├── lib/
│   ├── types.ts                # WindowInstance, Rect, WindowMode
│   ├── geometry.ts             # size presets, placement, clamps, working area
│   ├── pointer.ts              # armPointer (tap · long-press · drag), TAP_SLOP
│   └── lynx-shadow-css.ts      # generated: flattened web-elements layout CSS
├── components/
│   ├── window-layer.tsx        # <WindowLayer>: the fixed "desktop" surface
│   ├── window.tsx              # <Window>: the shape fork; <DesktopWindow>'s gestures
│   ├── window-sheet.tsx        # <WindowSheet>: a window on a phone, as a sheet
│   ├── window-grip.tsx         # the pill doing double duty as the sheet's handle
│   ├── window-pill.tsx         # TrafficDots, PillTitle, pillShell: one look, two homes
│   ├── window-chrome.tsx       # <WindowChrome>: the desktop pill + popover menu
│   ├── window-menu.tsx         # WindowMenuBody (the rows) + WindowMenuSheet
│   ├── minimized-dock.tsx      # <MinimizedWindows>: Dock capsules (direct restore)
│   ├── app-frame.tsx           # runtime switch: WebFrame vs LynxFrame; appGround
│   ├── web-frame.tsx           # <iframe> + "may block embedding" fallback
│   ├── lynx-frame.tsx          # ssr:false boundary around the player
│   ├── lynx-player.tsx         # <lynx-view>: the Lynx Player
│   ├── app-badge.tsx           # runtime marker on icons
│   └── app-icon-plate.tsx      # the app's icon, for the menu header and Dock pill
├── lynx-view.d.ts              # <lynx-view> JSX typing
└── index.ts
```

`WindowProvider` is mounted in `shared/providers.tsx`. `app/layout.tsx` mounts
`<WindowLayer />` once, and `<MinimizedWindows />` as a child of `<Dock>`.

### The manager

`WindowProvider` is a pure state machine. It owns the set of open windows and
their stacking and nothing visual (same split as the Dock system).

![State diagram: openApp, openUrl and openBundleUrl lead to mode "normal"; minimize(id) leads to mode "minimized" and restore(id) back; reload(id) bumps generation and remounts AppFrame; close(id) from either state unmounts. Below: a minimized desktop window stays rendered by WindowLayer at opacity 0 and inert; a minimized phone window is a closed SurfaceSheet with keepMounted.](/img/docs/system-windows/lifecycle.svg)

Every call in `provider.tsx` and what it does to a window. The bottom row is
the promise both shapes keep, each by its own mechanism.

- **One window per id.** An app's id is its `content/apps.json` id; a page is
  `url:<url>`, an ad-hoc bundle `ota:<url>`. Opening an id that is already open
  focuses (and un-minimizes) its window instead of spawning a duplicate,
  following the home screen rather than "⌘N a new document".
- **Focus = z-order.** A monotonic counter bumps the target above all others;
  `focusedId` is the highest-`z` non-minimized window. `focus` is a no-op on
  the front window, since it fires on every pointer-down.
- **Minimize** genies a desktop window up toward the Dock band at the top
  (opacity 0, scale 0.08) and parks it there as a capsule
  (`MinimizedWindows`, sharing the row with the music / ambient activities).
  Tapping the capsule (`restore`) or the app's icon (`openApp`) brings it back
  and focuses it. **Minimize is not an unmount**: `WindowLayer` keeps every
  window, minimized included, mounted, just transparent and `inert`, so its
  iframe / `<lynx-view>` keeps running and its state survives (a counter at 5
  comes back at 5).
- **Reload** bumps `generation`, which keys `<AppFrame>`: a remount is the only
  restart available for a cross-origin iframe or a Lynx runtime.
- **Close** is the only unmount and the only `AnimatePresence` exit (a shrink
  in place).
- **Size** is a preset (`portrait` / `landscape` / `max`), set via
  `setSizePreset`; `max` is the maximized state. **Zoom** (green dot / double
  click on the top band, `toggleMaximize`) toggles `max` ⇄ the previous preset,
  stashing the pre-max rect in `restoreRect` / `restorePreset`.
- **Keys go to the front window.** Esc closes it, except while the ⌘K palette
  or a window's popover menu is up (`[cmdk-root], [role='menu']`) or a field is
  focused, so dismissing an overlay never also closes the window behind it. On
  a phone, Esc reaches the sheet first and minimizes instead. ⌘A outside a
  field selects nothing, so a ⌘A aimed at an app does not paint the page behind
  it blue.
- **The viewport moves.** `onViewportChange` (one `resize` listener, coalesced
  to one frame, for the whole system) re-fits maximized windows to the working
  area and clamps the rest.

### Sizing

`geometry.ts` holds the pure math. The **working area** insets 12px
(`MARGIN`) from the sides and bottom and 56px (`DOCK_BAND`) from the top, so
windows, a maximized window's top edge included, clear the top-centre Dock.

| Preset | Size (capped by the working area) | For |
|---|---|---|
| `portrait` | 400×760 | a phone-shaped card (Lynx, mobile web); the Lynx default |
| `landscape` | 1024×680 | a wide card (docs, desktop web); the web default |
| `max` | the whole working area | still with the roomy top inset: "留白", not fullscreen |

An app's `size` in the registry overrides the default. New windows cascade
28px down-right per window opened (modulo 6), except `max`. The smallest a
resize allows is 300×220 (`MIN_SIZE`). `clampRect` keeps a whole window inside
the working area (resize, relayout); `clampDrag` is lenient: a window may hang
off the left, right and bottom as long as 88px of it stays on screen and its
top 34px (`CHROME_H`) stays reachable.

### Two shapes

An app window takes the shape the viewport asks for, and `Window`
(`window.tsx`) is only the fork, on
`WINDOW_PRESENTATION = { base: "sheet", sm: "window" }`:

| Width | Shape | What it is |
|-------|-------|-----------|
| `< 640px` | **sheet** (`WindowSheet`) | A `SurfaceSheet` from the bottom edge: three detents for its size, the shared stack for its depth, its grip for all of its chrome. |
| `≥ 640px` | **window** (`DesktopWindow`) | The draggable, resizable box. |

The decision is the surface system's breakpoint map (`SURFACE_BREAKPOINTS.sm`),
the same one that turns the command palette into a sheet, and `isMobile`
(`lib/geometry.ts`) is defined from it, so the rules that follow from being a
sheet (one app at a time) turn on exactly when the shape does. Crossing the
breakpoint remounts the app (two components, so the iframe reloads); resizing
a phone into a desktop mid-app is not a gesture anyone makes.

### A phone window is a sheet

- **Size** is the detent the finger left it at. There are three, not the
  site's shared pair: the lowest and highest of `SHEET_DETENTS` (0.7 and 1),
  with the window's own `dockDetent()` between them. A window opens there,
  where a desktop window's top edge sits, just clear of the Dock band
  (`1 - DOCK_BAND / height`, kept between 0.8 and 0.97, recomputed when the
  viewport changes), because that is the size an app wants. From there a drag
  takes it to the very top, or down to 0.7 to see the page behind it. The menu
  drops the size presets here: on a phone they all resolved to the same
  rectangle anyway.
- **The grip is the only handle.** Every other sheet drags from anywhere; a
  window's body belongs to the app, because a game that follows a finger
  (逗猫棒) would otherwise slide the window away under it. The body carries
  Base UI's `data-base-ui-swipe-ignore`, so a touch starting there never
  becomes a swipe. An iframe never needed it, since its touches don't reach
  this document. A Lynx view lives in the DOM, though, and so does the loading
  spinner before either runtime arrives.
- **It comes back the size it lives at.** A flick down ends at the lowest
  detent by definition, so a window put away resets to the dock detent and is
  restored there rather than arriving shrunk.
- **Put away, not killed.** A drag down (or Esc) is `minimize`, never `close`.
  The sheet closes but `keepMounted` leaves its DOM in place, so the iframe or
  Lynx view keeps its document. It comes back from its Dock capsule. Close is
  the menu's destructive row and nothing else, so no stray flick can lose an
  app's state.
- **One at a time.** Opening or restoring an app on a phone puts the others in
  the Dock (`soloOnPhone` in `provider.tsx`): a second sheet would bury the
  first rather than sit beside it, and the Dock is the app switcher. Windows
  coexist from `sm` up, as windows do.
- **It stacks on whatever opened it.** A window sheet is a sheet like any other
  in the shared stack, so one opened from the attachment sheet (a `Visit`)
  sends that sheet a step back and brings it forward again when the window is
  put away. It also paints above it even when it was kept mounted from an
  earlier visit, because the stack's order is the paint order
  ([Surface System](./system-surface.md), "Stacking").
- **The menu** (`WindowMenuSheet`, `presets={false}`) is a sheet stacked on the
  window. It is a React child of the window's sheet and says `nestedIn`, so
  Base UI treats it as a real nested drawer and sends the window a step back,
  the way iOS presents a sheet from a sheet.
- **It paints in the surface layer**, not `WindowLayer`: the sheet is portaled
  at the sheets' `z-60` base, and holds `AnimatePresence` open through
  `usePresence` so its exit plays before the window is dropped.

### The grip: the window's pill, doing double duty

A sheet already has a grabber, so the pill does not stack on top of one: they
are the same object (`window-grip.tsx`, passed as `grip` with `gripOverlay`).
It is the window's own chrome, unchanged: the centred, chromeless cluster of
traffic lights over edge-to-edge content, with nothing that reads as a title
bar. It is also what you drag the sheet by. A tap opens the menu.

It looks exactly like the desktop pill (`pillShell` and `TrafficDots` from
`window-pill.tsx`, minus the hover), down to the padding: chromeless with
three dim dots at rest, lighting into glass under a thumb and while its menu
stands open. That light is the tap feedback, and CSS cannot give it here. A
touch never sets `:active` (the grip is `touch-none` and the press is
preventDefaulted out from under it), and a mouse press sets it and then *never
clears it*, because the popup captures the pointer and Chrome never sees the
release. So the lit state is ours, and it is built to be **safe when
stranded**: lit is glass with bright dots, rest is the pill the desktop wears,
and a press whose release goes missing leaves the pill looking pressed (wrong,
but never missing) until `PRESS_TIMEOUT` (4s) takes the light back. That is
the bar anything on this control has to clear (see History for what failed
it).

The tap is the one thing the grip owns, and the one thing that can be lost
harmlessly (no menu opens; the next tap works). It cannot be a click handler
(above `Drawer.Content` there are no clicks) and cannot be `armPointer` (its
long-press would fire mid-drag, with no moves arriving to cancel it). A press,
and a `pointerup` that comes back within `TAP_SLOP` (6px), is a tap. The grip
listens on the document in the capture phase, ahead of Base UI, and opens the
menu in a `setTimeout` *after* the release: flushing a nested drawer into the
middle of the sheet's own gesture bookkeeping leaves the sheet believing it is
still held.

Base UI never starts a swipe from
`button, a, input, select, textarea, label, [role="button"]`, so the pill is a `<div>` (`aria-hidden`), its dots are inert
(an indicator here, not three targets), and the accessible control is a
visually hidden `<button aria-haspopup="menu">` beside it.

The one thing the phone pill does not borrow is its target.
`[data-window-grip]::before` (`app/globals.css`) takes the hit area to 72×44.5
from a pill of 48×28.5, because this pill is also a handle. Target and look are
separate on purpose: a pill that one day changes its look must not take its
target down with it.

### The desktop chrome

This is the chrome of a *windowed* window (`window-chrome.tsx`); a phone window
wears the grip instead. Content is **edge-to-edge**; the controls are the
classic red/amber/green dots, placed to feel native per platform:

- **Pointer** → a top-**left** cluster (macOS). The dots are always full-size
  but sit **dim grey on a chromeless pill** at rest; on hover the pill fills
  with glass, the dots take their colour (only on the focused window; a
  background window's stay grey), and the ×/−/+ glyphs plus the app **title**
  fade in. Nothing moves between states, so the buttons are stable targets.
- **Touch at `sm` and up** (a tablet) → a small, **centred**, always-grey
  pill. The dots are inert on touch (an indicator, not three tiny targets); a
  tap opens the menu as an action sheet.

The menu (app header, size presets, Reload, Open in browser for web apps,
Minimize, Close) opens on **right-click**, a **tap** on the pill anywhere but a
live dot, or a **long-press** (450ms). `armPointer` (`lib/pointer.ts`) tells
*tap → menu*, *hold → menu* and *move past `TAP_SLOP` → drag* apart, so a tap
never jerks the window and a drag never pops the menu. There is no caret. The
green dot zooms; so does a double-click on the top band.

What the menu offers is one list (`WindowMenuBody` in `window-menu.tsx`);
where it is offered is three containers, so the shapes can't drift apart:

- **Pointer** (`hasFineHoverPointer`) → a **popover** under the pill: portaled
  to `<body>` with a full-viewport scrim at `z-[55]` (so a click anywhere
  dismisses it, even over an iframe, whose pointer events don't bubble),
  left-aligned under the pill and clamped into the viewport.
- **Touch, windowed** → `WindowMenuSheet`, a `SurfaceSheet`
  ([Surface System](./system-surface.md)) from the bottom edge, `fitContent`,
  `modal`, with the app header on top, the actions as thumb-sized rows in the
  same order, and Close in a group of its own, in red. The sheet brings its own
  scrim (above the window layer and its iframes), Escape, drag-to-dismiss and
  the shared stack.
- **Touch, on a phone** → the same sheet, `nestedIn` the window's own, without
  the size presets.

A sheet row **dismisses the sheet and then acts** (after
`SURFACE_TRANSITION_MS`): `close` unmounts the window, and with it a sheet that
would otherwise vanish mid-animation. iOS does the same.

Gestures on a desktop window (`DesktopWindow` in `window.tsx`):

- **Drag** (the pill, or a 16px band along the top edge as a grab tolerance)
  and **resize** (6px edges, 14px corners; there is no top edge handle, since
  the top is the drag band, so top-height resize lives on the top corners)
  write geometry **straight to the DOM node** for the gesture's duration and
  commit once on pointer-up (`setRect`). That avoids per-frame React churn,
  which iframes and Web Workers repaint badly on.
- Drag is **free**: you can tuck a window mostly off-screen. On release
  `clampDrag` pulls it back just far enough to keep the chrome grabbable, on a
  spring with a small overshoot as an **edge bounce**.
- A transparent **gesture shield** covers the body while dragging or resizing,
  so the iframe can't swallow the `pointermove` stream and freeze the drag.
- Maximized windows neither drag nor resize.

`WindowLayer` is a single `position: fixed; inset: 0` surface at `z-40`,
`pointer-events: none` so it never steals page clicks (each window turns them
back on for itself). It sits below the Dock (`z-50`), the sheets (`z-60` and
up) and the ⌘K popover (`z-[10050]`), so ⌘K always wins.

### The runtimes

**WebFrame.** An `<iframe>` (sandboxed defensively) with a graceful fallback:
many sites refuse framing via `X-Frame-Options` / CSP `frame-ancestors`, and
the browser blocks that at a layer JS can't read cross-origin. So instead of
faking detection, it waits for the frame's `load`; if that hasn't fired after
4s, a non-blocking banner ("This site may block embedding.") offers to open the
app in a new tab. Until then the site's glow runs along the top as a loading
bar.

**LynxFrame → LynxPlayer.** `<lynx-view>` and its runtime instantiate Web
Workers the moment their module is imported, so the player **cannot touch the
server**. `lynx-frame.tsx` loads it through `next/dynamic` with `ssr: false`,
which keeps these two side-effect imports off the server entirely:

```ts
import "@lynx-js/web-elements/index.css"; // element styles
import "@lynx-js/web-core/client";         // registers <lynx-view> + runtime
```

`@lynx-js/web-core` also needs `@lynx-js/lynx-core` installed (its background
thread imports `@lynx-js/lynx-core/web`). No COOP/COEP headers are required.
The bundle fetch happens in web-core's background thread: a **built-in**
(`/…`) bundle is served same-origin from `public/`, and an **online**
(`http(s)://…`) bundle is fetched cross-origin, so the remote host must send
permissive CORS. BusyWeek's origin serves its `.web.bundle` with
`Access-Control-Allow-Origin: *`.

Three fidelity details let *arbitrary* Lynx cards (not just inline-styled
demos) render correctly:

- a **per-instance `lynx-group-id`**, so concurrent windows never share a
  background Worker;
- **container-query units** (`container-type: size`,
  `--rpx-unit: calc(100cqw / 750)`, `--vh-unit` / `--vw-unit`, `transform-vh` /
  `transform-vw`), so Lynx's `rpx` / `vh` / `vw` resolve against the *window*
  rather than the viewport, and a real card scales to the window it's in;
- **`SystemInfo` from the window.** web-core defaults `pixelWidth` /
  `pixelHeight` to `window.screen`, so a card that places itself in "screen"
  coordinates (逗猫棒's orb) would land off-canvas in a portrait window. The
  player measures its container first and passes `browser-config` before the
  bundle loads. Only the first box counts: `SystemInfo` is snapshotted when the
  bundle evaluates.

#### Shadow-root layout CSS

`web-core` styles each `<lynx-view>` shadow root by importing its layout CSS
Vite-style (`import … from '…/in_shadow.css?inline'`, still so in the pinned
0.22.2) and Blob-ing that string into a `<link>`. Under **Turbopack** (and
Webpack) `?inline` does *not* yield the CSS string: the module's default
export is `undefined`, so the Blob becomes the literal text `"undefined"` and
the shadow root gets **no** web-elements layout CSS. Flex defaults silently
break: a `<view>` renders `flex-direction: row` instead of Lynx's `column`.
`in_shadow.css` also opens with `@import url("@lynx-js/web-elements/index.css")`,
a bare specifier a Blob-URL stylesheet could never resolve anyway.

This repo builds with **Turbopack**, so the usual Webpack fix
(`NormalModuleReplacementPlugin` + `asset/source`) doesn't apply. Instead:

1. `pnpm lynx:shadow-css` (`scripts/lynx-shadow-css-bundle.mjs`) recursively
   flattens `in_shadow.css` and every `@import` (bare *and* relative) into one
   self-contained string, emitted as `systems/windows/lib/lynx-shadow-css.ts`
   (committed). `predev` / `prebuild` regenerate it.
2. `lynx-player.tsx` injects that string as a `<style data-lynx-shadow>` into
   each shadow root itself (first child, so a card's own styles still win).
   This is bundler-agnostic and sidesteps web-core's `?inline` path entirely.

Checked again for this page: with Cat Wand open, the injected sheet holds 244
rules and a fresh `x-view` in the shadow root computes `flex-direction:
column`.

### Apps

Apps are authored in `content/apps.json`, the **built-in registry**. The
fields that drive the window system (see `AppLink` in `lib/app-icon-core.ts`):

- `runtime`: `"web"` (default, an iframe) or `"lynx"` (the Lynx Player).
- `flavor`: for Lynx apps, `"react"` or `"vue"`. Cosmetic: it tints the badge.
- `bundleUrl`: the Lynx `.web.bundle`, falling back to `url`. Two sources,
  one field:
  - an `http(s)://…` URL → **online**, fetched at open time;
  - a local `/…` path → **built-in** (offline), served from `public/`.
  The player passes remote URLs through untouched and origin-resolves local
  paths.
- `size`: preferred preset; defaults to `portrait` for Lynx, `landscape` for
  web.
- `url`: the page a web app's window frames, and every app's "open
  externally" target (the folder icon's real `href`; the menu's "Open in
  browser" for web apps).
- `featured: false` keeps an app off the home folder but in the ⌘K strip.

```json
{
  "id": "busy-week",
  "title": "BusyWeek",
  "runtime": "lynx",
  "flavor": "vue",
  "bundleUrl": "https://huxpro.github.io/BusyWeek/main.web.bundle",
  "url": "https://huxpro.github.io/BusyWeek/",
  "size": "portrait",
  "featured": false
}
```

The two Lynx apps today show both sources: BusyWeek, a Vue Lynx todo app,
fetches its bundle from its GitHub Pages origin; Cat Wand (逗猫棒) vendors
`public/bundles/cat-toy.web.bundle` (the Vue Lynx `examples/touch-fx`
playground) so it runs offline from this origin. Both are `featured: false`,
so they open from ⌘K. Any other bundle opens **over-the-air** by URL
(`openBundleUrl`; see Launching).

#### Runtime badge

Every tile wears a corner **badge** (`app-badge.tsx`) saying how it runs, the
way iOS overlays a glyph on Clip / AR / web-clip icons:

- **web** → a globe.
- **Lynx · React** → the Lynx head, tinted React blue (`#149eca`).
- **Lynx · Vue** → the Lynx head, tinted Vue green (`#42b883`).

Flavour is colour-only, so React-Lynx and Vue-Lynx read apart without a second
glyph. To keep the resting springboard clean, the home folder does **not**
stamp it on permanently: it fades in on hover / keyboard focus, and whenever
the folder is in jiggle-edit mode (the touch path, via long-press). The ⌘K
strip always shows it (`revealBadge`). The runtime is also named in the window
menu's header and rides on the minimized Dock capsule, so hiding the badge
never hides the runtime.

#### Launching

All routes go through `useWindows()`:

- **Folder.** `components/apps/app-folder.tsx` icons stay real anchors to
  each app's `url`, so ⌘/ctrl/shift/middle-click still opens the site in a new
  tab. A plain left-click is intercepted (`openApp`) to open the window
  instead: progressive enhancement that composes with the folder's
  drag-to-reorder and paged overflow.
- **Command palette.** The Apps strip in ⌘K (`CommandAppsStrip`,
  `systems/command/apps-launcher.tsx`): a headerless horizontal icon row, the
  same for browse and search, hidden when nothing matches. Its last tile,
  **Load…**, morphs the palette into a URL form (`load-bundle-panel.tsx`; a
  stacked `command-bundle` sheet on a phone) that calls `openBundleUrl`.
- **Over-the-air.** `openBundleUrl(url)` opens an ad-hoc Lynx window
  (`ota:<url>`, flavour `react` unless told) for any `.web.bundle` URL. Load…
  is its only caller.
- **In-app browser.** `openUrl(url, { title })` opens any web page in a window
  with the same frame, pill and menu an app gets, keyed by URL so the same page
  focuses its window rather than opening a second. This is where a link card a
  commit attaches opens ([Attachments System](./system-attachments.md)): a
  window on a desktop, and on a phone the window sheet stacked over the
  attachment sheet the `Visit` came from, the way a mobile app opens a link in
  its own browser and returns to the screen underneath when it is put away.
  Pages whose headers refuse framing never get here; they go to a tab. "Open in
  browser" in the menu is the way out.

## Rules

Each of these, broken, has a visible failure.

| Rule | Why | What breaks |
|---|---|---|
| Minimize never unmounts. Desktop: `WindowLayer` keeps rendering it; phone: `keepMounted` on the sheet | The app is a cross-origin iframe or a Lynx runtime; unmounting is a reload | The app restarts every time it is put away |
| A phone sheet's dismissal is `minimize`, never `close`; Close is only the menu's destructive row (and the red dot / Esc on a desk) | A drag down is too easy to do by accident | A flick loses an app's state |
| The phone window's body keeps `data-base-ui-swipe-ignore` | A Lynx view and the spinner are in this document; their touches would become swipes | A game that follows a finger drags the window away |
| The grip holds only states that are harmless if stranded (lit, or rest), and nothing the end of a gesture must clear | Once a press becomes a swipe Base UI captures the pointer, and the release may reach nothing | Controls missing, or a stuck state carried by `keepMounted` into the next open |
| The grip opens its menu after the release (`setTimeout`), not inside it | A nested drawer flushed mid-gesture corrupts the sheet's bookkeeping | The sheet believes it is still held |
| The grip is a `<div>` with inert dots; the button is visually hidden beside it | Base UI never starts a swipe from a `button` or `[role="button"]` | The handle won't drag |
| Sheet menu rows dismiss, then act after `SURFACE_TRANSITION_MS` | `close` unmounts the window and the menu sheet with it | A menu that vanishes mid-animation |
| Desktop gestures write to the DOM node and commit once; the gesture shield covers the body | Per-frame renders stall iframes and Workers; an iframe eats `pointermove` | Janky drags; a drag that freezes over the app |
| `isMobile` stays defined from `SURFACE_BREAKPOINTS.sm` | `soloOnPhone` must turn on exactly when the window is a sheet | Two sheets buried in each other, or windows forced solo on a tablet |
| `lynx-player.tsx` keeps injecting `LYNX_SHADOW_CSS`; never hand-edit `lynx-shadow-css.ts` | web-core's own `?inline` path yields `undefined` under Turbopack | Lynx layouts collapse into rows |
| One `lynx-group-id` per player; read `SystemInfo` from the container | Shared Workers collide; `window.screen` is not the window | Cross-talk between Lynx windows; off-canvas cards |

## What is free to choose

- Preset sizes, the cascade step, margins and `DOCK_BAND`, as long as
  windows still clear the Dock.
- The phone detents' values (the lowest and highest come from `SHEET_DETENTS`
  on purpose, so a sheet stacked on the window lands level).
- What the menu offers, as long as it stays one list in `WindowMenuBody`.
- The pill's look, as long as rest and lit both show the dots and the grip's
  hit area stays separate from its look.
- Motion curves for open, close and minimize.
- Which apps are featured on the folder versus only in ⌘K.

## Recipes

**Add an app.** An entry in `content/apps.json` (`id`, `title`, `url`, and for
Lynx `runtime`, `flavor`, `bundleUrl`; `size` if the default is wrong), then
refresh the icon snapshot (the content-snapshots skill). A built-in Lynx bundle
goes in `public/bundles/`; an online one needs CORS from its host.

**Open a page in a window from new code.**
`useOptionalWindows()?.openUrl(url, { title })`, with a plain link as the fallback for when there is no provider.
Don't wrap a window in `AdaptiveSurface`, and don't add its id to the
devtool's draggable lists.

**Change the grip or the phone sheet.** Read the top of `window-grip.tsx` and
the base-ui-drawer skill first. Then on a touch device: tap (menu opens, pill
lit, the next tap works), drag between all three detents, drag down to the
Dock and restore (same detent, same app state), open the menu and pick Close.
Then with a mouse at phone width: press and drag the grip, release outside the
window, and confirm the pill comes back to rest within 4s.

**Change the desktop chrome.** Check tap, long-press, right-click and drag on
the pill; resize from every edge and corner; drag a window off each edge and
watch it bounce back; maximize and zoom back; minimize and restore.

## Reference: DevTool inspector

The DevTool panel (`systems/devtool/panel.tsx`, `WindowsModule`) has a
**Windows** section: the open windows, front-most first, each with its
focused / minimized state and its metadata (runtime and flavour, source, size
preset, reload count, rect, and the bundle or page URL). It only inspects;
launching an app and loading a bundle by URL are the palette's (⌘K → Apps →
Load…).

## History: the grip that changed shape

Kept because it is the reason for the grip rules above, and the first thing a
redesign will be tempted to bring back.

The dots used to become the site's 36×4 grabber while the sheet was dragged,
driven three ways in turn. First, interpolated on the live travel, which a
sheet with detents zeroes every time it lands on one, so it flickered. Then a
phase machine in the grip, which had to know when the gesture ended and
cannot: Base UI captures the pointer for everything except touch, and the
release then reaches nothing at all (no `pointerup`, `pointercancel` or
`lostpointercapture`, on window, document or popup), so the phase stuck and
`keepMounted` carried it into the next time the app opened. Then the sheet's
own gesture state: better, and still one flush of a nested drawer away from
being stranded.

Every version had the same shape: something had to *clear* the interesting
state, whatever clears it can be missed, and what it cleared was the controls
themselves. Whatever a handle gains from changing shape does not outweigh a
window whose controls are sometimes missing. So nothing changes shape. If the
morph returns, it must be something that cannot persist: an animation that
always ends where it started, not a state someone has to clear. The surface
system carries the same lesson for every sheet: it publishes no gesture state
for a grip to follow.
