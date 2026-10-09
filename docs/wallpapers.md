---
skills: [wallpapers]
---

# Wallpapers

What paints behind the page: the live sky or a picture from the built-in
catalog, which half of a light/dark pair shows, where it paints, and how the
files are made. Part of the [Ambient System](./system-ambient.md); the sky
itself is [The Sky](./ambient-sky.md), and what a wallpaper does to the text
on it is [Legibility](./system-legibility.md).

## What it looks like done well

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/wallpapers/sonoma-light.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The home screen on a desk under the Sonoma wallpaper in the light theme: pale green hills, white glass widgets, dark ink." />
  <img src="/img/docs/wallpapers/sonoma-dark.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same page in the dark theme: Sonoma's dark half, deep green and blue, dark glass widgets, light ink." />
</div>

Sonoma, one pair, under the light and the dark theme (desk, 1280 wide). Nothing
was chosen but the theme: the half follows it, the picture paints at full
strength, and the glass and ink on top come from the pair's measured profile.

- One wallpaper paints at a time. Switching (weather ↔ picture, or one picture
  to another) dissolves through the same crossfade as a weather change.
- A pair's half follows the app theme, as macOS Dynamic Desktop does. It is
  not a setting.
- A file is never upscaled past its source, and a 1× screen never downloads
  the 2× file.

## How it works

The background is **one layer stack fed by exactly one source**:

```typescript
type WallpaperKind = "weather" | "image";
```

- `weather`: the live sky, in one of three **styles** (`weatherStyle`):

  | Style | Name | Subtitle | What it is |
  |---|---|---|---|
  | `sky` | **Sky** | shader · webgl | The WebGL shader (`lib/wallpaper/`): the whole scene, animated. Needs WebGL2. The default. |
  | `gradient` | **Gradient** | css · gradient | The same scene as a CSS gradient (`sceneToCssGradient`), live to the minute. The Sky's automatic fallback. |
  | `classic` | **Classic** | css · gradient | Six hand-tuned condition palettes by day and night plus sunrise / sunset gradients (`getClassicGradient(scene, phase)`). Steps at phase and weather changes. Chosen by hand only. |

- `image`: a picture from the built-in catalog (`BUILT_IN_WALLPAPERS` in
  `lib/wallpaper.ts`), pinned to one still or playing Shuffle / Loop over an
  album (`lib/wallpaper-play.ts`).

