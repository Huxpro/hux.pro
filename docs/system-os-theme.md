# OS Theme — Hux and Android

The site can be drawn as two platforms. That choice is the **theme**. It is
one attribute on `<html>`, so nothing re-renders to change it. It is not the
**appearance** (light / dark, `services/theme.tsx`): each theme has both.

| Theme | Platform | What it is |
|---|---|---|
| **Hux** | Apple | The site as built: Liquid Glass surfaces (Tinted / Clear, [system-glass.md](./system-glass.md)), the mono and serif voice, iOS's press wash and jiggle mode |
| **Android** (default) | Android, Material 3 Expressive | Opaque tonal surfaces coloured from the wallpaper, Google Sans Flex, Compose's ripple, the resize frame, springs, the container transform |

**Triggers.**

| Surface | How |
|---|---|
| Command palette | `Theme: Hux` / `Theme: Android` (⌘K), or `/` then `K` |
| DevTool | The Theme module offers Hux / Android. Under Android it also has the Wallpaper colors style and the palette in force, as swatches |
| Wallpaper picker | Android only: Wallpaper colors, Basic colors, Style |
| Code | `useOsTheme()` → `{ theme, meta, setTheme, toggle, schemeStyle, setSchemeStyle, seed, setSeed }` |

A theme change is committed as a single view-transition crossfade of the
whole page. The attribute flips inside the transition's callback, so the old
theme fades into the new one instead of each surface restyling on its own
clock.

## Architecture

