# Devtool System

The devtool system provides **developer tools** for debugging and testing the ambient subsystem without affecting production users.

## Overview

```
systems/devtool/
├── provider.tsx       # DevtoolProvider: enabled, open, docked
├── dock.tsx           # Where the devtool is, and the gestures that move it
├── panel.tsx          # The modules — content, unaware of its container
└── index.ts           # Barrel exports
```

## Key Features

### One object, two dockings

The devtool is not a button that opens a panel. It is **one object** that is
either docked to the bottom edge or floating free, and either showing its
modules or collapsed. Two booleans in the provider — `isOpen`, `isDetached` —
and the viewport turns them into a shell:

|          | docked (an edge to hug) | floating |
|----------|-------------------------|----------|
| **open** | `SurfaceSheet`, bottom edge, `SHEET_DETENTS` | `SurfaceWindow`, top right, 420px |
| **closed** | nothing — `D` or ⌘K summons it | the pill |

The pill is therefore a **state, not a door**: it is the devtool collapsed,
which only exists once the devtool is floating. A desktop has no bottom edge
worth docking to — a full-height devtool against an edge would cover the page
it is about — so it reads as floating whatever the setting says. That is the
pill ⇄ window pair it has always had; the phone is what gains a second docking.

### The gestures

Two, and they are mirror images of each other:

| | Gesture | What it does |
|---|---|---|
| **off the edge** | Pull the sheet up past its top edge, let go | Lands as the pill |
| **back onto it** | Drag the pill onto the bottom edge, **hold**, let go | A landing pad rises to meet it; the release puts the sheet back |

Both say the same thing in the same language — *where this belongs is something
you move it to* — so neither has to be learnt on its own, and the pad appearing
under a dragged pill is what teaches the pair. "Give me this everywhere" and
"put it back" are the motions themselves, not commands about them.

Detaching also dismisses the command palette if it is open. The palette is
usually what summoned the devtool, and asking for a pill is asking for the
page back — leaving the thing you came through still sitting there is the
opposite of that.

The window's header keeps a dock button as well (`PanelBottom`, beside the
close), because a window is not draggable to an edge on a touch screen without
covering the screen on the way.

**Off the edge.** A pull that *stops* at the top snaps to the full detent as
always; a pull that *keeps going* detaches. The band between them is about
twenty pixels, and the shell gives a little (`data-pull-armed`) once the
release would commit, so the gesture can be seen before it happens and eased
back out of.

That threshold is small because it is measured, not chosen. Most of a pull is
spent resizing the sheet — from the 0.7 detent that is 187px on an iPhone 13 —
and what is left over is the distance from the grabber to the top of the glass.
See `PULL_PAST_TOP_TRAVEL` and the note beside it in
`systems/surface/sheet.tsx`, which also explains why the gesture reads the
pointer rather than Base UI's published overshoot.

**Back onto it.** The pad is only up while a pill is actually in hand, and only
where there is an edge to dock to — it is a drop target, not decoration. It
stands where the sheet will, inset by the surface system's edge gap, with the
sheet's own grabber waiting at the top.

**Arriving is not the decision; staying is.** Being able to put a floating
thing anywhere is the whole point of a pill, so passing over the pad — or
dropping straight through it — just leaves the pill there. Only a release
after the pill has been *held* on the pad for `DWELL_MS` docks it. The pad is
shallow for the same reason (84px, a thirteenth of a phone screen): a target
that swallows the bottom quarter takes the bottom quarter away from the pill.

The wait is drawn, not hidden: the grabber fills to full width over exactly
the dwell, on the clock that is actually running, and gives it back if the
pill leaves early. `data-dock-pad` carries the three states (absent, `over`,
`armed`).

Docking makes the pill *forget* where it was dragged
(`forgetPosition`, `systems/draggable`): the spot it was released over is a
target, not a seat, so the next time the devtool comes off the edge it comes
back to its corner rather than to the mouth of the dock.

### Non-modal, and stacked

The panel never takes the page away — the devtool exists to watch the page
react while wallpaper, glass and sky are turned. The page underneath stays
scrollable and clickable, and a press on it belongs to the page; the close
button, `D`, Escape and a downward drag dismiss.

