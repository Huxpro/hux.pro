# Ambient System

The ambient system creates a **living, breathing interface** that responds to real-world context: weather, location, and time of day. Its centrepiece is the **weather wallpaper** — an iOS-lock-screen-style animated sky (sun, moon, clouds, rain, snow, fog, lightning, stars) that tracks the visitor's actual weather and the real positions of the sun and moon — offered in three styles: Sky, Gradient and Classic. On a thunder day it answers a click with [a bolt](#the-strike-thunder-day-easter-egg).

It also owns the page background — the **wallpaper**. Weather is not a separate
background feature; it is the one wallpaper that changes on its own. See
[Wallpaper](#wallpaper) below.

## Overview

```
systems/ambient/
├── provider.tsx                  # AmbientProvider (Location + Weather + Time contexts)
├── components/
│   ├── greeting.tsx              # Time-based greeting component
│   ├── surface.tsx               # Page container + full-page wallpaper mount
│   ├── wallpaper-background.tsx  # Full-page wallpaper renderer (image / CG / gradient)
│   ├── wallpaper.tsx             # <WeatherWallpaper /> — the CG sky's WebGL canvas shell
│   ├── wallpaper-sheet.tsx       # Wallpaper picker (an <AdaptiveSurface>)
│   ├── gradient-stack.tsx        # Shared CSS crossfade renderer (full-page + widgets)
│   ├── weather-icon.tsx          # Weather condition icons
│   ├── weather-widget.tsx        # iOS-style weather widget (header + WeatherNow)
│   ├── weather-now.tsx           # Shared weather body + useDisplayWeather()
│   ├── phase-activity.tsx        # Sun-event notification (plugs into the Dock)
│   └── index.ts                  # Component exports
├── lib/
│   ├── weather.ts                # Open-Meteo integration + condition model
│   ├── solar.ts                  # Sun elevation/azimuth, lunar ephemeris, moon phase
│   ├── scene.ts                  # weather × sun × moon × theme → WeatherScene
│   ├── gradient.ts               # WeatherScene → CSS gradient + crossfade types
│   ├── wallpaper/
│   │   ├── shader.ts             # GLSL: the full-screen procedural sky (CG)
│   │   ├── renderer.ts           # WallpaperRenderer: uniform easing, adaptive quality
│   │   └── support.ts            # WebGL2 / reduced-motion / quality-profile detection
│   ├── strike.ts                 # The thunder-day strike: timing + "is this the sky?"
│   ├── greeting.ts               # Time-of-day helpers
│   ├── location.ts               # IP/GPS location resolution
│   ├── notification.ts           # Upcoming sun-event detection (lead-up + window)
│   ├── phase.ts                  # Ambient phase derivation
│   ├── queries.ts                # React Query hooks
│   ├── route-config.ts           # Form-factor types
│   ├── settings.ts               # User preference persistence
│   ├── wallpaper.ts              # Wallpaper kinds, weather styles + built-in catalog
│   ├── wallpaper-profile.ts      # Profile types + keys (shared with the profiler script)
│   ├── wallpaper-profiles.json   # The measured table — `pnpm wallpapers:profile`
│   ├── legibility.ts             # Profile → CSS variables (docs/system-legibility.md)
│   ├── sun.ts                    # Sunrise/sunset window detection
│   └── index.ts                  # Lib exports
└── index.ts                      # System barrel exports
```

## Key Concepts

### Ambient Phase

The system derives the current "ambient phase" from:
1. **Sun events**: Sunrise/sunset windows (±45 min)
2. **Time of day**: Morning, afternoon, evening, night

```typescript
type AmbientPhase = "sunrise" | "morning" | "afternoon" | "evening" | "sunset" | "night";
```

### Weather Model

Open-Meteo's `current` block is normalised into a condition plus the
measurements the wallpaper actually renders:

```typescript
type WeatherCondition = "clear" | "cloudy" | "fog" | "rain" | "snow" | "thunder";

type NormalizedWeather = {
  temperatureC: number;
  condition: WeatherCondition;
  isDay?: boolean;
  cloudCover?: number;              // 0..1
  precipitationIntensity?: number;  // 0..1, derived from mm/h (or cm/h snow) + WMO code
  precipitationType?: "none" | "rain" | "snow";
  windSpeedKmh?: number;
  windDirectionDeg?: number;
  humidity?: number;
  sunriseMs?: number;
  sunsetMs?: number;
  // …
};
```

The six conditions stay coarse on purpose (they name the mood for icons and
labels); the finer WMO distinctions survive as measurements. So a 40 %-cover
"cloudy" and a 95 % overcast look different, drizzle is not a downpour, and the
wind actually leans the rain.

### Solar & Lunar Geometry

`lib/solar.ts` computes the sun's **elevation and azimuth** for the visitor's
coordinates (NOAA algorithm). This is what makes the wallpaper time-sensitive
at minute resolution rather than in six steps: dawn brightens gradually, the
sun glow tracks east → south → west across the viewport, the horizon warms
through civil twilight, and stars fade in as the sun drops below −6°. Without
coordinates it falls back to an arc estimated from sunrise/sunset (or the local
clock), so a first paint still reads right.

The **moon** uses a low-precision lunar ephemeris (Schlyter, ~1°): topocentric
elevation/azimuth plus the phase from the sun–moon elongation. So the moon
rises, crosses and sets when it really does, a young crescent follows the sun
down in the west while a full moon climbs in the east at dusk, and the phase
matches the calendar (`getMoonPhaseName()` gives the eight-way name). Moonlight
is modelled too: a bright, high moon lifts the night sky and cloud tops and
washes out the fainter stars; cloud cover and fog occlude it. In the southern
hemisphere the crescent is mirrored.

**Staging the moon.** Where the moon *is* comes from the ephemeris and is never
bent. Where it is *drawn* is a composition decision (`stageMoon` in
`lib/scene.ts`), made on purpose:

- The vertical mapping is a stage, not a protractor. A moon a few degrees up is
  already drawn in the strip above the page content, and it climbs from there
  to just under the top edge. Mapping elevation linearly put most of a night's
  moon behind the widget grid.
- Horizontally it crosses east → west with its azimuth (mirrored in the south),
  kept off the extreme edges so a rising or setting moon is never half a moon.
- The daytime moon is intentional and quiet. A first-quarter moon really is up
  all afternoon; here it shows only when well up and far enough from the sun
  to be seen in daylight (elongation over ~40°, so a crescent near the sun
  stays invisible by day, as in the sky), and then as a pale disc at under a
  fifth of its night strength.
- It is drawn up to 30 % larger near the horizon — the moon illusion.

**Drawing the moon.** The disc is the same size as the sun's — both are half a
degree across in the real sky, which is why an eclipse fits — and what makes
the sun read as the sun is the glow around it, not a bigger disc (`DISC_R` in
the shader is the one radius, times the moon illusion above).

It is shaded as a sphere rather than masked as a disc. The phase becomes a
light direction — the phase angle, from the same
elongation the ephemeris gives — and the surface is lit with Lommel-Seeliger,
the backscatter that keeps the real full moon bright right out to its limb,
plus a little Lambert and limb darkening for roundness. The terminator is
therefore a gradient of grazing light, not a cut edge.

The texture is laid out over the visible hemisphere by arc angle from the
centre of the disc, so it foreshortens toward the limb the way a sphere's
does: broad maria (smooth, being flooded basalt), a mottle of highlands, and a
sparse field of craters whose relief is a height field tilting the sphere's
normal into the same light. Detail fades with the size of a pixel's footprint
on the surface — near the limb, and on a small disc — so nothing shimmers.
Like everything else in the Sky engine it is procedural: no texture is loaded.

### WeatherScene

`deriveWeatherScene()` (`lib/scene.ts`) is the single pure function that turns
`weather × sun × theme` into a renderer-agnostic description:

| Field | What it carries |
|-------|-----------------|
| `sun` | elevation, azimuth, screen position, daylight factor |
| `moon` | elevation, azimuth, phase, illumination, visibility, screen position, moonlight |
| `sky` | zenith / horizon colours, sun-glow colour + strength (keyframed on elevation, tinted by condition) |
| `clouds` | cover, density, storminess, lit/shade colours, drift speed |
| `precipitation` | type + intensity |
| `wind` | screen-space direction × strength |
| `fog`, `lightning`, `stars` | 0..1 amounts |
| `veil` | theme blend toward the page background (light: white, dark: `#1a1a1a`) |

Both renderers consume the same scene, so switching engines never changes the
mood — only the fidelity. (The devtool condition thumbnails deliberately keep
the older hand-tuned per-condition palettes so conditions stay distinguishable
at 40 px.)

### Two Engines

| Engine | Where | How |
|--------|-------|-----|
| **Sky** (`wallpaper/`) | The `sky` weather style, full-page, when WebGL2 is available | One full-screen fragment pass: sky gradient + sun glow/disc, twinkling stars, a phased moon shaded as a lit sphere, two parallax fbm cloud decks lit toward the sun, drifting fog, stochastic lightning flashes, wind-sheared rain streaks, five depth layers of slow fluttering snow, theme veil, dither. |
| **Gradient** (`gradient.ts` + `gradient-stack.tsx`) | The `gradient` and `classic` weather styles; widget cards under every style; the Sky's fallback when WebGL2 is missing (or the devtool pretends it is) | Sun-glow radial + cloud wash + zenith→horizon linear gradient built from the scene palette, crossfaded via the layer stack. (`gradient.ts` also keeps the original hand-tuned per-condition palettes for the devtool thumbnails.) |

The Sky engine (`WallpaperRenderer`):
- treats every scene as a **target** — each uniform eases in with its own time
  constant (sky ≈ 1.8 s, clouds/precipitation ≈ 2.5 s), so a refetch never snaps;
- eases *where a body is drawn* far faster (≈0.25 s for the sun and moon): a
  live clock moves them a thousandth of a screen a minute, so that easing is
  only ever felt when a hand drives the clock — the devtool's date and time
  sliders — and there the disc should feel attached to the slider. A real jump
  of the clock still snaps, measured between one **target** and the next: a
  large gap between the target and where the disc has eased to is only lag, and
  snapping on that teleports the disc mid-drag;
- accumulates cloud/snow **drift in JS** from the smoothed wind, so a wind change
  glides instead of teleporting the sky;
- renders at a **pixel budget** (≈1.1 M px desktop, ≈0.5 M px phones) and backs
  off further when frames run long, recovering when they are cheap — the scene
  is soft, so CSS upscaling is invisible;
- pauses when the tab is hidden, renders a single still frame under
  `prefers-reduced-motion`, and survives context loss;
- fades the canvas in only after the first frame is painted (no black flash).

### Gradient Crossfade (Gradient engine)

When the scene changes, the CSS gradient must morph — never snap. The
provider keeps a **layer stack** (`gradientLayers`): each change pushes a new
layer, and the shared `<GradientStack />` fades the newest layer in over the
settled one beneath it, then the provider prunes back to the latest.

One renderer (`gradient-stack.tsx`) serves both the full-page fallback and the
per-widget overlays, so they transition identically. The iOS `fixedBgTracker`
(background-attachment polyfill + viewport-relative edge mask) is applied per
layer, so soft-edging keeps working mid-crossfade.

### The Strike (thunder-day easter egg)

**On a thunder day, clicking the sky calls lightning down onto the spot you
clicked.** It exists only on a thunder day; on any other weather there is
nothing to find, which is the point.

`lib/strike.ts` owns the rules and the one question the interaction turns on —
**did that click land on the sky, or on something?** It is not a guess: the
handler walks from the clicked element up to `<body>` and the click counts as
background only when nothing on the way paints anything (no background colour,
no background image, no backdrop filter) and nothing on the way is interactive.
That is the same question the visitor already answered with their eyes — the
pixel under the pointer was wallpaper — so the two cannot disagree. A widget
card, a link, the dock, an open sheet: all of them are something. Mark any
transparent layer that should still swallow strikes with `data-no-strike`.

The listener lives in `wallpaper-background.tsx`, on the document, because the
wallpaper layer is `pointer-events-none` and must stay that way — it is behind
the whole page. It listens for `click`, not `pointerdown`, which is what makes
it survive a phone: a click is a press and a release on the same spot, so
scrolling the page with a thumb on the sky never lights it up.

**The Sky is the only engine that answers.** `uStrike` / `uStrikeAge` /
`uStrikeSeed` drive `strike()` in the shader: a forked channel drawn top-down
out of the cloud base over ~70 ms, landing exactly on the point clicked,
flickering through two return strokes and gone inside 1.2 s. The flash it
throws lights the cloud decks the same way the weather's own `lightning()`
does. `WallpaperRenderer.strike(x, y)` is the entry point; the three uniforms
are per-frame and never eased — a strike that eased in would not be a strike.

Under the Gradient and Classic styles the egg **does not exist**, and that is
the decision rather than an omission. A wash has no geometry to draw a channel
on, so the most those styles could offer is the flash without the bolt — a
different and lesser find, dressed as the same one. An easter egg is worth
having only at full strength; where it cannot be that, it should be absent.
The rule generalises: every ambient easter egg belongs to the Sky, and the
wash keeps its one job, which is to be the quiet fallback.

Three things it will not do, all of them deliberate:

- **Not under `prefers-reduced-motion`.** A flash is precisely the motion that
  setting is asking about. The renderer refuses one too, so nothing can route
  around the check.
- **Never a strobe.** One strike per 500 ms, so clicking as fast as you can is
  two flashes a second (WCAG allows three).
- **Only where the sky is.** The weather kind, painting full-page, with the
  shader the engine in use — an image wallpaper has no sky to strike, and a
  wash has no channel to draw. A Sky that fell back to the Gradient for want
  of WebGL2 is disarmed with it.

To see it without waiting for a storm: force **Thunder** in the devtool's Sky
module and click the page background.

### Phase Notification

A heads-up that the ambient phase is about to change to sunrise/sunset. It is a
**Dock Live Activity** (see `docs/system-dock.md`), not a bespoke widget:

- **Pill** — a sun-event icon + the exact event time (e.g. `🌅 05:46`).
- **Panel** — unfolds into the shared `<WeatherNow />` body, the same readout the
  homepage weather widget uses.

Visibility (`lib/notification.ts`): from ~90 min before the event through the end
of its ±45 min window, then it hands off to the gradient + greeting. A forced
sunrise/sunset phase from the devtool also surfaces it for testing.

## Wallpaper

The background is **one layer stack fed by exactly one source**:

```typescript
type WallpaperKind = "weather" | "image";
```

- `weather` — the live sky, in one of three **styles** (`weatherStyle`):

  | Style | Name | Subtitle | What it is |
  |---|---|---|---|
  | `sky` | **Sky** | shader · webgl | The WebGL shader (`lib/wallpaper/`): the whole scene, animated, at full strength. Needs WebGL2. |
  | `gradient` | **Gradient** | css · gradient | The same scene as a CSS gradient (`sceneToCssGradient`): the sky's colour at the real sun position, live to the minute. The Sky's automatic fallback. |
  | `classic` | **Classic** | css · gradient | The original: six hand-tuned condition palettes by day and night plus the sunrise / sunset event gradients (`getClassicGradient`). Steps at phase and weather changes rather than following the clock. Chosen by hand only. |

- `image` — a fixed picture from the built-in catalog (`lib/wallpaper.ts`).

Style and engine are one-to-one: Sky is the canvas, the other two are the CSS
stack. The only resolution is the fallback — `resolveWeatherStyle` turns a Sky
without WebGL2 (or with the devtool pretending there is none) into the
Gradient — and `useWallpaper().effectiveStyle` / `.renderer` say what won.
Widget cards always paint the CSS stack: the Classic palette under Classic,
the scene gradient under the other two.

Because there is a single stack and a single kind, the two are **mutually
exclusive by construction** — there is no state in which both paint, and nothing
has to arbitrate between them. Switching kind pushes a new layer, so
weather → image dissolves through the same crossfade as a weather change.

The sun-event Live Activity is unaffected: it renders in the Dock from the
clock and never reads the background, so sunrise and sunset still announce
themselves under an image wallpaper.

### Built-ins

Three categories, switched in the picker with the same capsule the Featured
Talks widget uses for albums (`WALLPAPER_CATEGORIES` in `lib/wallpaper.ts`).

- **Weather** — first, and the live one. Three tiles: **Sky**, previewed by
  a small live canvas running the shader at a tile-sized pixel budget (the one
  wallpaper that moves should move in its tile); **Gradient**, previewed with
  the very gradient the page would paint; and **Classic**, previewed with the
  palette for this condition and hour. Every tile wears a chip: Live on the two
  realtime styles, Preset on Classic. Where WebGL2 is missing the Sky tile shows the Gradient with a note,
  which is also what choosing it would paint.
- **Apple** — the default macOS, iPadOS and iOS wallpapers as light/dark pairs,
  the artwork each release is recognised by. Twelve pairs: macOS Tahoe,
  Sequoia, Sonoma, Ventura, Monterey and Big Sur; iPadOS 18 in its four
  colourways (Violet, Indigo, Blue, Teal); iOS 14 and 13.
- **Nature** — the 19 Mac OS X Nature desktop pictures (Aurora, Zebra, Zen
  Garden, …), taken from ryOS. One photograph each, so both theme halves are
  the same file (`isSingleImage()`), and the picker shows it unsplit. Clown
  Fish and Ladybug are omitted.

The iPadOS colourways are named for the colour rather than the release, and
their caption is the year alone: the tile would otherwise read "iPadOS 18
Violet — iPadOS · 2024", which both stutters and overflows.

The **iOS** pairs are phone artwork, so the picker caption marks them with a
phone glyph — the tiles are all the same 16:10 card and could not otherwise
show it. `isPhoneWallpaper()` derives it from the platform rather than storing
a flag. Apple ships these stills on a square canvas and lets the device crop
(iOS 14 is 3072², iOS 13 3186² at source); nothing here was cropped.

#### Resolution

Every wallpaper paints `cover`, so the rule is about the stretch on a real
screen, not megapixels: **a file must cover a 2560×1600 viewport with at most a
1.07× stretch**, and is downscaled to the smallest size that still covers it.
Each tile prints the committed file's pixels under its name.

| | File | Stretch | |
|---|---|---|---|
| macOS Tahoe … Ventura | 2560×2560 | 1.00× | kept |
| iPadOS 18 | 2560×1779 | 1.00× | kept |
| Monterey, Big Sur, iOS 14, iOS 13 | 2400×2400 | 1.07× | kept |
| iOS 17 | 2048×2048 | 1.25× | removed |
| iOS 18 | 1480×3192 | 1.73× | removed |
| iOS 27 | 1320×2868 | 1.94× | removed |
| Nature | 2560×1600 (Earth & Moon 2844×1600) plus 1280×800 and 1920×1200 cover renditions | 1.00× | added |

The landscape Nature photographs stretch about 1.64× on a portrait phone; most
of the set tops out at 2560×1600 at source.

ryOS serves each photograph as one original JPEG (Aurora is 1.3MB, Snowy Hills
2.3MB) plus a picker thumb — it does not keep per-screen-size files. We still
encode three cover renditions so a phone does not download the desktop file,
and we encode them at WebP q95 with 4:4:4 chroma (q90 only when a file would
exceed 1.8MB — Zen Garden's raked sand). The previous q75 4:2:0 pass crushed
smooth skies: Aurora was 43KB of banding against a 1.3MB original.
`pickWallpaperSrc()` chooses the smallest rendition that covers the current
viewport × DPR; a 2× portrait phone still needs the full file, because 1600px
is the covering axis.

Release pairs are WebP q80. Photographs get a 480px thumbnail for the picker.
The byte budgets differ by kind: a pair past 120KB means something went wrong,
while a photograph of raked sand is detail all the way down, so photographs
get 2.5MB. Provenance for every file — source URL, and HEIC frame index where a
pair came out of one file — lives in `public/wallpapers/sources.json`.

```bash
pnpm wallpapers:encode  # fetch Nature JPEGs from sources.json and rebuild WebP renditions
pnpm wallpapers:check   # every file present, sharp enough, sized as declared, within budget
pnpm wallpapers:profile # measure every wallpaper for the legibility system (commit the table)
```

Every wallpaper — the weather gradients included — also has a static
**profile** (`lib/wallpaper-profiles.json`): its lightness by band, how busy
it is, its dominant colour. The legibility policy reads that at runtime
instead of the pixels; see [docs/system-legibility.md](./system-legibility.md).

**Apple retains rights to this artwork.** It is committed for a personal site,
not licensed onward; the archives the frames were pulled from do not license
Apple's images either, and their repository licenses are not asserted to do so.

### Light/dark pairs

Every Apple wallpaper ships as a pair, and which half shows **always follows the
app theme** — the macOS Dynamic Desktop behaviour. That is deliberately not a
setting. Pinning a half only ever produced light artwork under light text, and
the damping needed to rescue that made the wallpaper a ghost; the tiles keep a
sun / moon on each half as an indicator, not a control.

Opacity is resolved once, in the provider, and read by both the full-page layer
and the widget overlay as `useWallpaper().opacity`:

| | Light theme | Dark theme |
|---|---|---|
| Weather · Sky | 1.00 | 1.00 |
| Weather · Gradient | 0.70 | 0.85 |
| Weather · Classic | 0.70 | 0.85 |
| Image wallpaper | 1.00 | 1.00 |

Keyed by the family of what is *painting*, not what was asked for: a Sky that
fell back to the Gradient is a wash. The Sky paints at 1 because
its theme veil is mixed inside the shader; the restraint happens in the scene.

An image wallpaper paints at **full strength**: it is a picture someone chose,
and the home screen is a desktop. Reading pages recede it with a veil and a
defocus instead of dimming the layer — see
[Reading surfaces](./system-glass.md#reading-surfaces). How *solid* the surfaces
on top of it are is a separate setting again — see
[docs/system-glass.md](./system-glass.md).

### Placement

Where the active wallpaper paints is `wallpaperPlacement`:

| Mode | Effect |
|------|--------|
| `full` | Behind the whole page |
| `widget` | Only inside widget cards (each a viewport-aligned window onto it) |
| `off` | Nowhere — the global background kill switch |

**Each wallpaper family says what it wants at the edge.** A look (`getWallpaperLook`
in `lib/wallpaper.ts`) belongs to a family — `picture` (an image, the Sky) or
`wash` (the CSS styles) via `WALLPAPER_LOOK_FAMILY` — and the family keys both
the opacity and the edge table (`WALLPAPER_FAMILY_EDGES` in `lib/bezel.ts`).
On an iOS phone the provider resolves every page from that, live, as the look
changes:

| Look | Bezel | Soft edge |
|---|---|---|
| Weather · Sky | on | off |
| Weather · Gradient | off | on |
| Weather · Classic | off | on |
| Image | on | off |

A CSS weather wash is the page's own colour pushed outward, so it fades back
into the ground. A photograph is a picture on the page, so it ends on a line
inside a bezel. The Sky is a picture too — a rendered one — and gets exactly
the image configuration, so the two framed looks start from one place (and
the boot script keys on the saved style, not on WebGL support, so a Sky that
falls back to the Gradient keeps its frame rather than flickering). A desktop
window gets none of it unless overridden. Session edge overrides are stamped with the family they were set under, so a
change of family (a kind switch, or Sky ↔ a CSS style) ends them.

**The bezel** is `@hux/bezel` (`packages/bezel`), after ryOS (os.ryo.lu): one
flat colour around the page, black by default, with the page rounded off inside
it and, on iOS, scrolling in a container while the document holds still. A
devtool override turns it on or off for the session and ends when the kind
switches. Tint, band and radius are saved settings shared by both kinds (black,
0px, 16px by default). Everything is live, including the browser chrome. See
the package README for what Safari does and why.

**Soft edging** — the top/bottom fade — applies only while the bezel is off.
An image wallpaper is just another layer in the stack, so when it is on it
gets the same mask the weather gradient gets (`EDGE_FADE_MASK`, or the wider
`EDGE_FADE_MASK_HIGH_CONTRAST` for dark-mode sunrise/sunset). The devtool
switch overrides it either way.

### Triggers

| Surface | How |
|---------|-----|
| Command palette | `Wallpaper: <name>` / `Wallpaper: Weather · Sky` (⌘K), or `/` then `W` |
| Devtool panel | Wallpaper module — the whole background system in one place |
| Anywhere in code | `useWallpaper().openPicker()` |

The picker itself is a secondary window (`wallpaper-sheet.tsx`) built on
`<AdaptiveSurface>` (see [Surface System](./system-surface.md)), mounted once in
the root layout and shaped like the music playlist sheet: a bottom action sheet
on narrow viewports, a right-edge floating panel on wide ones.

Its tiles are **macOS Settings pair cards**: a 16:10 split of the light and dark
originals, a sun / moon marking each half, a check when selected, and `Name` +
`macOS · 2020` underneath. The Weather category's three tiles are the **same
frame at the same size** — the sky is one of the wallpapers, just the only one
that moves, and it opens on that tab whenever the sky is what is in use. Where
the wallpaper paints sits above the grid as one compact row: a modifier, not the
thing you came here for.

## Components

### AmbientSurface

Wraps page content with the wallpaper background:

```tsx
<AmbientSurface>{children}</AmbientSurface>
```

- Renders `<WallpaperBackground />` when placement is `full`
- Falls back to the solid themed background otherwise

### AmbientGreeting

Time-based greeting that speaks to the user:

```tsx
<AmbientGreeting />
// "good morning." / "the sun is rising." / etc.
```

### WeatherWidget

iOS-style weather widget with:
- City name from location
- Temperature
- Weather condition icon
- Loading/error states

## Contexts

### useLocation

```typescript
const {
  locationMode,        // "ip" | "accurate"
  location,            // ResolvedLocation | null
  isLoading,
  isFetching,
  error,
  setLocationMode,
  requestAccurateLocation,
  refresh,
} = useLocation();
```

### useWeather

```typescript
const {
  weather,             // NormalizedWeather | null
  scene,               // WeatherScene — what both engines render (lib/scene.ts)
  sceneWeather,        // The scene's weather input, for deriving other times
  isLoading,
  isFetching,
  error,
  debugOverride,       // { condition } | null — devtool, condition only
  setDebugOverride,
  sceneOverrides,      // devtool tweaks: cloud / precip / wind / veil
  setSceneOverrides,
  refresh,
} = useWeather();
```

Weather data, and nothing else. The background stack used to live here too —
weather was the only thing that could paint one — which meant
`WallpaperBackground` read two contexts to draw one wallpaper and every reader
had to hold "weather = wallpaper" in their head. It moved.

### useWallpaper

```typescript
const {
  kind,                   // "weather" | "image"
  setKind,
  weatherStyle,           // "sky" | "gradient" | "classic" — the persisted choice
  selectWeather,          // Selects a style AND switches kind to "weather"
  effectiveStyle,         // The style painting: Sky becomes Gradient without WebGL2
  renderer,               // "shader" | "css" — the engine behind it
  shaderSupported,        // WebGL2 probe result
  reportShaderFallback,   // <WeatherWallpaper /> → provider on a WebGL failure
  statsRef,               // Live renderer stats for the devtool
  wallpaper,              // The selected pair
  wallpapers,             // The whole catalog
  selectWallpaper,        // Selects AND switches kind to "image"
  variant,                // Which half the app theme lands on right now
  placement,              // "full" | "widget" | "off"
  setPlacement,
  fullEnabled,            // Resolved from placement, or a devtool override
  widgetEnabled,
  softEdgeEnabled,
  layers,                 // The shared crossfade stack (either kind)
  edgeMask,               // CSS mask-image, or null
  devtoolOverrides,       // Ephemeral, devtool only
  setDevtoolOverrides,
  opacity,                // Resolved for what is painting (look) and theme
  veil,                   // The flat veil alpha over an image (reading pages)
  blurred,                // Whether this route defocuses the wallpaper
  bezel,                  // Whether the bezel is drawn (kind, or a session override)
  bezelTint, bezelBand, bezelRadius,  // Saved settings, and their setters
  readingBlur,            // The two reading-treatment switches

  setReadingBlur,
  readingDim,
  setReadingDim,
  src,                    // The file currently painting, for the devtool
  isPickerOpen,
  openPicker,
  closePicker,
} = useWallpaper();
```

### useAmbientTime

```typescript
const {
  nowMs,               // The effective clock — real, or time-travelled
  realNowMs,           // The wall clock, untouched
  phase,               // Always derived from nowMs; there is no phase override
  sunriseMs,           // For the effective day
  sunsetMs,
  timeScrubMinutes,    // Devtool: minutes past midnight, or null
  setTimeScrubMinutes,
  dayOffset,           // Devtool: whole days (moves the moon)
  setDayOffset,
  isTimeTravelActive,
  resetTimeTravel,
} = useAmbientTime();
```

## Data Flow

```
                                     wallpaperKind
                                          │
        ┌─────────────────────────────────┴──────────────────┐
        │ "weather"                                  "image" │
        ▼                                                    ▼
IP Location API → useLocationQuery                  BUILT_IN_WALLPAPERS
        ↓                                                    ↓
Open-Meteo API → useWeatherQuery                        app theme
        ↓                                                    ↓
the clock (nowMs) + lat/lon → sun & moon                    ↓
        ↓                                                    ↓
deriveWeatherScene → scene                     getWallpaperBackground
        ├── sky:      <WeatherWallpaper /> (WebGL)           │
        ├── gradient: sceneToCssGradient ─────┐              │
        └── classic:  getClassicGradient ─────┼──────────────┘
                                      ▼
                    wallpaper.layers (one stack, crossfaded)
                                      ▼
              WallpaperBackground (full) / WidgetShell (widget)
```

Both branches feed the same stack, which is what makes "one background at a
time" a structural property rather than a rule. The Sky's canvas is the one
exception to "everything is a layer": it paints the full-page slot directly
from the scene, while widget cards keep painting the gradient of that same
scene.

The sun-event phase runs alongside this and never touches the background:

```
phase → AmbientPhaseActivity → Dock Live Activity
```

## Caching

- **Location**: 24 hours (IP doesn't change often)
- **Weather**: 45 minutes (weather changes more frequently)
- Persisted to localStorage via React Query
