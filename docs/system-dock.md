# Dock System

The dock is the top-of-screen home for **Live Activities**. It is ONE island —
a single object that several activities merge into — and it is the shared
foundation for the "Global Player" UI: the music player, the ambient phase
notification and theater audio are all dock activities and therefore look and
behave identically.

## Overview

```
systems/dock/
├── provider.tsx                  # DockProvider + useDock (coordination only)
├── components/
│   ├── dock.tsx                  # <Dock> — the island and its satellites
│   ├── live-activity.tsx         # <LiveActivity> — the two compact forms,
│   │                             #   the panel, and the deformation between
│   └── index.ts
└── index.ts
```

## Why it exists

Before, the pill/panel/drag/Esc/route-collapse machinery lived inside
`MusicDock`. Adding a second notification (ambient phase changes) would have
meant copy-pasting all of it. The dock extracts that machinery once:

- **`LiveActivity`** owns the *visuals*: the compact presentation in either of
  its two forms, the expanded panel (header, body, grabber), and the drawer the
  panel is made of.
- **`DockProvider` / `useDock`** own the *coordination*: a single `openId`
  (only one panel open at a time), who holds the island, and route-change
  collapse.
- **`Dock`** owns the *layout*: the island, its satellites, and the gaps
  between them.

Activities supply only content.

## One island, not a row of pills

This is the change that makes the metaphor true, and it is worth stating what
it replaced. The dock used to be a horizontally scrollable strip of identical
capsules — one per activity, one per minimized window, all `h-9 rounded-full`,
with mouse drag-to-scroll once it got crowded. Open one and the rest faded out.

That is a notification tray. Apple's first sentence about the Dynamic Island is
that it "serves as a unified home for alerts and indicators of ongoing
activity", and what makes it read that way is not its corner radius: it is that
several activities **merge** into one object instead of queueing beside each
other. A 44pt corner on a row of five pills is still a row of five pills.

So the row lays out three classes of thing, and the gaps carry the hierarchy:

| Slot | What | Form |
|---|---|---|
| `island` | one activity — the one that arrived LAST | the compact presentation: `lead` + `trail` + chevron |
| `dot` | every other activity | `lead` + `trail`, detached by a 10px gap — collapsing to a bare `h-9` circle when the row is crowded |
| `window` | minimized app windows | an app icon + its title, one step down in glass, furthest out — collapsing the same way |

Apple's compact presentation splits around the TrueDepth camera — one element
leading, one trailing. We have no camera, so the gap is the island's own and
the chevron sits in it; but the split is the same, and it is why `LiveActivity`
takes `lead` and `trail` rather than one `pill`. `lead` has to identify the
activity on its own, because when a satellite collapses it is all there is.

The chevron is the island's alone. It is the one that says *this expands*, and
a satellite carrying it would read as a second island rather than a satellite.
Tapping a satellite still opens its panel — the affordance is the difference,
not the ability.

**The gaps are a `column-gap`, and that is not a detail.** Visual order comes
from CSS `order` — the row's children are fixed by `layout.tsx` (ambient,
music, theater, windows) while their slots are decided at runtime — and a
sibling selector cannot see it. `[island] + [dot]` matched DOM *adjacency* and
put the gap wherever the DOM happened to agree, so with the sunrise
notification rendered before the music island, which is the ordinary case since
it is first in `layout.tsx`, the 6px landed at the row's left edge and the two
touched. (`:first-of-type` was worse: it matches by tag name, both are divs, so
a dot was never the first of its type and that rule could never fire.) A gap is
applied between items in **order-resolved** order, so it is the only thing here
that can be trusted; the island buys its extra detachment with a
`margin-right` of its own, which lands in the gap after it wherever it sits.

The walkthrough keeps that configuration as a regression: it seeds a sun event
so the ambient activity mounts, then asserts the gaps while reporting both
orders — `visual ["island","dot","window"] vs DOM ["dot","island","window"]`.

