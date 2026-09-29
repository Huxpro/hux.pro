# Skin — Material and Glass

The home screen's widgets can be drawn as Android draws them or as Apple
does. That choice is the **skin**: one attribute on `<html>`, like the glass
material, so nothing re-renders to change it.

| Skin | Platform | What a widget is |
|---|---|---|
| **Material** (default) | Android, Material 3 Expressive | An opaque tonal container at the system radius, coloured from the wallpaper |
| **Glass** | Apple, Liquid Glass | The translucent card the site was built with; Tinted / Clear is the knob inside it ([system-glass.md](./system-glass.md)) |

This page is the Material skin. It pairs with the Android-shaped grid
([system-widget-grid.md](./system-widget-grid.md)): the grid is how widgets
are *arranged and sized* on Android; the skin is how they *look*.

| Piece | Where |
|---|---|
| The setting (`useSkin`, `hux_skin`, `hux_skin_style`) | `services/skin.tsx` |
| Boot script, storage keys (server-safe) | `systems/skin/lib/boot.ts` |
| Dynamic color: wallpaper → scheme → roles | `systems/skin/lib/scheme.ts` |
| Publishes the palette onto `<html>` | `systems/skin/components/dynamic-color-bridge.tsx` |
| Tokens and the widget container | `app/globals.css`, "Skin — Material" |
| Expressive shapes (`Sunny`, the cookies, …) as SVG paths | `systems/skin/lib/shapes.ts`, `ExpressiveShape` |
| The resize frame (Material) and the corner (Glass) | `components/ui/resize-grip.tsx` |
| Google Sans Flex (`--font-flex`) | `app/layout.tsx` |
| The ripple (every pressable, site-wide) | `systems/skin/components/material-ripple.tsx` |
| Haptics (pickup, resize ticks, drop) | `systems/skin/lib/haptics.ts` |
| Sheets, panels, popovers, windows; switches and segmented controls | `app/globals.css`, "Skin — Material", the Surfaces and Controls blocks |

## Sources

Numbers are Material's own, not remembered:

- **Color roles** — the tone each role takes in light and dark is Compose
  Material 3's generated `ColorLightTokens` / `ColorDarkTokens`; the palettes
  themselves come from Google's `@material/material-color-utilities`, spec
  **2025** (Material 3 Expressive), the library Android's own theming uses.
- **Shape** — `ShapeTokens`: 4 / 8 / 12 / 16 / 20 / 28 / 32 / 48 and full.
- **The widget's corner** — AOSP `core/res/res/values/dimens.xml`:
  `system_app_widget_background_radius` 28dp, and
  `system_app_widget_inner_radius` 20dp for a view 8dp inside it.
- **Type** — `TypeScaleTokens` (Title Small 14/20 medium +0.1, Body Small
  12/16 +0.4, …); the face is Google Sans Flex, Expressive's brand type.
- **State layers** — `StateTokens`: hover 8%, focus 10%, pressed 10%,
  dragged 16%.
- **Motion** — `StandardMotionTokens` / `ExpressiveMotionTokens`: springs
  (damping ratio, stiffness), e.g. Expressive fast spatial 0.6 / 800.
- **Widget guidance** — developer.android.com, *Widgets → Style / Layouts /
  Sizing*: "Use Material color roles and tokens … support dynamic color";
  "Make sure the container stretches edge-to-edge at all sizes"; "a minimum
  48dp tappable button"; and for minimal-data widgets (weather, the current
  song), "try out making your whole widget an expressive shape".

## Dynamic color

What Android 12+ does with a wallpaper: one source colour becomes five tonal
palettes (primary, secondary, tertiary, neutral, neutral variant), and
components paint with **roles** drawn from them — `surface-container` under
`on-surface`, `primary-container` under `on-primary-container`. The pairing is
the contract: whatever the wallpaper and the theme, a role and its `on-` role
are legible against each other by construction.

