# Ambient System

The ambient system creates a **living, breathing interface** that responds to real-world context: weather, location, and time of day.

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
│   ├── wallpaper-background.tsx  # Full-page wallpaper renderer (any source)
│   ├── wallpaper-sheet.tsx       # Wallpaper picker (secondary window, vaul)
│   ├── gradient-stack.tsx        # Shared crossfade renderer (full-page + widgets)
│   ├── weather-icon.tsx          # Weather condition icons
│   ├── weather-widget.tsx        # iOS-style weather widget (header + WeatherNow)
│   ├── weather-now.tsx           # Shared weather body + useDisplayWeather()
│   ├── phase-activity.tsx        # Sun-event notification (plugs into the Dock)
│   └── index.ts                  # Component exports
├── lib/
│   ├── gradient.ts               # OKLCH gradient generation + crossfade types
│   ├── greeting.ts               # Time-of-day helpers
│   ├── location.ts               # IP/GPS location resolution
│   ├── notification.ts           # Upcoming sun-event detection (lead-up + window)
│   ├── phase.ts                  # Ambient phase derivation
│   ├── queries.ts                # React Query hooks
│   ├── route-config.ts           # Form-factor types
│   ├── settings.ts               # User preference persistence
│   ├── wallpaper.ts              # Wallpaper sources + built-in catalog
│   ├── sun.ts                    # Sunrise/sunset calculations
│   ├── weather.ts                # Weather API integration
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

### Weather Conditions

Normalized weather conditions from Open-Meteo API:

```typescript
type WeatherCondition = "clear" | "cloudy" | "fog" | "rain" | "snow" | "thunder";
```

### Gradient System

OKLCH-based gradients that respond to:
- Weather condition
- Day/night state
- Light/dark theme
- Sun events (special sunrise/sunset palettes)

### Gradient Crossfade

When the weather or phase changes, the gradient must morph — never snap. The
provider keeps a **layer stack** (`gradientLayers`): each change pushes a new
layer, and the shared `<GradientStack />` fades the newest layer in over the
settled one beneath it, then the provider prunes back to the latest. This is a
true crossfade (colors morph) rather than the old dip-to-background flash.

One renderer (`gradient-stack.tsx`) serves both the full-page background and the
per-widget overlays, so they transition identically. The iOS `fixedBgTracker`
(background-attachment polyfill + viewport-relative edge mask) is applied per
layer, so soft-edging keeps working mid-crossfade.

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

- `weather` — the live weather / sun-event gradient (`lib/gradient.ts`).
- `image` — a fixed Apple pair from the built-in catalog (`lib/wallpaper.ts`).

Because there is a single stack and a single kind, the two are **mutually
exclusive by construction** — there is no state in which both paint, and nothing
has to arbitrate between them. Switching kind pushes a new layer, so
weather → image dissolves through the same crossfade as a weather change.

The sun-event Live Activity is unaffected: it renders in the Dock from weather +
phase and never reads the background, so sunrise and sunset still announce
themselves under an image wallpaper.

### Built-ins

Apple's own default macOS, iPadOS and iOS wallpapers, as light/dark pairs — the
artwork each release is recognised by. Fifteen pairs: macOS Tahoe, Sequoia,
Sonoma, Ventura, Monterey and Big Sur; iPadOS 18 in its four colourways
(Violet, Indigo, Blue, Teal); iOS 27, 18, 17, 14 and 13.

The iPadOS colourways are named for the colour rather than the release, and
their caption is the year alone: the tile would otherwise read "iPadOS 18
Violet — iPadOS · 2024", which both stutters and overflows.

The **iOS** pairs are phone artwork, and a desktop viewport can only show a crop
of one, so the picker caption and the devtool swatch mark them with a phone
glyph — the tiles are all the same 16:10 card and could not otherwise show it.
`isPhoneWallpaper()` derives it from the platform rather than storing a flag,
because a stored one drifted: it was set by hand on the pairs whose *files* are
tall, which made the glyph mean "portrait encoding" instead of "phone
wallpaper".

Not every phone wallpaper is a tall file, and nothing here was cropped to make
it square. **Apple ships most of these stills on a square canvas** and lets the
device crop; the `414w-896h@3x~iphone` in a filename is the target device, not
the artwork's shape. Verified against the sources by parsing the HEIC `ispe`
boxes directly:

| | Source | Committed |
|---|---|---|
| iOS 27 | 1178×2560 png | 1178×2560 |
| iOS 18 | 1186×2560 png | 1186×2560 |
| iOS 17 | 2048×2048 jpg | 2048×2048 |
| iOS 14 | 3072×3072 heic | 2400×2400 |
| iOS 13 | 3186×3186 heic | 2400×2400 |

Every one is the source aspect, downscaled at most. The two tall pairs simply
came from Apple as tall files, and they crop hardest on a desktop.

They are committed as WebP (long edge ≤ 2560 at q80) with 480px thumbnails that
picker tiles and devtool swatches resolve to, so opening the picker costs tens of
kilobytes rather than the megabyte the full set weighs. Provenance for every
pair — source URL, and HEIC frame index where the pair came out of one file —
lives in `public/wallpapers/sources.json`.

