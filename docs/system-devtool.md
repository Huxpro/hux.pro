# Devtool System

The debug panel: thirteen modules for turning the site's knobs (wallpaper,
glass, sky, reading, Ask, voice, glow…) while watching the page react. It is
off by default in every environment, development included, and summoned by
`D`, by ⌘K's Debug Panel row, or by holding the search button. On a phone it
is a sheet docked to the bottom edge or a pill floating free; on a desk it is
always the floating pill ⇄ window pair. Every row that is off its default
wears a star: amber for an override that lasts this session, blue for a saved
setting.

## What it looks like done well

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-devtool/phone-sheet.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The devtool docked on a phone: a bottom sheet at its 0.7 detent over the home page, the title bar, the rail of module icons, folded modules with one-line statuses, the Wallpaper module open, the footer pinned." />
  <img src="/img/docs/system-devtool/phone-pill.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same phone after the sheet was pulled off the edge: only a black Debug pill with a D key hint in the top-right corner." />
</div>

Docked and floating on a phone (headless, 393pt wide). The sheet is a
surface like any other, on the site's detents, with the page live above it.
The rail under the title has a dot under the modules that matter on this page
and a star on the Sky icon (blue: a saved setting, here Follow the Sun off).
Pulled off the edge, all that is left is the pill.

![The floating devtool window at the top right of a desk, over the home page in forced rain at 20:30; the Sky module open with amber stars on its title, Time of day and Condition, and a blue star on Follow the Sun.](/img/docs/system-devtool/desk-window.png)

On a desk the devtool is a 420px window at the top right, so the page it is
about stays in view. Here the Sky module has rain forced and the clock scrubbed
to 20:30: amber stars on the module title, Time of day and Condition (gone on
reload), a blue one on Follow the Sun (saved), and the module's star repeated
on its rail icon. The playhead stands in the day strip, and the condition chips
wear their night faces because the clock says night; the live condition
(Clear) keeps its green dot.

- The page underneath stays live: scrollable, clickable, and repainting as
  each knob turns.
- A folded module is never blind: its header carries a one-line status and
  its star.
- What is open follows the page (relevance), not the last thing clicked.
- Every control is the site's own (`Switch`, `Segmented`, `Slider`) in the
  system tone, so the panel reads as part of the site.

## How it works

```
systems/devtool/
├── provider.tsx    # DevtoolProvider: enabled, open, docked; saved devtool
│                   #   settings (hux_devtool); DRAGGABLE_DEFAULTS / _INSTANCES
├── dock.tsx        # DevtoolFAB: where the devtool is, and the gestures that move it
├── panel.tsx       # The modules, rail and footer: content, unaware of its container
├── page-meta.tsx   # DevtoolPageMeta: a post publishes its frontmatter to the panel
└── index.ts        # Barrel exports
```

`DevtoolProvider` is mounted in `shared/providers.tsx` (it is told whether the
command palette is open, and how to close it); `<DevtoolFAB />` once in
`app/layout.tsx`. `DevtoolFAB` renders nothing until `isEnabled`.

### One object, two dockings

The devtool is **one object** rather than a button that opens a panel. It is
either docked to the bottom edge or floating free, and either showing its
modules or collapsed. The provider holds two booleans, `isOpen` and
`isDetached`, and the viewport turns them into a shell:

|          | docked (an edge to hug) | floating |
|----------|-------------------------|----------|
| **open** | `SurfaceSheet`, bottom edge, `SHEET_DETENTS` | `SurfaceWindow`, top right, 420px |
| **closed** | nothing; `D` or ⌘K summons it | the pill |

The pill is therefore a **state**, not something that opens the devtool: it is
the devtool collapsed, which only exists once the devtool is floating. A
desktop has no bottom edge worth docking to (a full-height devtool against an
edge would cover the page it is about), so from Tailwind's `sm` up it reads as
floating whatever the setting says (`canDock` is false). That is the pill ⇄
window pair it has always had; the phone is what gains a second docking.

### The gestures

Two, and they are mirror images of each other:

