# Dock System

The dock is the top-of-screen home for **Live Activities** — collapsed pills
that morph into expanded panels (the iOS Dynamic Island / Notification Center
metaphor). It is the shared foundation for the "Global Player" UI: the music
player and the ambient phase notification are both dock activities and therefore
look and behave identically.

## Overview

```
systems/dock/
├── provider.tsx                  # DockProvider + useDock (coordination only)
├── components/
│   ├── dock.tsx                  # <Dock> — pill row layout
│   ├── live-activity.tsx         # <LiveActivity> — the pill ⇄ panel drawer
│   └── index.ts
└── index.ts
```

## Why it exists

Before, the pill/panel/drag/Esc/route-collapse machinery lived inside
`MusicDock`. Adding a second notification (ambient phase changes) would have
meant copy-pasting all of it. The dock extracts that machinery once:

- **`LiveActivity`** owns the *visuals*: the collapsed pill shell, the expanded
  panel (header, body, grabber), and the drawer the panel is made of.
- **`DockProvider` / `useDock`** own the *coordination*: a single `openId`
  (only one panel open at a time) and route-change collapse.
- **`Dock`** owns the *layout*: a horizontal, centered, scrollable pill row.

Activities supply only content.

## The panel is a Base UI Drawer, travelling up

The expanded panel is one `Drawer.Root` with `swipeDirection="up"` — the mirror
of the phone sheet in `systems/surface`. The Dynamic Island metaphor is anchored
at the top and puts itself away *upwards*; a sheet does the same thing from the
bottom edge. They are the same library, the same data attributes, and the same
shared stack, so the site has one overlay vocabulary rather than two.

What that deleted: the hand-written `drag="y"` + `dragConstraints` +
`onDragEnd` 40px threshold, both `AnimatePresence` blocks, the transparent
scrim in `Dock`, and the Escape listener in `DockProvider`. The motion is now
CSS, under "Dock panel motion" in `app/globals.css`.

What it bought:

| | |
|---|---|
| **The morph** | The panel does not slide in from the top edge. It *grows out of the pill*: the glass shell is clipped down to the pill's own rectangle and the clip opens to the whole panel, so the pill appears to become the panel — the Dynamic Island, which is the metaphor the dock has always claimed. |
| **Pull to expand** | `Drawer.SwipeArea` wraps the pill, so dragging *down* from it opens the panel and the panel follows the finger the whole way. Release short of half the panel's height and it snaps back. This is the iOS Notification Center gesture; before, a pill could only be tapped. |
| **Stacking** | The panel registers in the shared surface stack (`systems/surface/stack.ts`) as `dock-activity`. It was the one overlay on the site that did not know about the others. Now a palette opened over it (from the keyboard — a press on the FAB is an outside press and dismisses instead) sends it back a step and makes it inert, and a panel opened over the playlist sheet sends *that* back instead. |
| **Free layout** | The panel is portalled into the shared `SurfaceViewport`, so the old rule that the pill row must carry no transform (or the `fixed` panels inside it would anchor to the row) is gone. |

Before changing any of it, read the "BEFORE CHANGING THIS FILE" block at the top
of `systems/dock/components/live-activity.tsx`, and the one it points at in
`systems/surface/sheet.tsx`.

### The morph, and why it is a clip

`clip-path`, not a scale and not a slide. A scale would scale what the shell's
`backdrop-filter` samples, so the page behind the panel would appear to zoom for
half a second; a clip leaves the glass sampling the page at 1:1 and only changes
how much of it you can see. It also means the content never reflows — it is laid
out at the final width from the first frame and simply revealed, the way the
Island masks its own content. `clip-path` and `backdrop-filter` on the *same*
element are fine together; it is an ancestor that breaks the backdrop (below).

The corner radius does not interpolate, because it does not have to: an `h-9`
`rounded-full` pill and a `rounded-2xl` panel are both 18px. The shape is
continuous from the first frame.

The pill's rectangle is measured off the live DOM (`morphVars` in
`live-activity.tsx`) — the pill can be anywhere in a scrolled row of them, and
the panel should grow out of the one that was tapped. Three things about that
measurement were each a bug first:

- **The vars have to go through React.** Base UI re-renders the popup several
  times on its way open and React reconciles `style` each time, so custom
  properties set imperatively on the node are wiped before the browser ever
  resolves the starting style. Measured: the clip sat at `inset(0px)` and there
  was no morph at all.
- **Nothing keyed on the measurement's absence may animate.** A travel rule that
  applied `:not([data-dock-morph])` got latched as the transition's starting
  value during the style recalc the measurement itself forces — the panel slid
  *and* morphed. The swipe-dismiss exit is the only travel left, and it is keyed
  on `data-swipe-dismiss`, which has nothing to do with the morph.
- **Measure layout, not painted geometry.** `offsetTop`/`offsetWidth` rather than
  `getBoundingClientRect`, so a transform the panel happens to be carrying
  cannot contaminate the result; and the pill's *wrapper* rather than its
  button, because by then the button is already fading and shrinking away.

A swipe-up dismissal does not morph. A finger that has flicked the panel upward
should be answered by the panel going that way, not by it shrinking back onto a
pill the finger has left behind, so that exit travels over the top edge.

### The glass is the constraint on the motion