```bash
pnpm wallpapers:check   # every pair present, decodes, and within budget
```

**Apple retains rights to this artwork.** It is committed for a personal site,
not licensed onward; the archives the frames were pulled from do not license
Apple's images either, and their repository licenses are not asserted to do so.

### Light/dark pairs

Every wallpaper ships as a pair, and which half shows **always follows the app
theme** — the macOS Dynamic Desktop behaviour. That is deliberately not a
setting. Pinning a half only ever produced light artwork under light text, and
the damping needed to rescue that made the wallpaper a ghost; the tiles keep a
sun / moon on each half as an indicator, not a control.

Opacity is resolved once, in the provider, and read by both the full-page layer
and the widget overlay as `useWallpaper().opacity`:

| | Light theme | Dark theme |
|---|---|---|
| Weather gradient | 0.70 | 0.85 |
| Image wallpaper | 1.00 | 1.00 |

An image wallpaper paints at **full strength**: it is a picture someone chose,
and the home screen is a desktop. Reading pages recede it with a veil and a
defocus instead of dimming the layer — see
[Reading surfaces](./system-glass.md#reading-surfaces). How *solid* the surfaces
on top of it are is a separate setting again — see
[docs/system-glass.md](./system-glass.md).

### Placement

Where the active wallpaper paints is `weatherGradientMode` (named for weather
because that was the only source when it shipped; it now governs whichever
source is active):

| Mode | Effect |
|------|--------|
| `full` | Behind the whole page |
| `widget` | Only inside widget cards (each a viewport-aligned window onto it) |
| `off` | Nowhere — the global background kill switch |

**Soft edging** — the top/bottom fade, on by default on iOS — is a *weather*
affordance and is gated to it. It exists to hide a seam: the gradient is a
synthetic wash, and where it stops against the page background there is a line.
A photograph has no such seam, so the fade does not soften an edge, it deletes a
strip of the picture — and in light mode it deletes it to pure white, which
reads as a bleached band rather than a vignette. The devtool switch can still
force it on.

### Triggers

| Surface | How |
|---------|-----|
| Command palette | `Wallpaper: <name>` (⌘K), or `/` then `W` |
| Devtool panel | Wallpaper module — the whole background system in one place |
| Anywhere in code | `useWallpaper().openPicker()` |

The picker itself is a secondary window (`wallpaper-sheet.tsx`) built on vaul,
mounted once in the root layout and shaped like the music playlist sheet: a
bottom action sheet on narrow viewports, a right-edge floating panel on wide
ones.

Its tiles are **macOS Settings pair cards**: a 16:10 split of the light and dark
originals, a sun / moon marking each half, a check when selected, and `Name` +
`macOS · 2020` underneath. Weather is the **first tile in the same grid at the
same size** — it is one of the wallpapers, just the only one that moves. Where
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
  gradient,            // CSS gradient string
  isLoading,
  isFetching,
  error,
  isOverrideEnabled,   // Debug mode
  debugOverride,
  setDebugOverride,
  refresh,
  gradientMode,        // Placement: "full" | "widget" | "off"
  setGradientMode,
  cycleGradientMode,
  gradientLayers,      // The shared crossfade stack (any source)
  fullGradientEnabled,
  widgetGradientEnabled,
} = useWeather();
```

### useWallpaper

```typescript
const {
  kind,                   // "weather" | "image"
  setKind,
  wallpaper,              // The selected pair
  wallpapers,             // The whole catalog
  selectWallpaper,        // Selects AND switches kind to "image"
  variant,                // Which half the app theme lands on right now
  opacity,                // Resolved for kind and theme
  veil,                   // The scrim/reading veil alpha over an image
  blurred,                // Whether this route defocuses the wallpaper
  src,                    // The file currently painting, for the devtool
  isPickerOpen,
  openPicker,
  closePicker,
} = useWallpaper();
```

### useAmbientTime

```typescript
const {
  nowMs,
  derivedPhase,        // From real time
  phase,               // Effective (may be overridden)
  isOverrideEnabled,
  setOverrideEnabled,
  overridePhase,
  setOverridePhase,
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
Open-Meteo API → useWeatherQuery                   wallpaperAppearance
        ↓                                             + app theme
        ↓ (sunrise/sunset times)                           ↓
deriveAmbientPhase → phase                     getWallpaperBackground
        ↓                                                    ↓
getWeatherGradient / getSunEventGradient                     │
        └──────────────────────┬─────────────────────────────┘
                               ▼
                       gradientLayers (one stack, crossfaded)
                               ▼
              WallpaperBackground (full) / WidgetShell (widget)
```

Both branches feed the same stack, which is what makes "one background at a
time" a structural property rather than a rule.

The sun-event phase runs alongside this and never touches the background:

```
phase → AmbientPhaseActivity → Dock Live Activity
```

## Caching

- **Location**: 24 hours (IP doesn't change often)
- **Weather**: 45 minutes (weather changes more frequently)
- Persisted to localStorage via React Query