| | Gesture | What it does |
|---|---|---|
| **off the edge** | Pull the sheet up past its top edge, let go | Lands as the pill |
| **back onto it** | Drag the pill onto the bottom edge, **hold**, let go | A landing pad rises to meet it; the release puts the sheet back |

![The pill dragged down onto the bottom edge of a phone: a shallow landing pad with a solid border stands under it, its grabber filled to full width.](/img/docs/system-devtool/phone-dock-pad.png)

The pill held on the pad past `DWELL_MS`: the pad's border has turned solid
and its grabber has filled, so letting go now docks it (`data-dock-pad="armed"`).

Both rest on the same idea: *where this belongs is something you move it to*.
So neither has to be learnt on its own, and the pad appearing under a dragged
pill is what teaches the pair.

Detaching also dismisses the command palette if it is open. The palette is
usually what summoned the devtool, and asking for a pill is asking for the
page back.

The window's header keeps a dock button as well (`PanelBottom`, beside the
close, only where `canDock`), because a window is not draggable to an edge on
a touch screen without covering the screen on the way.

**Off the edge.** A pull that *stops* at the top snaps to the full detent as
always; a pull that *keeps going* detaches. The commit is
`PULL_PAST_TOP_TRAVEL` (14px) of finger travel past the top, out of the
roughly twenty pixels left above the grabber, and the shell gives a little
(`data-pull-armed`) once the release would commit, so the gesture can be seen
before it happens and eased back out of.

That threshold is small because it is measured, not chosen. Most of a pull is
spent resizing the sheet (from the 0.7 detent that is 187px on an iPhone 13),
and what is left over is the distance from the grabber to the top of the glass.
See the note beside `PULL_PAST_TOP_TRAVEL` in `systems/surface/sheet.tsx`,
which also explains why the gesture reads the pointer rather than Base UI's
published overshoot.

**Back onto it.** The pad is only up while a pill is actually in hand, and only
where there is an edge to dock to, because its only job is to be a drop
target. It stands where the sheet will, inset by the surface system's edge
gap, with the sheet's own grabber waiting at the top.

**Docking takes a hold.** A pill exists so that a floating thing can be put
anywhere, so passing over the pad (or dropping straight through it) just leaves
the pill there. Only a release after the pill has been *held* on the pad for
`DWELL_MS` (550ms) docks it. The pad is shallow for the same reason
(`PAD_HEIGHT`, 84px, about a tenth of a phone screen): a target that swallows
the bottom quarter takes the bottom quarter away from the pill.

The wait is drawn, not hidden: the grabber fills to full width over exactly
the dwell, on the clock that is actually running, and gives it back if the
pill leaves early. `data-dock-pad` carries the three states (`idle`, `over`,
`armed`); no CSS reads it, it is a handle for tests and for eyes.

Docking makes the pill *forget* where it was dragged
(`forgetPosition`, `systems/draggable`): the spot it was released over is a
target, not a seat, so the next time the devtool comes off the edge it comes
back to its corner rather than to the mouth of the dock.

### Non-modal, and stacked

The panel never takes the page away, because the devtool exists to watch the
page react while wallpaper, glass and sky are turned. The page underneath stays
scrollable and clickable, and a press on it belongs to the page; the close
button, `D`, Escape and a downward drag dismiss.

Because it is a surface, a picker opened from it (the Wallpaper module's
current-picture row opens the wallpaper picker) **stacks** on it, three deep
from the palette: palette → devtool → picker, each one stepping back as the
next rises. On a desktop the windows simply coexist, the picker on top. While
the About is up the devtool rides over it (`DEVTOOL_OVER_ABOUT_Z`), so the
Glow module's knobs can be turned with the ring on screen.

### Composability

The devtool is hosted in three different shells over its life, so nothing about
where it is lives in the modules. `panel.tsx` exports `DevtoolModules`,
`DevtoolTitle`, `DevtoolRail`, `DevtoolSections` and `DevtoolFooter` (content
that does not know its container), and `dock.tsx` puts them in whichever shell
is up, wrapped in the shared `<SurfaceBody>` (title, `toolbar` = the rail,
`footer` = `Press D to toggle` · `Disable Devtool`) so all three look like
every other surface on the site.