The layering follows [ryOS](https://github.com/ryokun6/ryos)
(`src/themes`, `docs/3.3.1-theme-architecture.md`). A theme is data, the
visual values live in CSS, and code branches on a theme's metadata, never on
its name. There are four layers, outermost first:

| Layer | Where | What it holds |
|---|---|---|
| **1. Registry** | `systems/os/themes/` (`hux.ts`, `android.ts`, `index.ts`) | One typed object per theme: its label and its `ThemeMetadata` (`pressFeedback`, `editMode`, `layoutMotion`, `haptics`, `dynamicColor`, `openPage`, `materialSetting`). No colours here. |
| **2. Root** | `systems/os/lib/boot.ts`, `lib/root.ts` | `data-os-theme` and `data-os-platform` on `<html>`. `OS_THEME_BOOT` sets them before first paint, built from the registry. After that, `applyRootOsTheme` is the only writer, and `currentOsTheme()` / `currentThemeMetadata()` read them back for code outside React. |
| **3a. Foundation** | Hux: `app/globals.css` (the token inputs). Android: `app/themes/android/foundation.css` | The site's tokens form a ladder. A few **inputs** feed it: the ink (`--ink`), the grounds (`--background`, `--card`, `--popover`), the glass fills, `--radius`, the elevation (`--elevation-*`) and the type roles (`--font-sans`, `--font-mono`, `--font-serif`). Every colour a component paints with is **derived** from those inputs, and every utility resolves to a token. A theme changes the whole site by feeding its values into the inputs, at the root and on `<body>`. That is how the Android theme reaches every page, including components it never names. |
| **3b. Roles** | Hux: `app/globals.css`. Android: `app/themes/android/*.css` | The Android theme also adds what no token can express: geometry, structure and a role's container (a widget card, the bottom sheet, the FAB). It is an **overlay** that only adds rules. Every rule is scoped to `:root[data-os-theme="<id>"]`, so removing the attribute fully reverts it. Small per-element differences use the variants `android:`, `hux:` (Hux, or no theme set) and `m3:` (inside a Material container). |
| **4. Structure** | `systems/os/components/themed.tsx` | Used where the DOM itself differs, for example a spinner that is a ring in one theme and a morphing shape in the other. `<Themed hux={…} android={…} />` renders both forms, and the stylesheet shows one through `display: contents` wrappers. That means no second render and no hydration mismatch. |

**Why the foundation layer exists.** The first version of the Android
theme re-pointed tokens inside a list of hooks: the widget card, the sheet
shell, the snackbar. That list was the home screen and its surfaces, so
every other page (a post, /works, /docs, a toolbar) stayed Hux. The site's
foundation was already unified: about 1,400 token uses, a derived ladder,
and typography roles. The theme had simply entered it at the wrong level,
overriding *derived* tokens locally instead of *inputs* globally. Three
places in the foundation also had values no theme could reach, and have
been fixed:

- the type roles were next/font's own variables, so re-pointing
  `--font-mono` also lost the code face (the faces now load as
  `--font-inter` / `--font-jetbrains`, and the roles point at them;
  `--font-code` keeps code in JetBrains Mono);
- `shadow-raised` / `shadow-overlay` were inlined literals (they now read
  `--elevation-raised` / `--elevation-overlay`);
- the ladder was derived only on the root, whose wallpaper inputs are
  written inline by the legibility policy, so a page could not change them
  (the ladder is now declared on `<body>` too).

The last gap was raw colour in classes: 197 palette classes (`bg-white/80`,
`text-zinc-500`, …) and 11 colour literals (`bg-[#ff5f57]`) across 43
product files. Each is now a token. Hairline and wash pairs became the
ladder's tokens. Colours that are fixed by definition or mark a status got
semantic tokens (`on-media`, `scrim`, `plate`, `success`, `live`, `info`,
`brand-*`, …; [design-system.md](./design-system.md#fixed-and-status-colours)),
which the Android theme re-points where Material differs (a playing track
and a selection wear `primary`). `pnpm themes:check` ratchets the count per
file against `scripts/theme-leaks.json`, which is empty, so every product
file stays at zero. The editor's labs (`app/editor`) are exempt: they are
instruments that paint specimens in fixed colours on purpose.

**Pages.** Off the home screen, a page in the Android theme is an app, and
an Android app is an opaque screen: `surface`, no wallpaper, no relief. The
home screen is the launcher, where the wallpaper is.
`data-wallpaper-surface` (reading / desktop), the legibility policy's own
split, decides which is which. `app/themes/android/pages.css` draws the page
chrome:

| Hook | Marks | Android draws it as |
|---|---|---|
| `[data-page-nav]` (`SystemNav`) | the way back | the top app bar's navigation icon: arrow_back (via `<Themed>`), 48dp target, state layer |
| `[data-page-header]` (`PageLayout`) | the page title | Headline Large (32/40), Display Small on a wide screen |
| `[data-fab="fab"]` (the ⌘K button off home) | the page's action | M3's FAB: 56dp, 16dp corners, `primary-container`, search icon |
| `[data-chip="filter"]` (`HeaderAction`, the /works and /prompt toolbars) | a filter | a filter chip: 32dp, 8dp, `outline-variant` edge, tonal when selected |
| `[data-chip="action"]` | an action in a line of metadata | a text button in `primary` |

**The contract between components and overlays is a set of role hooks.**
Components mark what they are, and the overlay decides how that looks. No
component knows which theme is up.

| Hook | Marks | Android draws it as |
|---|---|---|
| `[data-widget-shell]` (+ `data-widget-tone`) | a home widget card | a widget container, 28dp, `surface-container` or an accent container |
| `.surface-shell` (`SHELL`) | every sheet, panel, popover, window | Material surfaces; the site's tokens re-pointed inside |
| `[data-surface-popup]` / `[data-surface-viewport][data-modal]` / `[data-surface-grabber]` / `[data-surface-title]` | a sheet's geometry, scrim, handle, title | the docked bottom sheet, its 32% scrim, the drag handle, Title Large |
| `.search-view`, `[data-search-header]`, `[data-search-divider]`, `[data-app-strip]` | the command palette | M3's search view |
| `[data-snackbar]`, `[data-snackbar-action]` | a toast | a snackbar |
| `[data-status-chip]` | a dock pill | a status chip |
| `.window-pill`, `[data-window-dots]`, `[data-window-dot]`, `[data-window-handle]` | an app window's chrome | the caption buttons / the app handle |
| `[data-md-switch]`, `[data-segmented]`, `[data-section-label]` | settings controls | M3 switch, connected button group, a settings heading |
| `[data-page-surface]` | a page's `<main>` | where the container transform lands |

**Behaviour follows metadata.** Each theme-specific behaviour asks the
active theme's metadata, never compares its name:

| Behaviour | Reads |
|---|---|
| The ripple (`MaterialRipple`) | `pressFeedback === "ripple"` |
| Haptics | `haptics` |
| The container transform | `openPage === "container-transform"` |
| The grid's reflow and lift springs | `layoutMotion === "spring"` |
| Dynamic colour (`DynamicColorBridge`, `useWallpaperSeeds`) | `dynamicColor`; leaving the theme clears the palette variables |
| Glass and Tint in ⌘K | `materialSetting === "glass"`, so they are offered only in the theme they change |

**Keeping it from breaking: `pnpm themes:check`** (`scripts/check-themes.mjs`,
also run in CI) fails when:

1. a rule in an overlay is not scoped to its theme;
2. an overlay isn't imported by `app/globals.css`;
3. a stylesheet outside `app/themes/` styles a theme by attribute;
4. a component compares a theme id (`theme === "android"`, `dataset.osTheme`)
   instead of reading metadata;
5. product code uses a raw colour in a class, whether a palette colour or a
   colour literal (the ratchet, `scripts/theme-leaks.json`, is at zero).

**Adding a theme:**

1. Add an object in `systems/os/themes/<id>.ts` and register it in `index.ts`.
2. Add its label in `lib/i18n.ts`.
3. Write its overlay in `app/themes/<id>/`, starting from the role hooks
   above, and import it in `app/globals.css`.
4. Add a variant for it next to `android:` if it needs one.
5. Run `pnpm themes:check`, then switch through every theme with ⌘K.

The Android theme is the default (`DEFAULT_OS_THEME`). A visitor who has
never chosen gets it, including on first paint, since the boot script is
generated from the registry.

**Storage and migration.** `hux_os_theme` holds `hux` or `android`. The
Android theme's own settings are `hux_md_style` and `hux_md_seed`. The theme
was once a "skin" (`hux_skin`: material / glass). The boot script migrates
those keys once (material → android, glass → hux) before anything reads
them.

---

The rest of this page is the **Android theme**. It pairs with the
Android-shaped grid ([system-widget-grid.md](./system-widget-grid.md)): the
grid is how widgets are *arranged and sized*, and the theme is how everything
*looks*.

| Piece | Where |
|---|---|
| Dynamic color: wallpaper → scheme → roles | `systems/os/android/lib/scheme.ts` |
| Publishes the palette onto `<html>` | `systems/os/android/components/dynamic-color-bridge.tsx` |
| Wallpaper colors: extraction, options, the picker | `systems/os/android/lib/wallpaper-colors.ts`, `components/wallpaper-colors.tsx` |
| Tokens, widgets, edit mode, surfaces, system UI, controls, page, motion | `app/themes/android/*.css` |
| Expressive shapes (`Sunny`, the cookies, …) as SVG paths | `systems/os/android/lib/shapes.ts`, `ExpressiveShape` |
| The resize frame (Android) and the corner (Hux) | `components/ui/resize-grip.tsx` |
| Google Sans Flex (`--font-flex`) | `app/layout.tsx` |
| The ripple (every pressable, site-wide) | `systems/os/android/components/material-ripple.tsx` |
| Haptics (pickup, resize ticks, drop) | `systems/os/android/lib/haptics.ts` |
| Container transform (widget → page) | `systems/os/android/lib/container-transform.ts` |
| Loading indicator (shape morph) | `systems/os/android/components/loading-indicator.tsx`, `lib/loading-shapes.ts` |

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

**Colors.** The wallpaper picker has Android's Colors section (Wallpaper &
style), shown only in the Android theme
(`systems/os/android/components/wallpaper-colors.tsx`):

- **Wallpaper colors.** Four options taken from the wallpaper through
  Android's pipeline, using the same library
  (`systems/os/android/lib/wallpaper-colors.ts`). A photograph is shrunk to about
  112×112 pixels, quantized to 128 colours (`QuantizerCelebi`) and ranked by
  `Score`, which keeps up to four seeds, each read once per file. A painted
  wallpaper (the Sky, the Gradient) has no pixels to read, so its one seed is
  the live tint, as a live wallpaper hands Android. As on Android, the four
  slots are shared between the seeds and the styles. One seed fills all four
  (tonal spot, neutral, vibrant, expressive), two seeds take two each, and
  four seeds take one each. Choosing an option sets the seed and the style
  together. The first option is the default, and it follows the wallpaper.
- **Basic colors.** Six seeds that ignore the wallpaper.
- **Style.** Filter chips for the five styles Android names: tonal spot (the
  default), neutral, vibrant, expressive, monochrome.

Each swatch is drawn the way Android draws one: a disc whose top half is the
primary accent and whose bottom quarters are the secondary and tertiary
accents (the dark scheme's tone-80 accents), in the style that option
carries. The selected swatch shrinks inside a ring. The choice is stored as
`hux_md_seed` (`useOsTheme().seed`, a `SeedChoice`), and `DynamicColorBridge`
seeds from it.

## The widget container

An Android widget is not a pane over the wallpaper: it is an opaque tonal
surface. So in the Android theme a card is `surface-container`, at the 28px system
radius, with no blur, no hairline and no picture showing through (the
wallpaper-in-the-card overlay is hidden). Hover and press are state layers of
`on-surface` at Material's 8% / 10%; keyboard focus is a 3px `secondary`
outline.

The content inside needed no edits. It paints with the site's tokens — the ink
ladder, the glass fills, `border` — and the theme re-points those tokens, scoped
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

Google Sans Flex is not preloaded: a visitor in the Hux theme never downloads
it.

## Variants inside the Android theme

Some controls are shared, and want their Material form only inside a
Material container. The album tabs, for example, are also used in the
theater, the music transport also appears in the Live Activity, and a
thumbnail also appears in the playlist sheet. `m3:` applies inside a widget
card or a surface in the Android theme. `android:` applies anywhere in the
Android theme, such as the app icon's mask or the folder.

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
accent containers; the Hux theme ignores it.

## Surfaces

Every sheet, side panel, popover and window is the system's own UI, so under
Material it is drawn the way Android draws its own: an opaque tonal
container, no glass. `SHELL` (systems/surface/sheet.tsx) carries a
`surface-shell` class, and the theme re-points the site's tokens on it exactly
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
captured on `<body>` as `--font-code` before a theme re-points `--font-mono`.

**System UI** beyond the surfaces:

| Element | Material form |
|---|---|
| **Command palette** | M3's search view (`SearchViewTokens`). Docked on a desktop: `surface-container-high` at 28dp, elevation 3. On a phone it is the bottom sheet in the same container. The header is a 56dp row with the 24dp search icon in `on-surface`, the query in Body Large, and a divider in `outline`. Results are list items (56dp, Body Large, a 24dp leading icon in `on-surface-variant`); hover and the keyboard highlight are state layers, and each section is headed like a settings group. The app strip keeps its tiles. |
| **Toasts** | Snackbars (`SnackbarTokens`): `inverse-surface` under `inverse-on-surface`, Body Medium, 4dp corners, elevation 3. Actions are text buttons in `inverse-primary`. A snackbar arrives as Compose's does, fading in as it grows from 80% on the emphasized-decelerate curve. |
| **App windows** | Android's desktop windowing, not macOS. The caption's controls are icon buttons in `on-surface-variant`, ordered minimize, maximize (a square, not a plus), close, so close sits at the edge. They use state layers instead of traffic-light colours. When lit, the caption pill is `surface-container-high` at elevation 2 rather than frosted glass. On touch screens the three lights become Android's app handle: one 32×4 bar at the top of the window. |
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

## Motion

**Container transform.** Tapping a widget that opens a page (the card or
its arrow) grows the card into the page, as Android opens a card into a
screen. It rides the navigation's own view transition. The card is named
`md-container` for the old snapshot, and the destination's
`[data-page-surface]` (PageLayout's `<main>`) takes the name while
`html[data-md-transform]` is set (`systems/os/android/lib/container-transform.ts`).
The container travels 500ms on the emphasized curve. Its corners open from
the widget radius to square, and its `surface-container` fill thins into the
page. Inside it the card fades out over the first 30% and the page fades in
over the rest (fade through). This only happens in the Android theme, in
browsers with view transitions, and without reduced motion. Anywhere else
the page crossfades in as before.

**Loading indicator.** `LoadingIndicator` replaces the spinners in the
Android theme with M3 Expressive's. One shape morphs into the next every
650ms through Compose's sequence: SoftBurst, 9-sided cookie, pentagon, pill,
Sunny, 4-sided cookie, oval. Each morph also turns the shape a quarter, and
the whole indicator turns once every 4.67s. Every shape is sampled as a
radius per angle at the same angles and scaled to the same area, so the
paths share their commands, the morph is plain SVG interpolation (SMIL, no
per-frame script), and the indicator never seems to breathe. The indicator
is 38/48 of its box. It is `primary`, or `on-primary-container` on a
`primary-container` disc when `contained`. It stands in for the wallpaper's
settle ring, the weather's reload and boot spinners, and a Lynx app's
loading state. The Hux theme keeps its rings.

## Touch: the ripple and the motor

**The ripple.** Anywhere in the Android theme, pressing a pressable thing
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

The Hux theme keeps its wash; the widget card's `:active` overlay is held
clear in the Android theme so the ripple is the only press.

**Haptics.** Launcher3 answers a widget's pickup with `LONG_PRESS`, each cell
a resize crosses with a tick, and the drop with a confirm; `haptic()` plays
those as short `navigator.vibrate` pulses (12 / 4 / 8ms — clicks, not
buzzes). Android theme, touch devices only; nothing where the platform has
no motor.

## Edit mode

Android's launcher does not jiggle. It says "editing" on the widget being
worked on, and moves things on springs. So in the Android theme:

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

Both affordances are in the tree and the stylesheet picks one (`android:`);
the only thing the grid reads from the theme in React is which spring Framer
should use.