Being a surface is what the panel was missing. It used to be a desktop card
squeezed to phone width: pinned over the dock's Live Activity, dragged by a
handle no finger wants, with no swipe to dismiss and no place in the surface
stack — so a picker opened from it had nowhere to go but over it, and the
panel folded itself away first (`openPicker(); closePanel();`). Now the picker
**stacks** on it, three deep from the palette: palette → devtool → picker, each
one stepping back as the next rises. On a desktop the windows simply coexist,
the picker on top.

### Composability

The devtool is hosted in three different shells over its life, so nothing about
where it is lives in the modules. `panel.tsx` exports `DevtoolModules`,
`DevtoolTitle` and `DevtoolFooter` — content that does not know its container —
and `dock.tsx` puts them in whichever shell is up, wrapped in the shared
`<SurfaceBody>` so all three look like every other surface on the site.

This is why the surface system has a **primitive layer** under
`<AdaptiveSurface>` (see [Surface System](./system-surface.md)).
`<AdaptiveSurface>` encodes one rule — *the viewport picks the shape* — and
that rule is not the devtool's: here the shape is something the developer chose
with a gesture. So the devtool composes `<SurfaceSheet>` and `<SurfaceWindow>`
directly, the way the command palette already does for its search-field header.

Switching shells remounts the modules, since the three portal to different
places. Anything that must survive the move belongs in the provider or in
`localStorage` — which is where the collapsed sections and every persisted
setting already are. Scroll position and an unsubmitted OTA URL do not survive.

### Dragging

One draggable instance, `devtool`, because the pill and the window are two
sizes of one object. They share the top-right anchor, so the window opens
where the pill was and the pill lands where the window was left — the instance
persists, and each mounts reading back the other's position. (Turn `persist`
off in the Draggable module and that hand-off stops; the two then keep their
own offsets until the next reload.)

Both use `useDraggable` directly rather than the `withDraggable` HOC: the pill
needs its own drag handlers to know when it is over the pad, which is exactly
what the HOC exists not to expose.

The pill is its own handle; the window drags by its header. The module bodies
are never handles, so range inputs, text fields and scrolling keep working —
and on a phone the sheet's grabber replaces dragging entirely.

### Getting in and out

| Way in | What it does |
|--------|--------------|
| `D` | Toggles the panel, once the devtool is on. Docked: sheet ⇄ nothing. Floating: window ⇄ pill. |
| Command palette (`D` in slash mode, or "Debug Panel") | The on/off switch — see below. |
| Hold the search button | Summons it. Undocumented. |
| The pill | Only there when floating. |

**On and off are about what is on screen**, which is not the same as
`isEnabled`, and the two dockings answer it differently:

| | What "on" means | Off does |
|---|---|---|
| floating | `isEnabled` — the pill stands by, so it is on screen | disables; pill and window go |
| docked | `isOpen` — there is no pill, so the drawer has to actually be up | closes the drawer |

That is `isShowing` / `toggleShowing` on the provider, and the palette row just
reports it. The docked case is the one that used to be wrong: reading
`isEnabled` there meant that after swiping the drawer away the row still said
`On` with nothing on screen, so turning it back on took two presses — one to
"turn off" something invisible, one to turn it on again. **Swiping the drawer
down is off**, and one press brings it back.

Off in the docked case closes without disabling on purpose: `isEnabled` is also
what keeps the ambient overrides live (`systems/ambient/provider.tsx`), and
putting a panel away is not throwing its state away. To actually disable from
a phone, use the footer's "Disable Devtool".

`isFloating` and `canDock` live on the provider rather than in `dock.tsx`,
because this switch needs the same answer the shape does, and two places
deciding it is two places to drift apart.

The row's `kind` follows what the press will do — on opens a surface, so the
palette stays behind it as a stack; off opens nothing, so it leaves like any
other setting.

**The hidden one.** Holding the search button — either shape, the homepage
search bar or the round FAB — for `DEVTOOL_HOLD_MS` (1.2s) summons the devtool.
The press that carried it does not also open the palette, and a slide of more
than 10px is a drag or a scroll and cancels it.

It is a short hold because it is not a blind one. Nothing shows for the first
`DEVTOOL_HOLD_REVEAL_MS` (700ms) — past any tap, so an ordinary press never
sees it and the entrance stays hidden — and then a ring closes from 1.3× onto
the button's own edge, arriving exactly as the hold completes. The feedback is
what makes the shorter hold safe: an accidental hold announces itself in time
to let go.