This is why the surface system has a **primitive layer** under
`<AdaptiveSurface>` (see [Surface System](./system-surface.md)).
`<AdaptiveSurface>` encodes one rule: *the viewport picks the shape*. That
rule does not apply to the devtool, whose shape the developer chooses with a
gesture. So the devtool composes `<SurfaceSheet>` and `<SurfaceWindow>`
directly, the way the command palette already does for its search-field header.

Switching shells remounts the modules, since the shells portal to different
places. Anything that must survive the move belongs in the provider or in
`localStorage`, which is where the folds and every saved setting already are.
A module's own local state (the scroll position, the Sky module's Tune and
Motion folds, a Play in progress) does not survive.

### Dragging

One draggable instance, `devtool`, because the pill and the window are two
sizes of one object. They share the top-right anchor, so the window opens
where the pill was and the pill lands where the window was left. The instance
persists (`hux_drag_devtool`), and each mounts reading back the other's
position. (Turn `persist` off in the Draggable module and that hand-off stops;
the two then keep their own offsets until the next reload.)

Both use `useDraggable` directly rather than the `withDraggable` HOC: the pill
needs its own drag handlers to know when it is over the pad, which is exactly
what the HOC exists not to expose.

The pill is its own handle; the window drags by its header. The module bodies
are never handles, so range inputs, text fields and scrolling keep working.
On a phone the sheet's grabber replaces dragging entirely.

### Getting in and out

| Way in | What it does |
|--------|--------------|
| `D` | Toggles the panel, once the devtool is on. Docked: sheet ⇄ nothing. Floating: window ⇄ pill. |
| ⌘K: the "Debug Panel: On / Off" row (`d` in slash mode) | The on/off switch (see below). |
| Hold the search button | Summons it. Undocumented. |
| The pill | Only there when floating. |

