# Dock System

The dock is the top-of-screen home for **Live Activities**: collapsed pills
that morph into expanded panels (the iOS Dynamic Island / Notification Center
metaphor). It is the shared foundation for the "Global Player" UI: the music
player and the ambient phase notification are both dock activities and therefore
look and behave identically.

It is also where the site's one-line **notices** appear: "Dark Mode ·
Preference unchanged", "Reading in Chinese", "Sky window · swipe up to come
back". See [Notices](#notices).

## Overview

```
systems/dock/
├── provider.tsx                  # DockProvider + useDock (coordination only)
├── notice.ts                     # showNotice / dismissNotice: the notice store
├── components/
│   ├── dock.tsx                  # <Dock>: pill row layout
│   ├── live-activity.tsx         # <LiveActivity>: the pill ⇄ panel drawer
│   ├── dock-notice.tsx           # <DockNotice>: the notice, at the pills' anchor
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

The expanded panel is one `Drawer.Root` with `swipeDirection="up"`, the mirror
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
| **Stacking** | The panel registers in the shared surface stack (`systems/surface/stack.ts`) as `dock-activity`. It was the one overlay on the site that did not know about the others. Now a palette opened over it (from the keyboard; a press on the FAB is an outside press and dismisses instead) sends it back a step and makes it inert. A surface that merely shares the screen does not: the panel reports its band, and a sheet that stops at its bottom edge is tiled with it, not over it (see "Covering, not merely later" in [system-surface.md](./system-surface.md)). |
| **Free layout** | The panel is portalled into the shared `SurfaceViewport`, so the old rule that the pill row must carry no transform (or the `fixed` panels inside it would anchor to the row) is gone. |

Before changing any of it, read the "BEFORE CHANGING THIS FILE" block at the top
of `systems/dock/components/live-activity.tsx`, and the one it points at in
`systems/surface/sheet.tsx`.

### How the panel arrives: a pop, not a slide

A drawer normally travels in from the edge it is anchored to. This one does
not, because the pill it comes from sits a few pixels above the panel's own
top edge, so there is nothing to travel from. The entrance is the pop the
hand-written panel had before the drawer replaced it, kept to the frame:

| | |
|---|---|
| The popup | `transform: scale(0.94)` on `data-starting-style` / `data-ending-style`, `transform-origin: top center`, over `--dock-pop-duration: 300ms`: the same scale and duration as the framer-motion pop it matches. |
| The shell | a `dock-pop-in` / `dock-pop-out` keyframe fade, one level down on the glass. |
| A dismissed panel | `data-swipe-dismiss` swaps the scale for the travel (up past the top edge and past the inset, so it is gone rather than clipped at the status bar) and switches the fade off, because a panel a finger has thrown should leave the screen rather than dissolve. |

Two things about it are load-bearing, and both are also notes 4 and 5 in
`live-activity.tsx`:

**The fade is a keyframe animation on the shell, not a transition on the popup.**
An animation because the shell's `transition` shorthand already belongs to the
surface recede and a second `transition` rule would replace it wholesale, and
because `data-starting-style` lives for one frame. That is too short for a
transition to key off, but long enough to start an animation that then runs on
its own. Base UI
reads the *popup's* animations to decide when an exit is over, not the subtree's,
so the shell's fade never holds the unmount open.

**The closed transform scales and does not translate.** The obvious pop is
`translateY(-10px) scale(0.94)`, and the `translateY` silently breaks the
pull-to-expand gesture: Base UI measures how far "closed" is by reading the
popup's transform when a `Drawer.SwipeArea` drag starts (`resolveClosedOffset`,
`min(height, |translateY|)`), and it reads it *before* it marks the popup as
swiping, so it sees the closed rule. Ten pixels of offset told it the panel was
ten pixels from open; a pull that should track the finger down a whole panel
height tracked ten and overshot (measured `--drawer-swipe-movement-y` of +12px
where −170 was due). A pure `scale()` leaves the transform's Y at zero and the
measurement falls through to the panel's height. The ten pixels cost nothing to
look at: scaling a 170px panel by 0.94 from `top center` already lifts its
bottom by about that much.

### The glass is the constraint on the motion

**Opacity belongs on the glass, never on a box that contains it.** An element at
`opacity < 1` is its own backdrop root, so a `backdrop-filter` *inside* it
samples that empty group instead of the page: the glass is not there at all for
the length of the animation. On the element that carries the blur the same
opacity is fine, because its own backdrop resolves before its opacity applies.

A fade on the popup was tried and shipped, and it made the panel see-through on
the way in, the page's text legible straight through it, unblurred. A/B'd at the
same opacity on the same frame: on the shell the text behind it is blurred, on
the popup it is sharp. That is why the popup carries the transform
and the fades sit one level down, on the shell and on the pill, which are
themselves the glass. The sheets above hold to the same rule.

The walkthrough guards it: it samples frames across the entrance and fails if
anything *between* the shell and `<body>` is fading or filtering.

### One place it does not replicate the old dock

The old scrim was a real `fixed inset-0` div, so with a panel open every press
went to the scrim and nothing else. Keeping that with a pointer-taking viewport
was tried and measured: the command palette's FAB became unreachable while a
Live Activity was open. The drawer's viewport is non-modal instead, so a press
outside both dismisses the panel (Base UI's outside press) and lands where it
was aimed, which is how every other surface on the site behaves.

### Tried and left out

Two of the Drawer capabilities this was meant to evaluate (#175) do not survive
contact with a top-anchored panel. Both were built, measured on an iPhone 13
walkthrough, and reverted.

**`snapPoints`: no.** Base UI sign-corrects `--drawer-snap-point-offset` for
`up` (`DrawerPopup.js`), but the geometry is still a bottom sheet's mirrored:
the offset clips the popup's *top*. Measured with `snapPoints={[0.18, 1]}`, the
compact detent put the panel at `translateY(-50.5px)` with its bounding box at
`top: -42`: the header, the collapse chevron and the top corners were off the
screen, and the transport controls were left showing. A top panel's content
flows downward from its top edge, so the end that should be clipped is the bottom.

The live drag is worse: the damped-movement branch in `DrawerPopup.js` and the
progress maths in `DrawerViewport.js` are both written `swipeDirection ===
'down'`, so on an up drawer there is no clamp at the fully-open edge. Measured
transforms during one drag: `-50 → -26 → +5.5 → +37.5 → +69.5`, straight past
the resting position and unbounded. Settling on release is correct; everything
before it is not.

Two detents would also mean *different content* at each (a one-line NowPlaying
vs. the full card), which is a render decision, not a drag geometry. Detents
clip; they do not swap.

**`Drawer.Indent` / `Drawer.IndentBackground`: no.** Two reasons, one fatal.
`data-active` is set when *any* drawer inside the nearest `Drawer.Provider` is
open, so it cannot tell the dock panel from the command palette: measured, both
indented identically, and the palette indenting is exactly what we decided
against for the sheets (the bezel already frames the page).

The fatal one: `Drawer.Indent` works by transforming the box around the app's
main UI, and under `vitre` this site's page *is* a stack of fixed layers:
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
  {/* panel body: bring your own padding */}
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

- **A notice takes the anchor too:** while one is up the pills step aside for
  it exactly as they do for a panel, and a notice raised while a panel is open
  waits for the panel to close. The top centre holds one thing at a time.

## The top band, and its lab

Everything above competes for one strip at the top of the screen: Live
Activities, parked windows, a notice, an open panel, and a page's pinned bar
(/works's and /prompt's toolbars, a lab's own bar). How they share it is still
being decided, on the real components. It is a composition of independent
choices, `BandConfig` in `systems/dock/band.ts`, read by the Dock, every `LiveActivity`, the parked windows and the page's
`PinnedSlot`:

| Knob | What it chooses |
|---|---|
| `share` | whether a pinned bar shares the band at all; off is the old way (pills centred, the bar pinned under them) |
| `group` | how the occupants stand beside the bar: `all` in a row after it, `tray` in a window of a fixed size, `count` folded into one ball with how many; tap it and the bar folds to a ball while they open out |
| `form` / `openForm` | their shape beside the bar, and when a count is opened: `pill` or `ball` (a ball is the pill at 36px, its content clipped) |
| `trayCap` | how many a tray shows whole on a phone (two more wider) |
| `peek` | a window that holds more than it shows ends on half of the next |
| `barScrolls` | (`all`) the bar rides in the scrolling strip, first, sliding away as the occupants come in |

`PRESETS` names four sets of them: `stack`, `tray`, `scroll` (band scroll),
`swap` (either / or). What ships is `DEFAULT_CONFIG`, either / or: side by
side while everything fits, balls when it does not quite, a count when it
does not at all. Anything else is a session override set in **`/lab/band`**.
Every pinned bar takes part: /works's and /prompt's toolbars, and every
lab's own bar (`LabBar`), which rides in a `PinnedSlot` at the band's height
unless a lab sets it aside (`pin="static"`).

Where everything stands is one function, `bandGeometry(band, vw)`, read by
both the Dock and the slot, so they never disagree about a pixel. It returns
two things. The occupants' **window** is exactly where they may be seen and
where the Dock row clips, so nothing slides under the bar, the gutter or a
ball. The bar's **reserve** is the width it gives up at its end. Some rules it
keeps:

- Every knob is an **overflow** strategy. While the bar at its own width
  and every occupant as a pill fit the band side by side, they stand side by
  side, whatever is configured: left-aligned after the bar, a gap from its
  glass, running on into the margin beside the column if they need to. A
  wide screen is never folded for a phone's sake. Past that,
  in order: the occupants become balls (if `form` says so), then the group
  takes over. A count never counts one occupant: it is already as small as
  the ball that would count it. An opened count that fits again closes.
- A bar that wraps (the lab's) is measured at its one-line width, so it can
  fit too.

- The window starts a `GAP` (8px) after the bar's *glass*, not its text.
- On a phone (a gutter of 32px or less) the window runs on to the screen's
  edge: the next occupant is cut by the edge of the phone, and that cut is
  what says it scrolls. Wider, it stops at the column.
- The bar never gets less than its minimum while an occupant would fit.
  But an occupant is never pushed out of reach to save the bar: the window is
  at least one whole occupant.
- An opened count scrolls edge to edge, however many there are.
- Where the window ends in mid-air (against the bar, the folded ball, the
  column) its end is a capsule's: an occupant sliding out goes under a curve
  of its own radius, not a straight line. At the screen's edge it stays
  square. It is a `clip-path`, which keeps the pills' blur (a mask would not).
  What a round end leaves of an occupant fades as it thins (gone under 6px,
  whole from two thirds of a ball). The fade is `filter: opacity()` on the
  glass itself (an opacity on anything holding it would take the blur with
  it).

An occupant takes part the same way: `useBandOccupant()` gives it its shape
(pill or ball), whether a count hides it, and its own width as a pill
(measured from its content and its glass's padding), which it publishes as
`data-natural` on its row child; it marks its glass `data-band-glass`, where
the Dock fades a sliver. Readers that need one fact about the band select it
(`useBandSelect`), so a resize does not re-render every Live Activity.

A bar takes part by declaration. Its slot (`PinnedSlot`) measures it and
reports its box. The bar marks the part that gives way: `data-bar-give` on a
chip group that scrolls inside itself (minimum: the fixed parts and one whole
chip), or `data-bar-keep` on the part of a wrapping bar that must stay whole
(the lab bar's name; its tools wrap under it). It narrows itself by
`--band-reserve`, which the slot sets. The slot also folds the bar to a ball
when a count is opened. `LabShell` puts its bar in the band with
`pin="band"`.

**The Band Lab** is the site itself: the knobs set the override, the
occupants are the Dock's own (up to six sample activities drawn by the real
`LiveActivity`, the mock music player, a parked window, a notice), and the bar
that meets them is chosen on the page: the lab's own two-row bar, or the
real /prompt or /works toolbar with sample facets. They meet on the page's
real scroll. Four rules are measured off the page as it is (`app/lab/band/model.ts`):
one band, a bar that can still do its job, nothing overlapping with the gap
held, every occupant reachable.

Each part of the harness has one place, and the top is the subject's: the
lab's own bar, whose second row picks which bar meets the band. At the
bottom, beside the FAB, is the remote: the four rules as dots (tap them for
what they measured, in a sheet that is not modal, so the band stays live
under it), how many occupants, the presets. The fine knobs are a panel: in
the page on a phone, beside it and pinned on a wide screen.

What moves is animated, not swapped: a pill becomes a ball by its real width
changing (`width` is in the `[data-dock-pill] > *` transition, which outranks
the trigger's own utilities); the Dock row's window moves by its `left`,
`width` and padding transitioning; the bar narrows by its `max-width`.

## Notices

```ts
import { showNotice, dismissNotice } from "@/systems/dock";