The ring is drawn **outside** the button, at a measured `fixed` rect rather
than inside it: a finger is on the button, so anything drawn there — a
swapped icon, a fill — is under the fingertip and invisible. Both shapes of
the button share a 24px radius, so one ring fits both. See
`systems/command/fab.tsx`.

### Keyboard Shortcut

| Key | Action |
|-----|--------|
| `D` | Toggle devtool panel (when the devtool is enabled) |

## Components

### DevtoolFAB

Mounted once in the root layout. It is the dock: it reads `isOpen` /
`isDetached` against the viewport and renders whichever shell that comes to.

```tsx
<DevtoolFAB />
```

The pill's box takes no pointers — only the pill itself does, so a full-height
surface's close button in that corner still gets the tap. It is rendered rather
than hidden when the panel is up, so it remounts on close and picks up wherever
the window was dragged to.

### DevtoolModules

Header is the shared surface title bar (`Devtool Panel` · `DEV`, a dock button
where there is an edge to dock to, close button); the footer — `Press D to
toggle` and `Disable Devtool` — is the surface's `footer`, so it stays put
while the modules scroll. The modules:

1. **Wallpaper**: the whole background system — a Weather / Image switch and
   one row showing the current picture and its resolution, which opens the
   picker over the panel (choosing among the catalog is the picker's job, and
   it stacks on the devtool rather than replacing it), placement switches
   (full / widget / soft edge), the bezel switch and its tint (black / dark /
   theme / custom), band and radius, a window / container scroll switch, a
   hero-exit switch (scroll / fade — how the title leaves; the platform
   default lives in `defaultHeroExit`, this pins one for the session), the
   reading treatment switches (reading blur / reading dim),
   and the resolved asset. Under Weather two more rows: **Style** (Sky /
   Gradient / Classic — the persisted choice, the same three tiles the picker
   shows) and **No WebGL2** (a session switch that pretends WebGL2 is missing,
   so the Sky's fallback can be seen here; style and engine are otherwise
   one-to-one, so there is no engine picker). The last line reads the live
   engine back: `GL · 1266×791 · 0.88× · 6.4ms` (internal resolution, adaptive
   scale, frame time), or `CSS · Gradient` / `CSS · Classic`, with a note when
   the Sky had to fall back.
   Full and Widget are *independent* switches, not two halves of one control:
   the persisted setting can only be one of them, but the panel exists to see
   combinations the setting cannot express. They drive ephemeral overrides, and
   a `*` next to a label marks one; clicking the note under them clears all
   three back to the setting.
2. **Glass**: Material — Tinted (色调) / Clear (透明); Tint — Neutral /
   Wallpaper; a one-line readout of what the legibility policy resolved for
   the wallpaper that is painting (`flipped · busy · relief · +ink · +glass`),
   and a link to the Legibility Lab (`/editor/legibility`), where every one of
   those numbers is a slider. See `docs/system-legibility.md`.