`D` is ignored while focus is in an input, a textarea or anything
contenteditable, while the command palette is open, and with ⌘, Ctrl or Alt
held (`DevtoolProvider`'s keydown listener).

**On and off are about what is on screen**, which is not the same as
`isEnabled`, and the two dockings answer it differently:

| | What "on" means | Off does |
|---|---|---|
| floating | `isEnabled`: the pill stands by, so it is on screen | disables; pill and window go |
| docked | `isOpen`: there is no pill, so the drawer has to actually be up | closes the drawer |

That is `isShowing` / `toggleShowing` on the provider, and the palette row
(`debug-panel` in `systems/command/actions.tsx`) just reports it. Read
`isEnabled` there instead and, after swiping the drawer away, the row says
`On` with nothing on screen, and turning it back on takes two presses.
**Swiping the drawer down is off**, and one press brings it back.

Off in the docked case closes without disabling on purpose: `isEnabled` is also
what keeps the session overrides live (`systems/ambient/provider.tsx`,
`components/ui/hero-exit.ts`), and putting a panel away is not throwing its
state away. To actually disable from a phone, use the footer's "Disable
Devtool".

`isFloating` and `canDock` live on the provider rather than in `dock.tsx`,
because this switch needs the same answer the shape does, and two places
deciding it is two places to drift apart.

The row's `kind` follows what the press will do. On opens a surface, so the
palette stays behind it as a stack; off opens nothing, so it leaves like any
other setting.

**The hidden one.** Holding the search button (either shape: the homepage
search bar or the round FAB) for `DEVTOOL_HOLD_MS` (1.2s) summons the devtool.
The press that carried it does not also open the palette, and a slide of more
than `HOLD_SLOP_PX` (10px) is a drag or a scroll and cancels it.

The hold can be short because progress is shown. Nothing shows for the first
`DEVTOOL_HOLD_REVEAL_MS` (700ms), which is past any tap, so an ordinary press
never sees it and the entrance stays hidden. Then a ring (`HoldRing`) closes
from 1.3× onto the button's own edge, arriving exactly as the hold completes.
The feedback is what makes the shorter hold safe: an accidental hold announces
itself in time to let go.

The ring is drawn **outside** the button, at a measured `fixed` rect rather
than inside it: a finger is on the button, so anything drawn there (a
swapped icon, a fill) is under the fingertip and invisible. Both shapes of
the button share a 24px radius (`FAB_RADIUS`), so one ring fits both. See
`systems/command/fab.tsx`.

### Session overrides and saved settings

Every row writes one of two kinds of value, and its star (`PanelStar`, with
`source`) says which. The difference is the whole point of the colour: an
amber star is an experiment that ends with the tab, a blue one is a choice
this browser keeps.

![Session overrides (amber) live in provider useState, are gone on reload and are read only while isEnabled; saved settings (blue) live in localStorage, survive reload and apply with the devtool off. Row stars sum into the module's star (strongest wins) and its rail chip; a session star pulls the module open, a saved one does not. The devtool's own state (enabled, docking, folds, drag positions) carries no star.](/img/docs/system-devtool/overrides-vs-settings.svg)

- **Session overrides** (amber) are React state in a provider:
  `devtoolOverrides` on `useWallpaper` (Full, Widget, Soft edge, Bezel,
  Scroll, No WebGL2), `debugOverride` and `sceneOverrides` on `useWeather`
  (the forced condition and Tune), `timeScrubMinutes` / `dayOffset` on
  `useAmbientTime` (time travel), and `heroExitOverride` on `useDevtool`. They
  are gone on reload, and their readers ignore them unless `isEnabled`, so
  disabling the devtool puts the real site back at once. The bezel and
  soft-edge overrides are also dropped when the wallpaper family changes
  (they are stamped with `edgeFamily`).
- **Saved settings** (blue) write the same store the rest of the site reads,
  so they apply with the devtool off and the picker or ⌘K shows the same
  value. Most live in their own system's key (`hux_ambient_settings`,
  `hux_theme`, `hux_glass_tint`, `hux_reading_*`, `hux_ask_config`,
  `hux_voice_model`, `hux_glow_v2`, `hux_music_mock`…); the ones that only the
  devtool sets live in `hux_devtool` (Phone palette, Home weather, the Works
  rows, draggable config).
- A row's star is a button: pressing it puts that row back. A module title's
  star sums its rows (`strongest`: any session star makes it amber), and where
  the module passes `onReset` (Ask, Voice, Glow) the title's star resets the
  whole module.

### Folding and the rail

The panel has more modules than fit on a screen, so what is open is decided
rather than hard-coded. Every module passes its `<DebugSection>` two things
only it knows:

- **`relevant`**: does it matter here and now? Relevant modules start open,
  the rest start folded. The order never changes, so nothing moves under your
  hand; what does not matter just waits folded.

  | Module | Relevant when |
  |---|---|
  | Frontmatter, Reading | the page is a post (`pageMeta` is set) |
  | Works | on `/works` |
  | Wallpaper, Sky | on home (the wallpaper is the page), or something is overridden for the session |
  | Glass | on home |
  | Music | a track is playing or paused, or the mock is on |
  | Command | on a phone (`canDock`), since its one setting is the phone palette |
  | Ask | Ask has been called on this page (`askStarted`) |
  | Voice | always |
  | Glow | the About is open (and the panel scrolls to it) |
  | Draggable | never; it is tooling, not what a page is about |
  | Windows | a window is open |

  A *session* override pulls a module open (you are in the middle of
  something); a *saved* setting off its default does not (it is a
  preference, and it would hold the module open everywhere, for good).

- **`star`**: is anything inside off its default? See above. It sits beside
  the title, so a folded module still says "look in here".

Every folded header also carries a one-line status in its `action` slot
(`sans · M/M`, `weather · gl`, `sheet`, `5/7`, the window count…), so folded
is not blind.

