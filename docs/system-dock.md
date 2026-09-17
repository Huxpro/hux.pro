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
| **Pull to expand** | `Drawer.SwipeArea` wraps the pill, so dragging *down* from it opens the panel and the panel follows the finger the whole way. Release short of half the panel's height and it snaps back. This is the iOS Notification Center gesture; before, a pill could only be tapped. |
| **Stacking** | The panel registers in the shared surface stack (`systems/surface/stack.ts`) as `dock-activity`. It was the one overlay on the site that did not know about the others. Now a palette opened over it (from the keyboard — a press on the FAB is an outside press and dismisses instead) sends it back a step and makes it inert, and a panel opened over the playlist sheet sends *that* back instead. |
| **Free layout** | The panel is portalled into the shared `SurfaceViewport`, so the old rule that the pill row must carry no transform (or the `fixed` panels inside it would anchor to the row) is gone. |

Before changing any of it, read the "BEFORE CHANGING THIS FILE" block at the top
of `systems/dock/components/live-activity.tsx`, and the one it points at in
`systems/surface/sheet.tsx`.

### How the panel arrives: a pop, not a slide

A drawer's instinct is to travel — in from the edge it is anchored to. This one
does not, because the pill it comes from is *right there*, a few pixels above
the panel's own top edge: there is nothing to travel from. So the entrance is
the pop the hand-written panel had before the drawer replaced it, kept to the
frame:

| | |
|---|---|
| The popup | `transform: scale(0.94)` on `data-starting-style` / `data-ending-style`, `transform-origin: top center`, over `--dock-pop-duration: 300ms` — the same scale and the same beat as the framer-motion pop it is matching. |
| The shell | a `dock-pop-in` / `dock-pop-out` keyframe fade, one level down on the glass. |
| A dismissed panel | `data-swipe-dismiss` swaps the scale for the travel (up past the top edge and past the inset, so it is gone rather than clipped at the status bar) and switches the fade off — a panel a finger has thrown is going somewhere, not dissolving. |

Two things about it are load-bearing, and both are also notes 4 and 5 in
`live-activity.tsx`:

**The fade is a keyframe animation on the shell, not a transition on the popup.**
An animation because the shell's `transition` shorthand already belongs to the
surface recede and a second `transition` rule would replace it wholesale, and
because `data-starting-style` lives for one frame — too short for a transition
to key off, long enough to start an animation that then runs on its own. Base UI
reads the *popup's* animations to decide when an exit is over, not the subtree's,
so the shell's fade never holds the unmount open.

**The closed transform scales and does not translate.** The obvious pop is
`translateY(-10px) scale(0.94)`, and the `translateY` silently breaks the
pull-to-expand gesture: Base UI measures how far "closed" is by reading the
popup's transform when a `Drawer.SwipeArea` drag starts (`resolveClosedOffset`,
`min(height, |translateY|)`), and it reads it *before* it marks the popup as
swiping, so it sees the closed rule. Ten pixels of offset told it the panel was
ten pixels from open; a pull that should track the finger down a whole panel
height tracked ten and overshot — measured `--drawer-swipe-movement-y` of +12px
where −170 was due. A pure `scale()` leaves the transform's Y at zero and the
measurement falls through to the panel's height. The ten pixels cost nothing to
look at: scaling a 170px panel by 0.94 from `top center` already lifts its
bottom by about that much.

### The glass is the constraint on the motion

**Opacity belongs on the glass, never on a box that contains it.** An element at
`opacity < 1` is its own backdrop root, so a `backdrop-filter` *inside* it
samples that empty group instead of the page: the glass is not there at all for
the length of the animation. On the element that carries the blur the same
opacity is fine — its own backdrop resolves before its opacity applies.

A fade on the popup was tried and shipped, and it made the panel see-through on
the way in, the page's text legible straight through it, unblurred. A/B'd at the
same opacity on the same frame: on the shell the text behind it is blurred, on
the popup it is sharp. That is the whole reason the popup carries the transform
and the fades sit one level down, on the shell and on the pill, which are
themselves the glass. The sheets above hold to the same rule.

The walkthrough guards it: it samples frames across the entrance and fails if
anything *between* the shell and `<body>` is fading or filtering.

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