The source is the wallpaper's dominant colour — the ambient profile's `tint`,
the same colour the glass tint and the glow harmonise with (a photograph's
measured once, the Sky's read off the live scene). It is re-seeded by the
degree, so a Sky drifting through the day shifts the palette gently rather
than every frame. A grey picture has no colour to give, so, like Android, it
falls back to Google Blue (`0xFF1B6EF3`); that baseline is also what the
stylesheet declares before the bridge has run.

`DynamicColorBridge` writes both themes at once (`--md-l-<role>`,
`--md-d-<role>`), and the stylesheet resolves `--md-<role>` per theme, so a
theme switch is a stylesheet swap, never a recompute.

**Wallpaper colors** — Android's own row under Wallpaper & style, with the
same five styles: Tonal spot (the default), Neutral, Vibrant, Expressive,
Monochrome. Monochrome is the one that sounds like the rest of this site.

## The widget container

An Android widget is not a pane over the wallpaper: it is an opaque tonal
surface. So under Material a card is `surface-container`, at the 28px system
radius, with no blur, no hairline and no picture showing through (the
wallpaper-in-the-card overlay is hidden). Hover and press are state layers of
`on-surface` at Material's 8% / 10%; keyboard focus is a 3px `secondary`
outline.

The content inside needed no edits. It paints with the site's tokens — the ink
ladder, the glass fills, `border` — and the skin re-points those tokens, scoped
to the card, at Material roles:

| Site token | Material role |
|---|---|
| `foreground` | `on-surface` |
| `muted-foreground` | `on-surface-variant` |
| `tertiary-foreground` | `on-surface-variant`, a step back |
| `quaternary-foreground` / `border` | `outline-variant` |
| `glass*` (a chip, a segmented control, a transport) | `surface-container-high` / `-highest` |
| `muted` | `on-surface` at 30%, so `hover:bg-muted/20` is the 8%… hover layer |

Everything in the card is set in Google Sans Flex; the serif (a quotation, a
post's headline) stays the site's, because it is the content's voice, not the
platform's. A widget title is Title Small in sentence case — the platform
labels things in words, not in lowercase mono — and metadata keeps its rung in
the same face with tabular figures, so dates still line up.

Google Sans Flex is not preloaded: a visitor in the Glass skin never downloads
it.

## Variants: `material:` and `m3:`

Some controls are shared — the album tabs with the theater, the music
transport with the Live Activity, a thumbnail with the playlist sheet — and
want their Material form only on the home grid. Two Tailwind variants
(`app/globals.css`) say where a class applies:

| Variant | Applies |
|---|---|
| `material:` | Anywhere in the Material skin (the app icon's mask, the folder) |
| `m3:` | Only inside a widget card in the Material skin |

Where a widget's *structure* differs by skin (the weather readout), both
forms are in the tree and the variant hides one. Nothing reads the skin in
React, so a returning visitor gets the right form on the first frame with no
second render.

## The widgets

Each widget's Material form, and the platform idea behind it:

| Widget | Material form |
|---|---|
| **Weather** | The condition glyph on an **Expressive shape** in `primary-container`, the shape chosen by the weather — `Sunny` for a clear day, a 12-sided cookie for cloud or a clear night, a 9-sided one for rain, a flower for snow, a burst for thunder — and the temperature as the one big number, Display Medium (45/52) in Google Sans Flex with `ROND` at 100. Android: for a widget that shows one thing, "try out making your whole widget an expressive shape". Two wide, the sun's arc and its dot take `primary`. |
| **Music** | Android's media controls: no capsule, icon buttons for the neighbours, and play / pause as the one filled button in `primary`. Its **shape is its state** — round while paused, a rounded square while playing, tighter still under the finger — on the Expressive fast-spatial spring, overshoot included. The playlist toggle, when on, is a tonal `secondary-container` button. Art at 16px corners. |
| **Talks** | The album switch is a **connected button group** (Expressive's replacement for segmented buttons): separate buttons 2dp apart, small inner corners, round outer ends; the selected one tonal and fully round — the shape is the selection, so the sliding pill is gone. Thumbnails at 16px. |
| **Prompts** | A tonal card: `primary-container`, the one widget that is a single thing wearing the accent container, the way a home screen mixes them among the surfaces. (`tertiary-container` was tried: in the 2025 dark scheme it is a bright lilac that glares on a night home screen.) |
| **Writing / Projects** | List rows with 12px state-layer corners; dates and the `featured` marker capitalised ("Jul 2020"); run headings ("Latest", "Up next") as a Label in `primary` rather than the serif voice. |
| **App folder** | Circular icons — Pixel Launcher's default adaptive-icon mask — labels in Google Sans Flex, and the folder, when shown, a tonal container at the widget radius. |

| **Search bar** | The command bar at the bottom of the home screen is what sits there on Android: the search bar, itself a widget — an opaque `surface-container-high` pill at elevation 1, Google Sans Flex, the grid's state layers, and a round shortcut chip. Other pages keep their round ⌘K button. |

`WidgetShell` takes a `tone` (`primary` / `secondary` / `tertiary`) for the
accent containers; the Glass skin ignores it.

## Surfaces

Every sheet, side panel, popover and window is the system's own UI, so under
Material it is drawn the way Android draws its own: an opaque tonal
container, no glass. `SHELL` (systems/surface/sheet.tsx) carries a
`surface-shell` class, and the skin re-points the site's tokens on it exactly
as it does on a widget card — the content inside needed no edits. The `m3:`
variant applies inside a surface too, so the album tabs, the transport and
the thumbnails take their Material form in the playlist or the wallpaper
picker as they do on the home screen.

| Surface | Material form (Compose tokens) |
|---|---|
| **Bottom sheet** | `SheetBottomTokens`: `surface-container-low`, 28dp top corners and square bottom ones, docked to the bottom edge and at most 640dp wide, a 32×4 drag handle in `on-surface-variant` at 40% 22dp from the top. The detent machinery is untouched; only the gap it keeps around a floating sheet goes to zero. |
| **Scrim** | A modal surface dims the page: black at 32%, fading in on the emphasized-decelerate curve (and in from nothing on its first frame, `@starting-style`), out on emphasized-accelerate. Only while the popup is open, so a kept-mounted sheet's closed viewport shades nothing. |
| **Side panel** | A detached side sheet: `surface-container-low`, 28dp. |
| **Popover** | A menu: `surface-container`, 16dp, elevation 2. |
| **Window** | A dialog: `surface-container-high`, 28dp, elevation 3. |
| **Title** | Title Large (22/28, regular), `on-surface`, sentence case. The close button is a round icon button. |

Type inside a surface is Google Sans Flex, the site's mono readouts
included (with tabular figures); `code`, `kbd` and `pre` keep the code face,
captured on `<body>` as `--font-code` before a skin re-points `--font-mono`.

**System UI** beyond the surfaces:

| Element | Material form |
|---|---|
| **Command palette** | M3's search view (`SearchViewTokens`). Docked on a desktop: `surface-container-high` at 28dp, elevation 3. On a phone it is the bottom sheet in the same container. The header is a 56dp row with the 24dp search icon in `on-surface`, the query in Body Large, and a divider in `outline`. Results are list items (56dp, Body Large, a 24dp leading icon in `on-surface-variant`); hover and the keyboard highlight are state layers, and each section is headed like a settings group. The app strip keeps its tiles. |
| **Toasts** | Snackbars (`SnackbarTokens`): `inverse-surface` under `inverse-on-surface`, Body Medium, 4dp corners, elevation 3. Actions are text buttons in `inverse-primary`. A snackbar arrives as Compose's does, fading in as it grows from 80% on the emphasized-decelerate curve. |
| **Dock** | The status bar. A Live Activity's pill (and a minimized window's) is a status chip: a flat 32dp `secondary-container` pill in Label Large. Opened, the activity is a notification card in `surface-container` at 28dp, with the media controls in their Material form. |

**Controls** (`components/ui/controls.tsx`), wherever they are:

| Control | Material form |
|---|---|
| `Switch` | M3's switch: a 52×32 track with a 2dp `outline`; the handle 16dp in `outline` when off, 24dp in `on-primary` on a `primary` track when on, 28dp under the finger — moving on the Expressive fast spatial spring. |
| `Segmented` (`system` / `reader`) | Expressive's connected button group, like the album tabs. The `bare` toolbar tone is left alone. |
| A settings heading (the wallpaper picker's) | Android Settings' category header: Title Small in `primary`. |

**The page.** Selection is `primary` at 40% (Compose's
`TextSelectionColors`) and the caret `primary`; keyboard focus is a 3dp
`secondary` outline 2dp outside the shape, except on text fields (the caret
says it) and on surfaces that take focus only to hold it; scrollbars are
thin, in `on-surface-variant`. The focus and scrollbar rules sit in the base
layer, so a component that draws its own indicator or hides its scrollbar
still wins.

## Touch: the ripple and the motor

**The ripple.** Anywhere in the Material skin, pressing a pressable thing
draws Compose's ripple rather than the iOS wash: a circle of the element's
content colour at the pressed state layer's 10%, born under the finger,
growing and drifting to the centre until it covers the element, fading once
the press is over. Compose's numbers (`RippleAnimation`):

| | |
|---|---|
| Start radius | 30% of the longer side |
| End radius | half the diagonal + 10dp, so the corners fill as fast as the middle |
| Radius | 225ms, FastOutSlowIn |
| Centre | 225ms, linear, touch point → centre |
| Fade in / out | 75ms / 150ms, linear; the fade never starts before the wave is grown, so a quick tap still draws all of it |
| Touch delay | 100ms (`ViewConfiguration` tap timeout): a press that becomes a scroll never flashes |

The colour is the content's (`color`, or a card's `--md-on-container`), at
full opacity: Compose replaces the alpha rather than multiplying it. A key
press (Enter / Space on a focused control) ripples from the centre; with
reduced motion the layer appears flat, as Android's does with animations
removed.

It is one delegated listener (`MaterialRipple`, mounted in the providers):
the target is the innermost `button`, link, `role=` control or
`.widget-surface` card under the pointer, and the wave is drawn in a layer on
`<body>` that follows that element's box and corner radius every frame —
nothing is inserted into React's tree, no component opts in. The layer drops
the moment the element is no longer what the finger is on (a sheet the tap
opened covers it, it unmounts, the grid enters edit mode), so a wave never
paints over what the tap opened. Not rippled: inline text links (Compose's
link text has no indication), screen-sized surfaces, anything disabled, the
grid while editing, and `data-no-ripple` (the launcher's app icons — Pixel
never draws one there).

The Glass skin keeps its wash; the widget card's `:active` overlay is held
clear under Material so the ripple is the only press.

**Haptics.** Launcher3 answers a widget's pickup with `LONG_PRESS`, each cell
a resize crosses with a tick, and the drop with a confirm; `haptic()` plays
those as short `navigator.vibrate` pulses (12 / 4 / 8ms — clicks, not
buzzes). Material skin, touch devices only; nothing where the platform has
no motor.

## Triggers

| Surface | How |
|---|---|
| Command palette | `Skin: Material` (⌘K), or `/` then `K` |
| DevTool | Skin module — Material / Glass, the Wallpaper colors style, and the palette in force as swatches |
| Code | `useSkin()` → `{ skin, setSkin, toggle, schemeStyle, setSchemeStyle }` |

## Edit mode

Android's launcher does not jiggle. It says "editing" on the widget being
worked on, and moves things on springs. So under Material:

| | Glass (iOS) | Material (Android) |
|---|---|---|
| Edit mode reads as | every card jiggling | nothing moves; the widget being worked on is framed |
| Resize | a corner on every resizable card | **the resize frame**: the selected widget outlined in `primary`, a round handle on each edge it can be dragged along; each handle moves one axis |
| Which widget | — | the last one lifted, held, or tapped while editing |
| Drop target | a dashed outline | the footprint as a soft filled shape at the widget radius |
| Lift | 1.05 and a glow | Expressive fast-spatial spring (its overshoot as the card leaves the grid), 1.04, an elevation shadow |
| Reflow | a 240ms tween | Expressive default-spatial spring (ζ 0.8, k 380 → Framer damping 2ζ√k) |
| Done / Reset | glass pill / mono text | a filled `primary` button / a `primary` text button, Label Large |

Two handles, not Android's four. A widget's cell is derived from the order
([system-widget-grid.md](./system-widget-grid.md)), so a left or top handle
could change a widget's size but never put its edge where the finger is — a
handle that lies about where the edge will land is worse than none. Right
and bottom are the edges the grid grows toward.

Both affordances are in the tree and the stylesheet picks one (`material:`);
the only thing the grid reads from the skin in React is which spring Framer
should use.