**The island goes to the newcomer.** A Live Activity appearing is news — the
sunrise notification opening while music plays is the same shape of event as an
alert — so the arrival takes the island and the incumbent steps down to a dot.
When its window passes and it unmounts, the island falls back. Opening an
activity does *not* promote it: its panel grows out of wherever its compact
form actually is, dot included, which is what a touch-and-hold on a minimal
presentation does on iOS.

**A satellite collapses only when the row is crowded.** That is what iOS's
minimal presentation is *for*: it exists because the Dynamic Island has one
status bar's worth of room to share, and a 1280px row does not have that
problem — collapsing there would be answering a question nobody asked. So a
satellite keeps the shape it had before the island existed, and gives it up
when there is no room:

| | satellites | a satellite is |
|---|---|---|
| phone (`< 640px`) | 1 | `lead` + `trail`, or icon + title |
| | 2+ | a bare circle |
| wider | up to 4 | `lead` + `trail`, or icon + title |
| | 5+ | a bare circle |

Room is **counted, not measured**. Every satellite's label is width-capped
(`max-w-20` on a window's title), so the count is a sound proxy for the width,
and counting costs one integer where measuring costs a second layout pass and a
hysteresis rule to keep it from oscillating. The budget's numbers come from the
narrow case: at 390px the row has ~358px, an island is ~80 and a capped
satellite ~130, so one fits with room to spare and two leave none.

`dock.tsx` counts (a `MutationObserver`, because the children come from four
systems and a window minimizing does not re-render the dock) and publishes
`data-dock-satellites` and `data-dock-dense` on the row; the CSS does the rest.
Components only mark what may be dropped, with `data-dock-extra`.

**Nothing scrolls.** An island that scrolls is a row again; the collapse above
is what replaces the scrollbar.

**A parked window is not ongoing activity.** Nothing about a parked app is live
and it has no expanded presentation, so it sits furthest from the island and a
step down in glass. Its title is the first thing to go when the row fills, and
nothing is lost when it does — the tooltip has carried it all along.

## The panel is a Base UI Drawer, travelling up

The expanded panel is one `Drawer.Root` with `swipeDirection="up"` — the mirror
of the phone sheet in `systems/surface`. The Dynamic Island metaphor is anchored
at the top and puts itself away *upwards*; a sheet does the same thing from the
bottom edge. They are the same library, the same data attributes, and the same
shared stack, so the site has one overlay vocabulary rather than two.

What that deleted: the hand-written `drag="y"` + `dragConstraints` +
`onDragEnd` 40px threshold, both `AnimatePresence` blocks, the transparent
scrim in `Dock`, the Escape listener in `DockProvider`, and the row's
drag-to-scroll. The motion is now CSS, in the dock block of
`app/globals.css`.

What it bought:

| | |
|---|---|
| **The deformation** | The panel does not slide in from the top edge. The glass shell starts at the compact form's own rectangle and *changes size* into the panel's — width, height, corner and offset together — so the compact form appears to become the panel. |
| **Pull to expand** | `Drawer.SwipeArea` wraps the compact form, so dragging *down* from it opens the panel and the panel follows the finger the whole way. Release short of half the panel's height and it snaps back. This is the iOS Notification Center gesture; before, a pill could only be tapped. |
| **Stacking** | The panel registers in the shared surface stack (`systems/surface/stack.ts`) as `dock-activity`. It was the one overlay on the site that did not know about the others. Now a palette opened over it (from the keyboard — a press on the FAB is an outside press and dismisses instead) sends it back a step and makes it inert, and a panel opened over the playlist sheet sends *that* back instead. |
| **Free layout** | The panel is portalled into the shared `SurfaceViewport`, so the old rule that the dock row must carry no transform (or the `fixed` panels inside it would anchor to the row) is gone. |

Before changing any of it, read the "BEFORE CHANGING THIS FILE" block at the top
of `systems/dock/components/live-activity.tsx`, and the one it points at in
`systems/surface/sheet.tsx`.

### The entrance is a deformation

The panel does not slide in, does not pop, and is not revealed. The glass shell
starts at the compact form's own rectangle — width, height, corner, horizontal
offset — and **changes size** into the panel's. All four travel together, which
is what makes the 44pt panel read as the compact form grown rather than as a
different object that appeared.

**Width and height, not a scale.** A scale is cheaper and is wrong twice: it
magnifies what the shell's `backdrop-filter` samples, so the page appears to
zoom behind the glass, and it stretches the border and the text with it. A real
size change costs a layout per frame on one absolutely-positioned box — nothing
in the page reflows — and the blur re-samples at 1:1 the whole way. Measured
across the entrance: `backdrop-filter` held at `blur(24px)`, first frame
`80×36 r=18 left=155` against a compact form at `80×36 r=18 left=155`, last
frame `359×172 r=44 offset=0`.

**And not a clip, which is what this replaced.** The previous version clipped a
full-size panel down to the pill's rectangle and opened the clip. It looks
close, and it is a reveal: the content is already at full size, merely hidden.
Nothing deforms, so the corner cannot travel with the box.

The content is laid out at the panel's final width and clipped by the shell
while it is small, so it never reflows mid-deformation — Apple: "preserve as
much of the existing layout as possible by animating existing elements to their
new positions rather than removing and animating them back in." What it does
instead is arrive, on a fade that starts 30% in, because starting it at zero
put a corner of the album art on screen while the shell was still pill-sized.

#### Two divisions of labour, and a measurement that has to be early

**The popup carries the swipe; the shell carries the deformation.** Base UI
reads the *popup's* transform to decide how far "closed" is, so the popup's
transform belongs to the drag and nothing else. Everything the entrance does
happens one level down.

**The popup is the panel's box even while the shell is pill-sized.** Letting it
shrink with the shell was a measured bug: `Drawer.SwipeArea` opens the drawer on
the first pixel of a pull, and Base UI reads the popup's height right then to
decide how far the finger has to travel. With the popup 36px tall, a pull that
should track ~170px of panel tracked 36 and overshot — `--drawer-swipe-movement-y`
came back at **+11px** where **−170** was due. So the popup's height is pinned
and only the shell deforms inside it; pointer events move to the shell, so the
empty margin during the entrance still belongs to the page.

**The anchor is measured off the compact form ALONE, before the panel exists.**
This is the part that took three tries. The panel mounts with
`data-starting-style` already set, so the very first style the browser resolves
for it has to be the compact form's geometry; anything that lands a commit
later is a different starting value and the browser has already latched the
resting one. That failure is quiet and specific: `width`, `border-radius` and
`transform` interpolate from the resting value — so they appear not to animate
at all, sitting at the end the whole time — while `height` *jumps*, because its
resting value is `auto` and `auto` does not interpolate. Measured before the
fix: width crawling `358.797px → 359px` across the entire entrance.

So nothing in `useAnchor` touches the panel. The compact form is always
mounted, so its box is free; and the panel's box is derivable without it —
`mx-auto` inside a full-screen layer puts its left edge at
`(viewport − PANEL_WIDTH) / 2`, and its top edge is the same `TOP_INSET` the
dock row sits at, which is why there is **no Y in the deformation at all**. The
walkthrough asserts that shared top rather than trusting it.

The panel's *resting* size is measured too (`restingVars`), and that one is
free to land late — it is the value the deformation travels to, so a commit's
delay changes the target, never the latched start. Measuring it is also what
lets the panel's height follow its content afterwards: a longer title, a
weather card that gains a row. Apple asks for exactly that — "dynamically
change the height … when there's less information to show, reduce the height" —
and because the shell's height is a transitioned pixel value, re-measuring *is*
the animation.

A swipe-up dismissal does not deform. A finger that has flicked the panel
upward should be answered by the panel going that way, not by it collapsing
back onto a compact form the finger has left behind, so that exit travels over
the top edge.

### The radius is Apple's number, not ours

The panel is `rounded-dock` — `--dock-radius: 2.75rem`, 44px. It is the one
radius on this site that is copied rather than derived from `--radius`, because
it is quoting something specific:

> The Dynamic Island uses a corner radius of 44 points, and its rounded corner
> shape matches the TrueDepth camera.
> — Apple HIG, *Live Activities*

The number transfers 1:1 rather than needing a ratio, because the panel is very
nearly the size of the thing it is quoting: **359 x 170 CSS px** against an
expanded Island's **371 x 84-160pt**. The collapsed pill is `h-9 rounded-full`
— 36px tall, fully round — against a compact Island's 52.33 x 36.67pt, which is
the same shape at the same size. So the dock is not *evoking* the Island at this
point; it is the same geometry.

It is deliberately off the `--radius` scale (`rounded-2xl` is 18px, `rounded-4xl`
26px, and the next step up would still be a card corner rather than a capsule).
`--dock-radius` lives in `:root` next to `--radius`, and `@theme inline` maps it
to the `rounded-dock` utility.

**Margins are concentric, at 20px.** The HIG asks for "even, matching margins
between rounded shapes and the edges of the Live Activity, including corners",
and at a 44px corner an uneven one shows. The header is `px-5 pt-5` and every
activity body is `px-5`, so the content sits 20px in on three sides; the
tightest point is the title at y=20, where the corner has eaten 7px of the 20.
Nothing pokes into the curve — the closest is the album art's bottom-left
corner, 20px from the left where the curve has eaten 5px.

**Inner corners are concentric too, by publication rather than by import.** The
HIG also asks an inner rounded rectangle near a corner to "match its corner
radius to the outer corner radius of the Live Activity by subtracting the
margin", which puts a box inside our 20px margin at 44 - 20 = **24px**. The
panel publishes exactly that as `--radius-concentric` on its shell, and content
opts in by reading it with its own value as the fallback:

```tsx
// the panel                    // <NowPlaying />'s album art
"--radius-concentric":          rounded-[var(--radius-concentric,var(--radius))]
  "calc(var(--dock-radius) - 1.25rem)"
```

So the dock does not reach into `<NowPlaying />` and `<NowPlaying />` does not
import the dock's number — and the homepage music widget, which sets no such
property and has no 44px corner to be concentric with, resolves to `var(--radius)`
and is byte-identical to what `rounded-lg` gave it. Measured on the homepage:
`10px`, unchanged.

Not everything inside the panel should opt in. Theater's `<TrackThumb />` sits
at the left edge but nowhere near a corner, and it is 96 x 54 — a 24px radius on
a 54px-tall box is not concentricity, it is a lozenge. The guideline is about
shapes *near a corner*; the album art, whose bottom-left corner is 20px from the
left edge and 24px from the bottom, is one, and the thumb is not.

### The glass is the constraint on the motion

**Opacity belongs on the glass, never on a box that contains it.** An element at
`opacity < 1` is its own backdrop root, so a `backdrop-filter` *inside* it
samples that empty group instead of the page: the glass is not there at all for
the length of the animation. On the element that carries the blur the same
opacity is fine — its own backdrop resolves before its opacity applies.

A fade on the popup was tried and shipped, and it made the panel see-through on
the way in, the page's text legible straight through it, unblurred. A/B'd at the
same opacity on the same frame: on the shell the text behind it is blurred, on
the popup it is sharp. So nothing above the glass ever fades. What fades is
`[data-dock-content]`, *inside* it.

The walkthrough guards it frame by frame: the entrance fails if anything between
the shell and `<body>` is fading or filtering, if the shell's first frame is not
the compact form's own box, if any of width / height / corner / offset fails to
travel, if the popup transforms at all, or if the content is visible before the
box has grown.

### The material

Apple's Dynamic Island is opaque black because it is hiding a camera cutout. We
have no cutout — we have [the glass system](./system-glass.md) and [the
legibility system](./system-legibility.md) — so the island is glass, and it is
finally the *right* glass:

| | Role | Was |
|---|---|---|
| Island and dots | `bg-glass-strong` | `bg-glass` |
| Panel | `bg-glass-overlay` | `bg-glass` |
| Window dots | `bg-glass` | `bg-glass-strong` |

Those first two roles are what `docs/system-glass.md` has specified for a Live
Activity's pill and panel since that system was written. The dock was the one
surface quietly painting itself with plain `bg-glass` in both places, which
meant it answered the Tinted/Clear setting a step weaker than the minimized
windows sitting in the same row. Measured against the tokens rather than against
literal numbers, because the legibility policy adds `--wp-glass-add` on a busy
or wrong-toned wallpaper: the fills are `--glass-strong` and `--glass-overlay`
whatever the picture does to them.

**The border is neutral, and the key line was tried and taken out.** The HIG
asks for one — "when the background is dark … a key line appears around the
Dynamic Island to distinguish it from other content. Choose a key line colour
that's consistent with the colour of other elements in your Live Activity" — and
it shipped for a while: the activity's colour (music's green, theater's red)
mixed *into* the border token rather than replacing it, at 22%/50% on the
compact form and half that on the panel, which is twenty times the area.

It came out because the contrast was too strong for a site whose whole palette
is ink at an alpha, and because nothing depended on it. Its stated job in the
HIG is to *define the edge* against a dark backdrop, not to identify the
activity — and `border-border/50` already does that, on the legibility ladder,
so it brightens with the wallpaper. Identity has two stronger carriers that
remain: `lead` differs by shape and image (a round album art, a square video
thumbnail, a sun glyph) and is exactly what survives into the minimal form, and
`trail` already carries the same green and red in the EQ bars. Removing it also
took the one place on the dock where colour alone encoded anything.

What we do **not** do: specular highlights, lens distortion, edge refraction.
`system-glass.md` rules them out for every surface on the site — "nothing
pretending to be a physical pane" — and an island is not the place to make an
exception. The liquid-glass behaviour this does take is the one that costs no
pixels: elements merging and separating.

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
  <TheaterActivity />
  <MinimizedWindows />
</Dock>
```

```tsx
<LiveActivity
  id="music"
  openLabel="Open music controls"
  collapseLabel="Collapse"
  // Apple's compact split. `lead` identifies the activity and is ALL the
  // minimal form shows, so it has to carry it alone; `trail` is the live bit
  // and rides the island only.
  lead={<AlbumArt />}
  trail={playing ? <EQBars /> : undefined}
  title={<>{/* panel header left side */}</>}
>
  {/* panel body — bring your own padding, `px-5` to stay concentric */}
</LiveActivity>
```

Order in the JSX does not decide order in the row: `data-dock-slot` and CSS
`order` do, because which activity holds the island is a runtime question.

## Layout & coexistence rules

- **Collapsed:** one island, then the other activities as detached circles,
  then minimized windows. Nothing scrolls. Sorted by `data-dock-slot`, not by
  DOM order, because the children come from four different systems and none of
  them knows what the others rendered.
- **Expanded:** the open activity's panel takes over the top-center anchor and
  **every compact form goes invisible and stops taking pointers**; collapsing
  restores them. They stay mounted, so the row keeps its layout and its order
  while a panel is up.
- **One at a time:** opening an activity collapses any other that was open.
- **Dismissal:** a press outside, Escape, a swipe up, the collapse chevron, or a
  route change. The first three are the drawer's; the last is `DockProvider`'s.

## Consumers

| Activity | Source | `lead` | `trail` | Panel body |
|---|---|---|---|---|
| Music | `systems/music/components/music-activity.tsx` | album art | EQ bars | `<NowPlaying />` |
| Ambient phase | `systems/ambient/components/phase-activity.tsx` | sun glyph | the time | `<WeatherNow />` |
| Theater audio | `systems/theater/components/theater-activity.tsx` | square thumbnail | EQ bars | transport + `<SurfaceSwitch />` |
| Minimized windows | `systems/windows/components/minimized-dock.tsx` | app icon (dot only) | — | — (restores the window) |

Music and Ambient phase reuse the same shared body component their homepage
widget uses (`NowPlaying`, `WeatherNow`), so the dock panel and the grid widget
never drift.

Theater's thumbnail is square rather than the 16:9 it wants to be, because
`lead` has to work in the minimal form too and a 36px circle has no room for a
widescreen crop without it touching the border on both sides.