3. **Sky**: weather and time as one thing, because the wallpaper is a function
   of both. A status line (condition · phase · clock · sun elevation · moon
   phase), a day timeline painted with the sky's colours for the current
   condition with a draggable playhead and ▶ play, phase names that jump the
   clock, the six conditions previewed at the effective hour (click again to
   return to live), the date slider that moves the moon, a **Gyro** row, and a
   folded Tune row of scene sliders. **Now** resets everything (the Gyro row
   excepted — it is a saved setting, not a forced scene, and wears the blue
   star to say so).

   The Gyro row is the tilt that makes the Sky's rain and snow fall along real
   gravity (`docs/system-ambient.md` → Gyroscope Tilt), with the live angle as
   its readout — and, on iOS, the second place besides the wallpaper picker
   where motion access can be granted, since that needs a tap to ask.

   **The meteor's window is marked on both axes it depends on**, because the
   rule has two halves and each one has a surface here that answers it alone:

   - **When** — a bar along the foot of the day timeline, ticked at each end,
     in the same ink as the sunrise and sunset marks it sits between; the times
     read out under it beside them. A window crosses midnight, so it arrives as
     two bars, one against each end of the strip, and reads as one range
     (`19:40 → 05:21`). Derived by asking `meteorPossible()` about real scenes
     minute by minute rather than by solving for the sun's altitude, so the
     marks cannot drift from the click that fires one.
   - **Through what** — a corner mark on every condition chip you could see a
     meteor through. It answers *if I picked this one now, could I see one?*,
     so it is evaluated **through `toSceneWeather`** — the one function that
     knows what forcing a condition means, which is that the real measurements
     go away, because a measured cover of 10% is a fact about today's clear sky
     and not about the overcast being previewed. Predicting any other way makes
     the mark promise something the click does not deliver. Overrides are
     included too: force **Cloudy** and the mark goes out (the
     profile's cover is 0.7), pull **Tune → Cloud** down to 20% and it comes
     back — and while that override stands it moves Clear with it, because a
     clear sky under 70% forced cloud really has no meteor in it. Only the
     weather half of the rule, though: a chip that also went dark at noon would
     be answering the timeline's question badly, so it does not.

   See `docs/system-ambient.md` → The Shooting Star for the two terms and why
   twelve degrees.
4. **Command**: **Phone palette** — Sheet (the bottom sheet the palette is on a
   phone) / Popover (the desktop card at phone width, the palette as it was).
   A saved setting, so a blue `*` marks it and resets it. Lets the two be
   compared on the same device; the popover code path is kept whole for it.
5. **Refetch**: Force re-fetch location/weather

## Controls

Rows are `PanelRow` (label left, control right) with a `PanelStar` when a
value is not at its default; switches are `PanelToggle`; choices are
`PanelSegmented`; numbers are the shared `Slider` from `components/ui/slider.tsx` (via
`PanelRange` / `PanelSlider`), the same one the Legibility Lab and the icon
studio use — an ink track with the platform's native thumb on touch. Only the Sky timeline's playhead
is its own range input.

## Hooks

### useDevtool

```typescript
const {
  isEnabled,        // Whether devtool is enabled at all
  isOpen,           // Whether the modules are showing
  isDetached,       // The stored preference: pulled off the edge
  canDock,          // Does this viewport have an edge worth docking to?
  isFloating,       // isDetached || !canDock — the shape-deciding one
  isShowing,        // Is any of it on screen? (see "Getting in and out")
  toggleShowing,    // The palette's On / Off switch
  toggle,           // Toggle the panel
  open,
  summon,           // Enable if needed, then open — what the palette runs
  close,
  detach,           // Lift off the edge; collapses to the pill
  dock,             // Back onto the edge; reopens as the sheet
  toggleEnabled,    // Toggle devtool enabled state
  setEnabled,       // Set devtool enabled directly
} = useDevtool();

// Legacy alias
const { ... } = useDebug();
```

## Debug Overrides

### Weather Override

Force a condition. Day/night is never part of it — the clock decides, so a
forced condition can't put a moon in a daytime sky:

```typescript
const { setDebugOverride, setSceneOverrides } = useWeather();

setDebugOverride({ condition: "rain" }); // null → back to the real weather
setSceneOverrides({ precipitationIntensity: 1 }); // heavy
```

### Time Travel

There is no phase override; there is one clock, and moving it moves the sun,
the moon, the sky, the phase, the greeting and the sun-event notice together:

```typescript
const { setTimeScrubMinutes, setDayOffset, resetTimeTravel } = useAmbientTime();

setTimeScrubMinutes(22 * 60); // 22:00 today
setDayOffset(11);             // eleven days on — a different moon
resetTimeTravel();            // back to now
```

### Wallpaper Debugging

The Wallpaper module drives the real (persisted) settings rather than an
ephemeral override, so the panel and the picker sheet can never disagree:

```typescript
const { setKind, selectWallpaper, selectWeather } = useWallpaper();

setKind("image");            // Swap the background kind, crossfaded
selectWallpaper("monterey"); // Hot-swap the pair, no reload
selectWeather("classic");    // Back to weather, the original palettes
```

It reads out what is actually painting — `Now: Sonoma · dark · full · desktop
@0.62`, where the last field says whether this route is the desktop or a reading
surface — and prints the resolved asset path underneath, which is the fastest
way to trace a wrong-looking background to a file.

## Persistence

- **FAB enabled state**: Persisted to localStorage
- **Override states**: Ephemeral (reset on page refresh)
- **Route preferences**: Persisted to localStorage

## Integration with Ambient

The devtool system **depends on** the ambient system:
- Reads weather/location/time state
- Writes debug overrides
- Uses `isEnabled` to gate debug features

```
DevtoolProvider
    ↓ reads/writes
AmbientProvider (useWeather, useAmbientTime)
```
