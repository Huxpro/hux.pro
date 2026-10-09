---
skills: [surfaces, base-ui-drawer]
---

# Dock System

The dock is the top-of-screen home for **Live Activities**: collapsed pills
that morph into expanded panels (the iOS Dynamic Island / Notification Center
metaphor). It is the shared foundation for the "Global Player" UI: the music
player and the ambient phase notification are both dock activities and therefore
look and behave identically.

It is also where the site's one-line **notices** appear: "Dark Mode ·
Following the Sun", "Reading in Chinese · Preference unchanged", "Sky window
· swipe up to come back". See [Notices](#notices).

## What it looks like done well

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-dock/desk-pill.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The music Live Activity collapsed: a glass capsule at the top centre with the album art, green EQ bars and a down chevron." />
  <img src="/img/docs/system-dock/desk-panel.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same activity expanded: a 360px rounded glass panel hanging from the top, the header 'playing' with a collapse chevron, the NowPlaying card, and a grabber at the bottom." />
</div>

Music (`localStorage.hux_music_mock = "1"`, then play from the home widget),
collapsed and expanded, on a desk. The panel takes the pill's place at the
top centre and the pill is gone while it is up; the panel's body is the same
`<NowPlaying />` the home widget shows, and the grabber at its foot is where a
mouse drag starts.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-dock/phone-pill.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="A phone on the home page with the music pill at the top centre, under the status bar." />
  <img src="/img/docs/system-dock/phone-notice.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="A phone on a post just switched to Chinese: a glass capsule at the top reads 'Reading in Chinese · Preference unchanged'; the command bar's buttons sit at the bottom right, untouched." />
</div>

A pill and a notice on a phone (headless, 393pt wide, no safe-area inset).
The notice, raised by the post's language switch, is the pill's own shape at
the pill's own anchor: one line at the top, nothing at the bottom where the
command bar is.

- One thing holds the top centre at a time: the pills, an open panel, or a
  notice.