**Folds by hand are remembered per relevance.** A header click saves the fold
under `id:relevant` or `id:idle` (`sectionFoldKey`), so "Frontmatter open on
a post" and "Frontmatter out of the way elsewhere" are two answers, not one
that the last page wins. Folds saved under a bare id (before relevance) are
dropped on load rather than guessed into a context.

**The rail** is the index: one icon per module in `MODULE_ORDER`, a dot under
the relevant ones, the module's star, a filled chip when it is open.

- **Tap**: open that module, fold every other, scroll to it. Tap it again to
  give the folds back to relevance and your own choices.
- **Shift-tap** (or ⌘ / Ctrl / Alt): open it without folding anything else.

The rail's folds are for getting around, not for keeping: they win over the
saved ones while they stand, are never written to storage, and a new route
starts without them. A header click on a module takes back the rail's fold
for it and saves yours.

Modules report themselves to the rail through `<DevtoolSections>`, which
wraps the shell's whole body (rail and modules) in `dock.tsx`; the modules
stay the only place that knows their own state.

## The modules

In `MODULE_ORDER`, which is the rail's order and the list's. (S) marks a
session override, everything else that writes is saved.

1. **Frontmatter**: the current post's frontmatter as published by
   `<DevtoolPageMeta>` (`app/writing/[slug]/[lang]/page.tsx`): slug, the
   rendered locale, the post's language scope, then every field in authored
   order, with a Copy JSON button. Read-only.
2. **Reading**: the article reading surface: Typeface (Sans / Serif), Size and
   Measure (S / M / L), Media bleed, Focus mode, Ruler dock (Left / Right).
   The same settings the post's own "Aa" sheet writes
   (`components/post/reading-settings.ts`, `ruler-settings.ts`).
3. **Works**: how `/works` draws a chapter's ref (`worksRef`: Auto, Stub,
   Ring, Row, Under, Hash; Auto is Hash on a desk and Under on a phone), and
   two layouts on trial, the Projects shelf and the Feed view, both off by
   default.
4. **Wallpaper**: the whole background system. It opens on a `Now:` line
   saying what is painting (`Weather · Sky · light · full @1.00`, or
   `Sonoma · dark · desktop @0.62` for a picture, where the last field says
   desktop or reading surface; then the veil and `blur` when they apply).
   Then a Weather / Image switch; under Weather, **Style** (Sky / Gradient /
   Classic, the same three tiles the picker shows) and **No WebGL2** (S: it
   pretends WebGL2 is missing so the Sky's fallback can be seen; style and
   engine are otherwise one-to-one, so there is no engine picker). One row
   shows the current picture (and its resolution) and opens the picker over
   the panel: choosing among the catalog is the picker's job. Then Full,
   Widget and Soft edge (S), the Bezel switch (S) and, while it is on, its
   Tint (Black / Dark / Theme / Custom, with a colour well), Band and Radius;
   Scroll (S: Window / Container) and Hero exit (S: Scroll / Fade; the
   platform default is `defaultHeroExit`); then the reading treatment, Reading
   blur (images only) and Reading dim. The last line is the resolved asset
   path for a picture, or the live engine for the weather: `GL · 1266×791 ·
   0.88× · 6.4ms` (internal resolution, adaptive scale, frame time), or
   `CSS · Gradient` with a note when the Sky had to fall back.
   Full and Widget are *independent* switches, not two halves of one control:
   the persisted setting can only be one of them, but the panel exists to see
   combinations the setting cannot express.
