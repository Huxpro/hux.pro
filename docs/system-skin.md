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

`WidgetShell` takes a `tone` (`primary` / `secondary` / `tertiary`) for the
accent containers; the Glass skin ignores it.

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