- A pill is one glance (a capsule); a panel is something to read or act on
  (a rounded rectangle). See [Shape](#shape).
- The panel follows the finger both ways: pulled down from the pill, thrown
  up past the top edge.
- The glass stays glass the whole way in and out: nothing fades a box that
  holds the blur.

## How it works

```
systems/dock/
├── provider.tsx                  # DockProvider + useDock (coordination only)
├── notice.ts                     # showNotice / dismissNotice: the notice store
├── band.ts                       # the top band: the Dock and a pinned bar sharing the strip
├── components/
│   ├── dock.tsx                  # <Dock>: pill row layout, publishes --dock-clear
│   ├── live-activity.tsx         # <LiveActivity>: the pill ⇄ panel drawer
│   ├── dock-notice.tsx           # <DockNotice>: the notice, at the pills' anchor
│   ├── use-band-occupant.ts      # an occupant's shape and width in the band
│   ├── sample-activities.tsx     # stand-in activities for /lab/band only
│   └── index.ts
└── index.ts
```

Three roles, so an activity supplies only content:

- **`LiveActivity`** owns the *visuals*: the collapsed pill shell, the expanded
  panel (header, body, grabber), and the drawer the panel is made of.
- **`DockProvider` / `useDock`** own the *coordination*: a single `openId`
  (only one panel open at a time), route-change collapse, collapse when the
  open activity unmounts (`registerActivity`), and `noticeUp`, whether a
  notice holds the anchor right now.
- **`Dock`** owns the *layout*: a horizontal, centered, scrollable pill row,
  mounted once in `app/layout.tsx` with every activity as its child.

![Top: three states share the top centre. Pills (openId null) go to Panel on a tap or a pull down, and back on Escape, an outside press, the chevron, a swipe up or a route change; Pills go to Notice on showNotice and back on its timer, a tap or a swipe up; a notice raised while a panel is open waits for it. Bottom: Drawer.SwipeArea with data-dock-pill wraps the Drawer.Trigger glass in the Dock row; Drawer.Portal puts Drawer.Popup data-dock-panel in a non-modal SurfaceViewport; the popup carries the transform and no paint, the data-surface-shell inside it carries the glass and the fade, Drawer.Content holds the header and body, and the grabber sits outside it.](/img/docs/system-dock/anchor.svg)

The top half is the anchor's state machine: who holds the top centre, and
what hands it on. The bottom half is one activity as `live-activity.tsx`
builds it: the transform on the popup (red), the glass and its fade one level
down on the shell (green).

### The panel is a Base UI Drawer, travelling up

The expanded panel is one `Drawer.Root` with `swipeDirection="up"`, the mirror
of the phone sheet in `systems/surface`. The Dynamic Island metaphor is anchored
at the top and puts itself away *upwards*; a sheet does the same thing from the
bottom edge. They are the same library, the same data attributes, and the same
shared stack, so the site has one overlay vocabulary rather than two. The
motion is CSS, under "Dock panel motion" in `app/globals.css`.

What it gives:

| | |
|---|---|
| **Pull to expand** | `Drawer.SwipeArea` wraps the pill, so dragging *down* from it opens the panel and the panel follows the finger the whole way. Release short of half the panel's height (Base UI's `DEFAULT_SWIPE_OPEN_RATIO`) and it snaps back. This is the iOS Notification Center gesture. |
| **Stacking** | The panel registers in the shared surface stack (`systems/surface/stack.ts`) as `dock-activity`. A palette opened over it (from the keyboard; a press on the FAB is an outside press and dismisses instead) sends it back a step and makes it inert. A surface that merely shares the screen does not: the panel reports its band, and a sheet that stops at its bottom edge is tiled with it, not over it (see "Covering, not merely later" in [system-surface.md](./system-surface.md)). |
| **Free layout** | The panel is portalled into the shared `SurfaceViewport`, so the pill row may carry a transform without the panel anchoring to it. |
| **Non-modal** | `modal={false}` on both the root and the viewport: no focus trap, no scroll lock, no scrim. A press outside both dismisses the panel (Base UI's outside press) and lands where it was aimed, which is how every other surface on the site behaves. |

### How the panel arrives: a pop, not a slide

A drawer normally travels in from the edge it is anchored to. This one does
not, because the pill it comes from sits a few pixels above the panel's own
top edge, so there is nothing to travel from:

| | |
|---|---|
| The popup | `transform: scale(0.94)` on `data-starting-style` / `data-ending-style`, `transform-origin: top center`, over `--dock-pop-duration: 300ms`. |
| The shell | a `dock-pop-in` / `dock-pop-out` keyframe fade, one level down on the glass. |
| Pulled open | `[data-swiping][data-starting-style]` pins the popup to `--drawer-swipe-movement-y`: under the finger the finger wins. |
| A dismissed panel | `data-swipe-dismiss` swaps the scale for the travel, `translateY(calc(-100% - var(--surface-exit)))` (up past the top edge and past the inset, so it is gone rather than clipped at the status bar), and switches the fade off, because a panel a finger has thrown should leave the screen rather than dissolve. The harder the flick (`--drawer-swipe-strength`), the shorter the exit. |
| Reduced motion | no transition on the popup or the pills, no animation on the shell. |

## Rules

Each of these, broken, has a visible failure. The first five are the five
notes in the "BEFORE CHANGING THIS FILE" block at the top of
`systems/dock/components/live-activity.tsx`, the things specific to a drawer
travelling up; the list in `systems/surface/sheet.tsx` applies here too.
Read both before changing the file or the "Dock panel motion" block. The
last two are written up in the "Dock panel motion" block and beside the
viewport in `live-activity.tsx`.

| Rule | Why | What breaks |
|---|---|---|
| The swiping rule is scoped to `[data-starting-style]` (note 1) | A dismiss drag writes an inline `transform`; a `SwipeArea` drag writes only `--drawer-swipe-movement-y`, so the CSS has to move it. On a dismiss release the popup is `data-swiping` and `data-ending-style` at once | Pinned to the finger on release, the panel is stranded on screen |
| No snap points (note 2) | `--drawer-snap-point-offset` is sign-corrected for `up`, but the live drag maths are written for `down` | See [Tried and left out](#tried-and-left-out) |
| `aria-hidden={false}` on the `SwipeArea` (note 3) | It renders `role="presentation" aria-hidden` | The pill button leaves the accessibility tree |
| Opacity on the glass, never on a box that contains it (note 4) | An element at `opacity < 1` is its own backdrop root, so a `backdrop-filter` inside it samples an empty group | The panel is see-through, the page's text sharp behind it, for the length of the fade |
| The closed transform scales, never translates (note 5) | Base UI reads the popup's transform when a `SwipeArea` drag starts (`resolveClosedOffset`, `min(height, abs(translateY))`), before it marks the popup as swiping | A pull tracks ten pixels instead of the panel's height, then overshoots |
| The fade is a keyframe animation on the shell, not a transition | The shell's `transition` shorthand belongs to the surface recede, and `data-starting-style` lives one frame: too short for a transition, long enough to start an animation | A second `transition` rule replaces the recede wholesale |
| No scrim; the viewport takes no pointers | The old dock's `fixed inset-0` scrim ate every press | With a panel open, the command palette's FAB is unreachable (measured) |

**On notes 4 and 5.** A fade on the popup was tried and shipped, and it made
the panel see-through on the way in, the page's text legible straight through
it, unblurred. A/B'd at the same opacity on the same frame: on the shell the
text behind it is blurred, on the popup it is sharp. That is why the popup
carries the transform and the fades sit one level down, on the shell and on
the pill, which are themselves the glass. The sheets hold to the same rule,
and so does the notice. Nothing in the repo tests this; to check by hand,
sample frames across the entrance and make sure nothing *between* the shell
and `<body>` is fading or filtering. Base UI reads the *popup's* animations to decide when an exit
is over, not the subtree's, so the shell's fade never holds the unmount open.

The obvious pop is `translateY(-10px) scale(0.94)`, and the `translateY`
silently broke the pull: ten pixels of offset told Base UI the panel was ten
pixels from open, and the measured `--drawer-swipe-movement-y` came back at
+12px where −170 was due. A pure `scale()` leaves the transform's Y at zero
and the measurement falls through to the panel's height. The ten pixels cost
nothing to look at: scaling a 170px panel by 0.94 from `top center` already
lifts its bottom by about that much.

### Layout & coexistence

- **Collapsed:** pills sit side by side in a centered row. The row is
  horizontally scrollable (`.no-scrollbar`) once it gets crowded, so N pills
  scale gracefully.
- **Expanded:** the open activity's panel takes over the top-center anchor and
  **every pill goes invisible and stops taking pointers** (`data-hidden` on
  `[data-dock-pill]`); collapsing restores them. They stay mounted, so the row
  keeps its layout and its scroll position while a panel is up. (Activities
  aren't individually dismissible, so we never strand a pill behind a panel.)
- **One at a time:** opening an activity collapses any other that was open.
- **Dismissal:** a press outside, Escape, a swipe up, the collapse chevron, or a
  route change. All but the last are the drawer's; the last is
  `DockProvider`'s.
- **A notice takes the anchor too:** while one is up the pills step aside for
  it exactly as they do for a panel, and a notice raised while a panel is open
  waits for the panel to close. Parked windows (`MinimizedWindows`) step aside
  the same way.

## Adding a Live Activity

Render a `<LiveActivity>` from a component that is a child of `<Dock>` in
`app/layout.tsx`. Return `null` when there is nothing to show; the provider
collapses the dock if the open one unmounts.

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

What is free to choose, for an activity that is more than a card:

| prop | |
|---|---|
| `actions` | header buttons of its own, between the title and the collapse chevron (Ask's history and new chat) |
| `panelWidth` | a CSS length for the panel, set on the popup (default `min(92vw, 360px)`; Ask's is `min(92vw, 440px)`) |
| `working` | the activity is at work on something asked of it: the site's glow travels the pill's edge as the `processing` beam, off while the pill is hidden. A sibling of the glass with an 8px halo, which the row's shadow room and gap leave space for. |
| `moveFocus` | `false` leaves focus alone on open (Base UI's `initialFocus`), for content that focuses its own field; otherwise the drawer's focus lands on top of it |
| `headerHandle` | makes the title bar a drag handle of the feature's own (`onPointerDown`, `className`), separate from the drawer's touch swipe. Ask uses it to carry its panel between places with a pointer. |
| `pillClassName` / `panelClassName` | extra classes on the pill's glass and on the panel's shell |

Checklist:

- Reuse the body the same feature shows elsewhere (`NowPlaying`,
  `WeatherNow`), so the panel and the widget never drift.
- The body carries its own padding (`px-5 pb-4` is the usual).
- Nothing in the body fades or filters a box that holds glass (rule 4).
- Check a tap, a pull down from the pill, and a throw up on a phone; a click
  and Escape on a desk.

## Notices

```ts
import { showNotice, dismissNotice } from "@/systems/dock";

showNotice({
  id: "solar-theme",          // the same id again updates it in place
  icon: Sunset,
  title: "Dark Mode",         // the fact
  note: "Following the Sun",  // behind it: what did not change, or how to undo
  duration: 5_000,            // default NOTICE_DURATION_MS, 3.2s
});
```

A notice is the system telling you something happened, once, in a line: the
sun switched the theme, the page is in the other language now, the sky window
opened, a link went to a new tab. It is callable from anywhere (providers,
effects, a clock) because it is a module store (`notice.ts`) rather than a
context. Most callers sit beside the Dock in the tree, not under it.
`dismissNotice(id)` takes it down only if that id is the one showing.

| Edge | Direction | What lives there |
|---|---|---|
| **Top** | the system → you | Live Activities, notices |
| **Bottom** | you → the system | the command bar, and the sheets that rise from it |

Rules it keeps:

- **One at a time.** A new notice replaces the one showing; they crossfade in
  place. Nothing stacks.
- **Its time runs only on screen.** Behind an open panel it waits, then gets its
  full duration. While it is held (a finger down on it, or a pointer resting
  over it) the timer stops, and on release it gets the time it had left.
- **A tap or a swipe up takes it down early.** Swiped up it follows the finger
  and leaves that way; a short pull springs back. It is not a button (a screen
  reader hears it through the `role="status"` region), so its time is what
  dismisses it for everyone else.
- **It does not publish into `--dock-clear`.** The /works and /prompt bars pin
  under the pills by that variable; pushing them down for a three-second line
  would make them jump twice. Left alone under a notice, a pinned bar is wider
  than it and shows round both its ends, so those two bars fade and lift away
  the way the pills do, and come back when the notice goes
  (`components/ui/use-notice-yield.ts`). Only when actually under the notice:
  pinned below Live Activity pills a bar already clears it, and resting under
  the title it is nowhere near. A lab's own bar (`LabBar`) does not step
  aside yet: on a desk the Band Lab's "Fire a notice" lands on top of it.
- **Opacity on the glass.** The notice's fade is on the capsule, which carries
  the blur (rule 4).
- **No choices in it.** Anything that asks, like a link shared in the other
  language than the reader's, is a surface. `components/post/language-sheet.tsx`
  is a form sheet rising from the bottom at every width, capped at 400px on a
  desk (`sheetMaxWidth`), and not modal: no scrim, the page stays live behind
  it.

**Why the top, and not a bottom toast.** The site used to show these through
Sonner at the bottom centre. Measured on a 390px phone, the toast row sat 16px
from the bottom and 46px tall, over the command bar at 24–72px: for the three
seconds it was up, a tap on ⌘K landed on the toast. The two-button language
card was worse: 136px tall, it covered ⌘K until answered, and at
`z-index: 999999999` it drew over every sheet and over the About veil. A
notice at the top cannot collide with the command bar, and the Dock already
knew how to share its anchor (pills ⇄ panel).

### Shape

The shape says what a thing is, not which edge it came from:

- **Capsule** (`GLASS_CAPSULE`, `lib/glass.ts`) is for one line to glance at:
  a Live Activity pill, a notice, the pinned /works and /prompt bars, the
  command bar.
- **Rounded rectangle** is for something to read or act on: the Live
  Activity panel (16px), a sheet (24px), a window.

A capsule with two buttons in it, or a card pretending to be a toast, is the
thing to avoid.

## Reference

### Consumers

| Activity | Source | Pill | Panel body |
|----------|--------|------|------------|
| Music | `systems/music/components/music-activity.tsx` | album art + EQ | `<NowPlaying />` |
| Ambient phase | `systems/ambient/components/phase-activity.tsx` | sun icon + time | `<WeatherNow />` |
| Theater audio | `systems/theater/components/theater-activity.tsx` | thumbnail + EQ | transport + `<SurfaceSwitch />` |
| Ask | `systems/ask/components/activity.tsx` | sparkle + what the agent is doing, glow while it works | the conversation, history, composer (see [system-ask.md](./system-ask.md#where-ask-sits)) |
| Minimized windows | `systems/windows/components/minimized-dock.tsx` | app icon + title (its own pill, not a `LiveActivity`) | none (restores the window) |
| Samples | `systems/dock/components/sample-activities.tsx` | stand-ins, only when `/lab/band` asks | a line of sample text |

Music only appears once something has played this session; ambient phase
only around sunrise and sunset; theater only while a video is in its Audio
view.
Headless, music is the one to reach for: `localStorage.hux_music_mock = "1"`
before the app's scripts run, then press Play on the home widget.

Notices: the sun switching the theme (`systems/ambient/components/solar-theme.tsx`),
the sky window opening and closing (`wallpaper-background.tsx`), a link that
refused to be framed (`systems/attachments/provider.tsx`), the language switch
on a bilingual post (`components/post/use-post-language.tsx`), a voice input
error (`systems/command/voice.tsx`), Ask's sources being full
(`systems/ask/components/selection.tsx`), the Works and Icon labs' save and
reset (`app/lab/works`, `app/lab/icon`), and the Band Lab's "Fire a notice".

### The top band, and its lab

Everything above competes for one strip at the top of the screen: Live
Activities, parked windows, a notice, an open panel, and a page's pinned bar
(/works's and /prompt's toolbars, a lab's own bar). How they share it is still
being decided, on the real components. It is a composition of independent
choices, `BandConfig` in `systems/dock/band.ts`, read by the Dock, every
`LiveActivity`, the parked windows and the page's `PinnedSlot`:

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
does not at all. Anything else is a session override (sessionStorage) set in
**`/lab/band`**. A configuration applies only once a bar has *met* the band;
until then, and on every page without a pinned bar, the Dock behaves as it
always has. Every pinned bar takes part: /works's and /prompt's toolbars,
and every lab's own bar (`LabBar`), which rides in a `PinnedSlot` at the
band's height unless a lab sets it aside (`pin="static"`).

Where everything stands is one function, `bandGeometry(band)`, read by both
the Dock and the slot, so they never disagree about a pixel. It returns two
things. The occupants' **window** is exactly where they may be seen and where
the Dock row clips, so nothing slides under the bar, the gutter or a ball.
The bar's **reserve** is the width it gives up at its end. Some rules it
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
`pin="band"` (the default).

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

### `--dock-clear`

The Dock publishes how far down its pills reach as `--dock-clear` on
`<html>` (0 with none), measured from layout boxes, not rects, because a pill
arrives scaled. Anything pinned to the top of the page (the /works bar, the
lab bar's `--lab-bar-top`) clears the Dock by it instead of guessing whether
a Live Activity is up. A notice does not publish into it (see
[Notices](#notices)).

## History

### Why it exists

Before, the pill/panel/drag/Esc/route-collapse machinery lived inside
`MusicDock`. Adding a second notification (ambient phase changes) would have
meant copy-pasting all of it. The dock extracts that machinery once.

Moving the panel onto the drawer deleted the hand-written `drag="y"` +
`dragConstraints` + `onDragEnd` 40px threshold, both `AnimatePresence`
blocks, the transparent scrim in `Dock`, and the Escape listener in
`DockProvider`. It also deleted the rule that the pill row must carry no
transform (the `fixed` panels inside it would have anchored to the row): the
panel is portalled now. The one thing it does not replicate is the scrim
eating every press (the last of the [Rules](#rules)).

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