The panel arrives and leaves on **transform alone** — out of and back over the
top edge — and never on opacity. An element at `opacity < 1` is its own backdrop
root, so a `backdrop-filter` anywhere inside it samples that empty group instead
of the page: the glass is not there at all for the length of the animation. A
fade on the popup was tried and shipped, and it made the panel see-through on
the way in, the page's text legible straight through it, unblurred. The pill's
fade sits on the pill itself, the element that carries the blur, for the same
reason. The sheets above are transform-only for the same reason.

The walkthrough guards both: it samples the entrance frame by frame and fails
if anything between the shell and `<body>` is fading or filtering, if the first
frame's clip is not the pill's rectangle, or if the panel translates at all.

### One place it does not replicate the old dock

The old scrim was a real `fixed inset-0` div, so with a panel open every press
went to the scrim and nothing else. Keeping that — a pointer-taking viewport —
was tried and measured: the command palette's FAB became unreachable while a
Live Activity was open. The drawer's viewport is non-modal instead, so a press
outside both dismisses the panel (Base UI's outside press) and lands where it
was aimed, which is how every other surface on the site behaves.

### Tried and left out

Two of the Drawer capabilities this was meant to evaluate (#175) do not survive
contact with a top-anchored panel. Both were built, measured on an iPhone 13
walkthrough, and reverted.

**`snapPoints` — no.** Base UI sign-corrects `--drawer-snap-point-offset` for
`up` (`DrawerPopup.js`), but the geometry is still a bottom sheet's mirrored:
the offset clips the popup's *top*. Measured with `snapPoints={[0.18, 1]}`, the
compact detent put the panel at `translateY(-50.5px)` with its bounding box at
`top: -42` — the header, the collapse chevron and the top corners off the screen,
and the transport controls left showing. A top panel's content flows downward
from its top edge, so the end that should be clipped is the bottom.

The live drag is worse: the damped-movement branch in `DrawerPopup.js` and the
progress maths in `DrawerViewport.js` are both written `swipeDirection ===
'down'`, so on an up drawer there is no clamp at the fully-open edge. Measured
transforms during one drag: `-50 → -26 → +5.5 → +37.5 → +69.5` — straight past
the resting position, unbounded. Settling on release is correct; everything
before it is not.

Two detents would also mean *different content* at each (a one-line NowPlaying
vs. the full card), which is a render decision, not a drag geometry. Detents
clip; they do not swap.

**`Drawer.Indent` / `Drawer.IndentBackground` — no.** Two reasons, one fatal.
`data-active` is set when *any* drawer inside the nearest `Drawer.Provider` is
open, so it cannot tell the dock panel from the command palette: measured, both
indented identically, and the palette indenting is exactly what we decided
against for the sheets (the bezel already frames the page).

The fatal one: `Drawer.Indent` works by transforming the box around the app's
main UI, and under `@hux/bezel` this site's page *is* a stack of fixed layers —
the wallpaper, the window layer, the body itself in container scroll. A
transform on their ancestor makes it their containing block, and with the
indent's `overflow: hidden` the box has no flow content to be as tall as.
Measured: the page rendered fully black, with only the dock panel and the FAB
(both outside the indent) still visible. Indenting this page would mean
restructuring its layer model.

## Usage

```tsx
<Dock>
  <AmbientPhaseActivity />   {/* renders a <LiveActivity id="ambient-phase" /> */}
  <MusicActivity />          {/* renders a <LiveActivity id="music" /> */}
</Dock>
```

```tsx
<LiveActivity
  id="music"
  openLabel="Open music controls"
  collapseLabel="Collapse"
  pill={<>{/* leading pill content: art, EQ, icon… */}</>}
  title={<>{/* panel header left side */}</>}
>
  {/* panel body — bring your own padding */}
</LiveActivity>
```

## Layout & coexistence rules

These match the product spec for multiple simultaneous activities:

- **Collapsed:** pills sit side by side in a centered row. The row is
  horizontally scrollable (`.no-scrollbar`) once it gets crowded, so N pills
  scale gracefully.
- **Expanded:** the open activity's panel takes over the top-center anchor and
  **every pill goes invisible and stops taking pointers**; collapsing restores
  them. They stay mounted, so the row keeps its layout and its scroll position
  while a panel is up. (Activities aren't individually dismissible, so we never
  strand a pill behind a panel.)
- **One at a time:** opening an activity collapses any other that was open.
- **Dismissal:** a press outside, Escape, a swipe up, the collapse chevron, or a
  route change. The first three are the drawer's; the last is `DockProvider`'s.

## Consumers

| Activity | Source | Pill | Panel body |
|----------|--------|------|------------|
| Music | `systems/music/components/music-activity.tsx` | album art + EQ | `<NowPlaying />` |
| Ambient phase | `systems/ambient/components/phase-activity.tsx` | sun icon + time | `<WeatherNow />` |
| Theater audio | `systems/theater/components/theater-activity.tsx` | thumbnail + EQ | transport + `<SurfaceSwitch />` |
| Minimized windows | `systems/windows/components/minimized-dock.tsx` | app icon + title | — (restores the window) |

Music and Ambient phase reuse the same shared body component their homepage
widget uses (`NowPlaying`, `WeatherNow`), so the dock panel and the grid widget
never drift.