5. **Glass**: Material (Tinted (色调) / Clear (透明)) and Tint (Neutral /
   Wallpaper), then a one-line readout of what the legibility policy resolved
   for the wallpaper that is painting (`ink` / `flip` / `flip·mid`, `busy`,
   `relief`, `+ink%`, `glass +%`, and `lab` when the lab's numbers are live),
   which links to the Legibility Lab (`/lab/legibility`), where every one of
   those numbers is a slider. See `docs/system-legibility.md`.
6. **Sky**: weather and time as one thing, because the wallpaper is a function
   of both. Top to bottom: a status line (condition · phase · clock, sun
   elevation, moon illumination); **Home weather** (Widget / Line: the grid
   card, or one line over the greeting); a day timeline (S) painted with the
   sky's colours for the current condition, sunrise and sunset ticked, a
   draggable playhead and ▶ play, phase names under it that jump the clock;
   **Follow the Sun** (the Appearance itself; off is Follow the System); the
   six conditions (S), previewed at the effective hour, click again to return
   to live; the date slider (S) that moves the moon; **Gyro**; **Window** (the
   sky window, with Heading and Pitch sliders (S) that aim it where there is
   no sensor) and a folded **Motion** readout of the sensor's own numbers;
   **Located by** (place · provider · age, `tz≠` when the IP's offset
   disagrees with the device clock); **Refetch** (Location / Weather; Weather
   refetches both); and a folded **Tune** (S). **Now** resets the clock, the
   day, the condition and Tune; the saved rows keep their blue stars.

   Play is two buttons, ▶ **Day** (the day in a minute) and ▶ **2×** (in half
   of one). Either runs the playhead from where it stands, through midnight
   and round again; pressing the lit one pauses, pressing the other changes
   speed without starting over. The live condition's chip wears a green dot,
   and every chip shows its night face while the sun is down at the clock.
   Tune's sliders are cloud, precipitation, wind speed, wind direction and
   veil, with the raw forecast under them (WMO code, cover, mm/h, wind, the
   sun's elevation · azimuth, and the API's own day / night).

   The Gyro row is the tilt that makes the Sky's rain and snow fall along real
   gravity (`docs/ambient-sky.md` → Gyroscope tilt), with the live angle as
   its readout. On iOS it is also the second place besides the wallpaper
   picker where motion access can be granted, since that needs a tap to ask.

   **The meteor's window is marked on both axes it depends on**, because the
   rule has two halves and each one has a surface here that answers it alone:

   - **When**: a bar along the foot of the day timeline, ticked at each end,
     in the same ink as the sunrise and sunset marks it sits between; the times
     read out under it beside them. A window crosses midnight, so it arrives as
     two bars, one against each end of the strip, and reads as one range
     (`19:40 → 05:21`), which `meteorWindowSpan()` rejoins next to the code that
     split them. Derived by asking `meteorPossible()` about real scenes rather
     than by solving for the sun's altitude, so the marks cannot drift from the
     click that fires one. It also costs one scene rather than three hundred
     whenever the sky is closed, because `clarity` cannot change over a day.
   - **Through what**: a corner mark on every condition chip you could see a
     meteor through. It answers *if I picked this one now, could I see one?*,
     so it is evaluated **through `toSceneWeather`**. That is the one function
     that knows what forcing a condition means: the real measurements go away,
     because a measured cover of 10% is a fact about today's clear sky and not
     about the overcast being previewed. Predicting any other way makes
     the mark promise something the click does not deliver. Overrides are
     included too: force **Cloudy** and the mark goes out (the
     profile's cover is 0.7), pull **Tune → Cloud** down to 20% and it comes
     back. While that override stands it moves Clear with it, because a
     clear sky under 70% forced cloud really has no meteor in it. Only the
     weather half of the rule, though: a chip that also went dark at noon would
     be answering the timeline's question badly, so it does not.

   See `docs/ambient-easter-eggs.md` → The shooting star for the two terms and why
   twelve degrees.
7. **Music**: the player's state, track and playlist position, and the **Mock
   player** switch (`hux_music_mock`): an offline fixture drives the whole
   music system with no YouTube, swapped in place without a reload.
8. **Command**: the **Phone palette** switch, Sheet (the bottom sheet the
   palette is on a phone) / Popover (the desktop card at phone width, the
   palette as it was). Lets the two be compared on the same device; the
   popover code path is kept whole for it.
9. **Ask**: how Ask behaves (`systems/ask/lib/config.ts`). A **Preset** row
   picks the platform shown, Desk or Phone, starting on the one this viewport
   is (named in the header); under it every setting for that platform: where
   Ask opens from search and from a call, on reading pages, the place
   buttons, dragging, minimize (into the Dock, or off), the pill while a reply
   is written, and the voice glow's two waits. Then the visitor's model and
   thinking level. Each row's blue `*` resets it to its preset (or default);
   the title's resets the lot. See `docs/system-ask.md` → Settings, and a
   preset per platform.
10. **Voice**: the transcription model (Browser, or a Gateway model with its
    price) and the recording visual (Glow / Waveform), shared by the palette
    and Ask. It checks `/api/voice` and says when the Gateway is unavailable
    and the browser's recognition is used instead.
11. **Glow**: the light's volume (`systems/glow`): Colours (Siri, or the
    wallpaper's dominant colour by a colour-wheel rule) with the live
    palette's swatches, site-wide Strength, and the About ring's motion,
    strength, desk and phone depth and baseline. A Show / Hide About button
    brings the ring up to judge it.
12. **Draggable**: one row per entry in `DRAGGABLE_INSTANCES`, each with a
    persist toggle (the brain) and a drag switch; a blue `*` where either is
    off its `DRAGGABLE_DEFAULTS` entry. The instances: `devtool` (drag,
    persist), `command-fab` (no drag, persist pre-armed), `command-palette`
    (drag, back to centre each open), the windows of `surface-wallpaper`,
    `surface-playlist`, `surface-theater-playlist` (drag, back to centre), and
    `surface-attachments` (listed, but with no defaults entry, so off).
13. **Windows**: the open app windows, front-most first, with focused /
    minimized, runtime and flavor, source (web / built-in / online), size
    preset, reload count, rect, and the bundle or page URL. Inspection only:
    apps launch, and bundles load by URL, from ⌘K. The header shows how many
    are open.

## Constraints

- **Session overrides are read through `isEnabled`.** Every reader of one
  checks it (`systems/ambient/provider.tsx`, `useHeroExit`). A new override
  that skips the check keeps changing the site after "Disable Devtool", for a
  visitor who cannot see why.
- **The star's `source` must match where the value lives.** Amber promises
  it is gone on reload, blue that it stays. A saved value marked amber is a
  setting that silently outlives the experiment.
- **`MODULE_ORDER` is kept in step with `DevtoolModules`.** The rail reads
  its order from the former and only lists ids it knows; a module rendered
  but missing from it never reaches the rail.
- **Modules know nothing about their shell.** Three shells host them, and
  switching remounts them; state that must survive goes in the provider or
  storage.
- **Module bodies are never drag handles**, or sliders and scrolling stop
  working in the window.
- **A draggable thing needs both entries.** `DRAGGABLE_INSTANCES` puts it in
  the Draggable module; `DRAGGABLE_DEFAULTS` gives it its posture. Without the
  defaults entry it falls back to not draggable, not persisted.
- **Off docked closes, never disables**, or the overrides die with a swipe.

## What is free to choose

- Which module a knob lives in, its row order, and its labels.
- The folded status line of each module.
- What makes a module `relevant`, as long as a saved setting alone never
  makes it so.
- Whether a module title's star resets the whole module (`onReset`).

## Recipes

**Adding a module.** Write `function XModule()` in `panel.tsx` around a
`<DebugSection id title icon relevant star action>`; add it to
`DevtoolModules` and its id to `MODULE_ORDER` at the same place; build rows
from `PanelRow` + `PanelToggle` / `PanelSegmented` / `PanelSlider`, with a
`PanelStar` when the value is off its default; sum the row stars into the
section's `star` (`strongest`).

**Adding a saved setting only the devtool sets.** A field on
`DevtoolSettings` with its default in `SETTINGS_DEFAULTS`, validated in
`getDevtoolSettings`, set in the load effect, and a setter that calls
`setDevtoolSettings`; expose it on the context. Read it elsewhere through
`useOptionalDevtool()` with the default as the fallback, so a page outside
the provider still renders.

**Adding a session override.** `useState` in the provider that owns the
value, read as `isEnabled ? override : undefined`, an amber `PanelStar` that
clears it, and a `relevant` that includes "something is overridden".

**Making a surface's window draggable.** Give it an `id`, then add the id to
both `DRAGGABLE_DEFAULTS` (usually `{ draggable: true, persist: false }`) and
`DRAGGABLE_INSTANCES` (with an English and a Chinese label) in
`systems/devtool/provider.tsx`.

## Reference

### useDevtool

```typescript
const {
  isEnabled,        // Whether devtool is enabled at all (persisted)
  isOpen,           // Whether the modules are showing
  canDock,          // Does this viewport have an edge worth docking to?
  isFloating,       // detached || !canDock: the shape-deciding one
  isShowing,        // Is any of it on screen? (see "Getting in and out")
  toggleShowing,    // The palette's On / Off switch
  toggle,           // Toggle the panel (D)
  open,
  summon,           // Enable if needed, then open (palette and hold)
  close,
  detach,           // Lift off the edge; collapses to the pill
  dock,             // Back onto the edge; reopens as the sheet
  toggleEnabled,    // The footer's Disable Devtool
  setEnabled,
  getDraggableConfig, setDraggableConfig,   // per-instance drag / persist
  pageMeta, setPageMeta,                    // the Frontmatter module's source
  phonePalette, homeWeather, worksRef, worksShelf, worksFeed,  // + setters
  heroExitOverride, setHeroExitOverride,    // a session override
} = useDevtool();

// Outside the provider (page content), never throws:
const devtool = useOptionalDevtool();
```

The stored `isDetached` is not on the context; read `isFloating`.

### Controls

Rows are `PanelRow` (label left, control right, or `stacked` under it) with a
`PanelStar` when a value is not at its default; switches are `PanelToggle`;
choices are `PanelSegmented`; numbers are the shared `Slider` from
`components/ui/slider.tsx` (via `PanelRange` / `PanelSlider`), the same one
the labs use: an ink track with the platform's native thumb on touch. Only the
Sky timeline's playhead is its own range input. The Draggable module's rows
predate these and draw their own switch.

### Driving the overrides from code

Force a condition. Day/night is never part of it. The clock decides, so a
forced condition can't put a moon in a daytime sky:

```typescript
const { setDebugOverride, setSceneOverrides } = useWeather();

setDebugOverride({ condition: "rain" }); // null → back to the real weather
setSceneOverrides({ precipitationIntensity: 1 }); // heavy
```

There is no phase override; there is one clock, and moving it moves the sun,
the moon, the sky, the phase, the greeting and the sun-event notice together:

```typescript
const { setTimeScrubMinutes, setDayOffset, resetTimeTravel } = useAmbientTime();

setTimeScrubMinutes(22 * 60); // 22:00 today
setDayOffset(11);             // eleven days on, a different moon
resetTimeTravel();            // back to now
```

The wallpaper's kind and style are the real (saved) settings, so the panel and
the picker can never disagree:

```typescript
const { setKind, selectWallpaper, selectWeather } = useWallpaper();

setKind("image");            // Swap the background kind, crossfaded
selectWallpaper("monterey"); // Hot-swap the pair, no reload
selectWeather("classic");    // Back to weather, the original palettes
```

### Persistence

- **`hux_devtool`**: `fabEnabled` (off by default in every environment,
  development included), `detached`, `collapsed` (the hand-set folds),
  `draggable`, and the devtool-only settings (`phonePalette`, `homeWeather`,
  `worksRef`, `worksShelf`, `worksFeed`).
- **`hux_drag_<id>`**: a draggable instance's position, while it persists.
- **Every other saved row**: its own system's key (see above).
- **Session overrides and the rail's folds**: memory only, reset on reload.

### Integration with Ambient

The devtool **depends on** the ambient system: the Wallpaper, Glass and Sky
modules read weather, location, time and wallpaper state, and write the
session overrides and settings above. The dependency also runs back:
`AmbientProvider` reads `useDevtool().isEnabled` to decide whether those
overrides count.