showNotice({
  id: "solar-theme",          // the same id again updates it in place
  icon: Sunset,
  title: "Dark Mode",         // the fact
  note: "Preference unchanged", // behind it: what did not change, or how to undo
  duration: 5_000,            // default 3.2s
});
```

A notice is the system telling you something happened, once, in a line: the
sun switched the theme, the page is in the other language now, the sky window
opened, a link went to a new tab. It is callable from anywhere (providers,
effects, a clock) because it is a module store (`notice.ts`) rather than a
context. Most callers sit beside the Dock in the tree, not under it.

**Why here, and not a bottom toast.** The site used to show these through Sonner
at the bottom centre. Measured on a 390px phone, the toast row sat 16px from the
bottom and 46px tall, over the command bar at 24–72px: for the three seconds
it was up, a tap on ⌘K landed on the toast. The two-button language card was
worse: 136px tall, it covered ⌘K until answered, and at `z-index: 999999999`
it drew over every sheet and over the About veil. The fix is a rule about which
edge means what:

| Edge | Direction | What lives there |
|---|---|---|
| **Top** | the system → you | Live Activities, notices |
| **Bottom** | you → the system | the command bar, and the sheets that rise from it |

A notice at the top cannot collide with the command bar, and the Dock already
knew how to share its anchor (pills ⇄ panel).

Rules it keeps:

- **One at a time.** A new notice replaces the one showing; they crossfade in
  place. Nothing stacks.
- **Its time runs only on screen.** Behind an open panel it waits, then gets its
  full duration.
- **It does not publish into `--dock-clear`, and a bar it would cover steps
  aside.** The /works and /prompt bars pin under the pills by that variable;
  pushing them down for a three-second line would make them jump twice. Left
  alone under a notice, a pinned bar is wider than it and shows round both its
  ends. So it fades and lifts away the way the pills do, and comes back when
  the notice goes (`components/ui/use-notice-yield.ts`). Only when it is
  actually under the notice: pinned below Live Activity pills it already
  clears it, and resting under the title it is nowhere near.
- **A press takes it down early.** It is not a button (a screen reader hears
  it through the `role="status"` region), so its time is what dismisses it for
  everyone else.
- **Opacity on the glass.** The notice's fade is on the capsule, which carries
  the blur; see "The glass is the constraint on the motion" above.

A notice has no choices in it. Anything that asks, like a link shared in the
other language than the reader's, is a surface: a bigger toast rather than a
dialog. `components/post/language-sheet.tsx` is a form sheet rising from the
bottom at every width, capped at 400px on a desk (`sheetMaxWidth`), and not
modal: no scrim, the page stays live behind it.

### Shape

The shape says what a thing is, not which edge it came from:

- **Capsule** (`GLASS_CAPSULE`, `lib/glass.ts`) is for one line to glance at:
  a Live Activity pill, a notice, the pinned /works and /prompt bars, the
  command bar.
- **Rounded rectangle** is for something to read or act on: the Live
  Activity panel (16px), a sheet (24px), a window.

A capsule with two buttons in it, or a card pretending to be a toast, is the
thing to avoid.

## Consumers

| Activity | Source | Pill | Panel body |
|----------|--------|------|------------|
| Music | `systems/music/components/music-activity.tsx` | album art + EQ | `<NowPlaying />` |
| Ambient phase | `systems/ambient/components/phase-activity.tsx` | sun icon + time | `<WeatherNow />` |
| Theater audio | `systems/theater/components/theater-activity.tsx` | thumbnail + EQ | transport + `<SurfaceSwitch />`; on a phone none: the pill is the PiP card's smallest size and a press brings the card back (`onActivate`, see [Theater](./system-theater.md)) |
| Minimized windows | `systems/windows/components/minimized-dock.tsx` | app icon + title | none (restores the window) |

Notices: the sun switching the theme (`systems/ambient/components/solar-theme.tsx`),
the sky window (`wallpaper-background.tsx`), a link that refused to be framed
(`systems/attachments/provider.tsx`), the language switch on a bilingual post
(`components/post/use-post-language.tsx`), and the `/editor` labs' save and
reset.

Music and Ambient phase reuse the same shared body component their homepage
widget uses (`NowPlaying`, `WeatherNow`), so the dock panel and the grid widget
never drift.