Style and engine are one-to-one: Sky is the canvas, the other two are the CSS
stack. The only resolution is the fallback: `resolveWeatherStyle` turns a Sky
without WebGL2 (or with the devtool's `noWebGL` override) into the Gradient,
and `useWallpaper().effectiveStyle` / `.renderer` say what won. Widget cards
always paint the CSS stack: the Classic palette under Classic, the scene
gradient under the other two.

Because there is one stack and one kind, the two are **mutually exclusive by
construction**: no state has both painting, so nothing arbitrates. The Sky's
canvas is the one exception to "everything is a layer": it paints the
full-page slot directly from the scene (see the
[data flow](./system-ambient.md#how-it-works)).

The sun-event Live Activity is unaffected by any of this: it renders in the
Dock from the clock, so sunrise and sunset still announce themselves under a
picture.

### Light/dark pairs and opacity

Which half shows **always follows the app theme**. Pinning a half only ever
produced light artwork under light text, and the damping needed to rescue that
made the wallpaper a ghost; the tiles keep a sun / moon on each half as an
indicator, not a control. `useWallpaper().variant` is the half the theme lands
on now.

Opacity is resolved once, in the provider, and read by the full-page layer and
the widget overlay as `useWallpaper().opacity`. It is keyed by the **family**
of what is painting (`WALLPAPER_LOOK_FAMILY`, `WALLPAPER_OPACITY` in
`lib/wallpaper.ts`), not by what was asked for: a Sky that fell back to the
Gradient is a wash.

| Look | Family | Light theme | Dark theme |
|---|---|---|---|
| Weather · Sky | `picture` | 1.00 | 1.00 |
| Weather · Gradient | `wash` | 0.70 | 0.85 |
| Weather · Classic | `wash` | 0.70 | 0.85 |
| Image | `picture` | 1.00 | 1.00 |

The Sky paints at 1 because its theme veil is mixed inside the shader. A
picture paints at full strength because someone chose it, and the home screen
is a desktop. Reading pages recede it with a veil and a defocus instead of
dimming the layer (see [Reading surfaces](./system-glass.md#reading-surfaces));
how solid the surfaces on top are is a separate setting again
([Glass](./system-glass.md)).

### Placement

Where the active wallpaper paints is `wallpaperPlacement`:

| Mode | Effect |
|------|--------|
| `full` | Behind the whole page (the default) |
| `widget` | Only inside widget cards, each a viewport-aligned window onto it |
| `off` | Nowhere: the global background kill switch |

**Each family says what it wants at the edge.** The family keys the edge
table too (`WALLPAPER_FAMILY_EDGES` in `lib/bezel.ts`). On an iOS phone the
provider resolves every page from that, live, as the look changes:

| Look | Bezel | Soft edge |
|---|---|---|
| Weather · Sky | on | off |
| Weather · Gradient | off | on |
| Weather · Classic | off | on |
| Image | on | off |

A CSS wash is the page's own colour pushed outward, so it fades back into the
ground. A photograph is a picture on the page, so it ends on a line inside a
bezel. The Sky is a picture too (a rendered one) and gets the image
configuration. The bezel's boot script keys on the saved style, not on WebGL
support, so a Sky that falls back to the Gradient keeps its frame rather than
flickering. A desktop window gets none of it unless overridden. Session edge
overrides from the devtool are stamped with the family they were set under, so
a change of family (a kind switch, or Sky ↔ a CSS style) ends them.

**The bezel** is `vitre` (`packages/vitre`, after ryOS): one flat colour round
the page, black by default, with the page rounded off inside it and, on iOS,
scrolling in a container while the document holds still. Tint, band and radius
are saved settings shared by both kinds (`bezelTint` black, band and radius
null for the defaults). See the package README for what Safari does and why.

**Soft edging** (the top/bottom fade) applies only while the bezel is off. A
picture is another layer in the stack, so when soft edging is on it gets the
same mask the weather gradient gets (`EDGE_FADE_MASK`, or the wider
`EDGE_FADE_MASK_HIGH_CONTRAST` for dark-mode sunrise / sunset, both in
`lib/platform.ts`).

### Picking a file

Every wallpaper paints `cover`, so the rule is about the stretch on a real
screen, not megapixels: **a full-size file is the smallest cover of a 2560×1600
viewport at 2× (5120×3200 device pixels), never upscaled past the source.** A
matching `@1x` cover (`.1x.webp`) ships beside it whenever that is smaller.
`pickWallpaperSrc()` chooses the smallest rendition that covers the viewport ×
DPR. The page paints the 480px picker thumb at once and fades the chosen file
in over it once it has decoded (a blur-up with a thumb already shipped).

## The catalog

Three categories (`WALLPAPER_CATEGORIES`), switched in the picker with the same
capsule the Featured Talks widget uses for albums.

- **Weather**: first, and the live one. Three tiles: **Sky**, a small live
  canvas running the shader at a tile-sized pixel budget; **Gradient**, the
  very gradient the page would paint; **Classic**, the palette for this
  condition and hour. Each wears a chip: Live on the two realtime styles,
  Preset on Classic. Without WebGL2 the Sky tile shows the Gradient with a
  note, which is what choosing it would paint. Under the tiles sits the
  **Tilt** row (the gyroscope; see [The Sky](./ambient-sky.md#gyroscope-tilt)).
- **Apple**: the default macOS, iPadOS and iOS wallpapers as light/dark pairs.
  Seventeen: macOS Golden Gate, Tahoe, Sequoia, Sonoma, Ventura, Monterey, Big
  Sur, Catalina and Mojave; iPadOS 26 and iPadOS 18 in four colourways
  (Violet, Indigo, Blue, Teal); iOS 15, 14 and 13.
- **Nature**: the 19 Mac OS X Nature desktop pictures (Aurora, Zebra, Zen
  Garden, …), taken from ryOS. One photograph each, so both halves are the same
  file (`isSingleImage()`) and the picker shows it unsplit.

Apple and Nature each open with **Shuffle** (after iOS Photo Shuffle: a fanned
collage, random order) and **Loop** (after macOS Change Picture: a tidy stack,
catalog order), walking only that album. While either is selected a
**Frequency** row sits directly under them: On Visit (once per tab session),
Hourly (the default), Daily. Tapping a still pins it and turns play off.

Naming: the iPadOS colourways are named for the colour and captioned with the
year alone ("iPadOS 18 Violet — iPadOS · 2024" stutters and overflows). The
iOS pairs are phone artwork, marked with a phone glyph on the caption since
every tile is the same 16:10 card; `isPhoneWallpaper()` derives it from the
platform. Apple ships those on a square canvas and lets the device crop; none
was cropped here.

### Resolution

| | Full file | @1x | Stretch at 1× |
|---|---|---|---|
| macOS Golden Gate | 4480×3088 | 2560×1765 | 1.00× |
| macOS Tahoe … Big Sur, Catalina | 5120×5120 | 2560×2560 | 1.00× |
| macOS Mojave, Nature Earth & Moon | 5120×2880 | 2844×1600 | 1.00× |
| iPadOS 26 landscape | 2752×2064 | 2560×1920 | 1.00× |
| iPadOS 18 | 3840×2668 | 2560×1779 | 1.00× |
| iOS 15 / 14 / 13 | 2916² / 3072² / 3208² | 2560×2560 | 1.00× |
| Nature Mt. Fuji | 3200×2000 | 2560×1600 | 1.00× |
| Nature (the rest) | 2560×1600 | (same file) | 1.00× |

Left out on purpose: iOS 17 (2048², would stretch 1.25×), and iOS 18 / 27 and
portrait iPadOS 26 (too tall to cover 16:10). The landscape Nature photographs
still stretch about 1.64× on a 3× portrait phone; the source is 1600px tall
and nothing is upscaled. Each tile prints the full file's pixels under its
name.

### Encoding

`scripts/wallpaper-encode.ts`, from the provenance in
`public/wallpapers/sources.json` (`pairs`, each marked `"encode": "graphic"`
or `"photo"`, and `photos`):

- **Graphic pairs**: WebP q80.
- **Photographs** (Nature, and the Catalina / Mojave pairs): WebP q95 with
  4:4:4 chroma, falling back to q90 when a file would pass ~1.8MB per 2560×1600
  megapixel (Zen Garden's raked sand).
- **Thumbs**: 480px on the long side, q72.

Budgets (`BUDGET_KB` in `scripts/wallpaper-check.ts`): a graphic pair's full
file past 2MB means something went wrong (Big Sur dark, a grainy illustration,
is about 1.2MB); a photograph gets 8MB, because raked sand is detail all the
way down.

```bash
pnpm wallpapers:encode               # every photo and every pair marked "encode" → WebP full, @1x, thumb
pnpm wallpapers:encode golden-gate   # only the named ids; prints base colour and size for the catalog
pnpm wallpapers:check                # files present, sharp enough, sized as declared, within budget
pnpm wallpapers:profile              # measure every wallpaper for legibility; commit the table
pnpm wallpapers:profile:check        # the committed table is current (CI does not run this)
```

Every wallpaper, the weather gradients included, has a static **profile** in
`lib/wallpaper-profiles.json`: lightness by band, how busy it is, its dominant
colour. The legibility policy reads that at runtime instead of the pixels; see
[Legibility](./system-legibility.md).

**Sources.** High-resolution originals came from wallpapers.poutanen.dev (macOS
6K graphics Tahoe–Big Sur, iOS 13, iOS 14), 4kwallpapers.com (Golden Gate
native, Catalina, Mojave, iOS 15; its 6016×4147 "6K" Golden Gate is an upscale
of the native pair and is not used), static.applewalls.com (iPadOS 26
landscape), and the LAYTAT/macOS-Wallpapers and Deeeee-macOS-Wallpapers
`/System/Desktop Pictures` dumps. 512pixels.net 6K files were skipped as
hand-upscales. `sources.json` holds the exact URL of every file.

**Apple retains rights to this artwork.** It is committed for a personal site,
not licensed onward; the archives it was pulled from do not license Apple's
images either.

## The picker

`wallpaper-sheet.tsx`, a secondary window on `<AdaptiveSurface>` (see
[Surface System](./system-surface.md)), mounted once in the root layout and
shaped like the music playlist sheet: a bottom action sheet on narrow
viewports, a right-edge floating panel on wide ones. It opens on the Weather
tab whenever the sky is what is in use.

Its tiles are **macOS Settings pair cards**: a 16:10 split of the light and
dark halves, a sun / moon on each, a check when selected, and `Name` +
`macOS · 2020` underneath. The Shuffle / Loop tiles use the same frame (a
three-photo collage, fanned or stacked) and sit as their own pair above the
stills, so Frequency can sit directly under them. The Weather tiles are the
same frame at the same size: the sky is one of the wallpapers, only the one
that moves. Placement sits above the grid as one compact row: a modifier, not
the thing you came for.

| Opened from | How |
|---------|-----|
| Command palette | the `Wallpaper: <current>` row (⌘K), or `/` then `W` |
| Devtool | Wallpaper module: the whole background system in one place |
| Code | `useWallpaper().openPicker()` |

## `useWallpaper()`

The full shape is `WallpaperContextType` in `systems/ambient/provider.tsx`.
The parts most callers want:

| Group | Fields |
|---|---|
| What is selected | `kind`, `setKind`, `weatherStyle`, `selectWeather` (selects a style **and** switches kind to weather), `wallpaper`, `wallpapers`, `selectWallpaper` (pins a still **and** switches kind to image; play off), `selectPlay`, `play`, `playAlbum`, `playEvery`, `setPlayEvery` |
| What is painting | `effectiveStyle`, `renderer` (`"shader"` or `"css"`), `shaderSupported`, `variant`, `src`, `layers`, `opacity`, `profile`, `legibility` |
| Where | `placement`, `setPlacement`, `fullEnabled`, `widgetEnabled`, `softEdgeEnabled`, `edgeMask`, `bezel` and the bezel settings, `devtoolOverrides` |
| Reading pages | `reading`, `veil`, `blurred`, `readingBlur`, `readingDim` and setters |
| The sky's controls | `gyro` (`enabled`, `active`, `readings`, `gated`, `denied`, `reachable`, `supported`), `setGyroEnabled`, `skyWindow`, `setSkyWindow` |
| Surfaces | `openPicker`, `closePicker`, the tilt primer and sky-window offer open/close pairs |
