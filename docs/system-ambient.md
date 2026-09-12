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
type WallpaperSource = "weather" | "picture";
```

- `weather` — the live weather / sun-event gradient (`lib/gradient.ts`).
- `picture` — a fixed wallpaper from the built-in catalog (`lib/wallpaper.ts`).

Because there is a single stack and a single source, the two are **mutually
exclusive by construction** — there is no state in which both paint, and nothing
has to arbitrate between them. Switching source pushes a new layer, so
weather → picture dissolves through the same crossfade as a weather change.

The sun-event Live Activity is unaffected: it renders in the Dock from weather +
phase and never reads the background, so sunrise and sunset still announce
themselves under a picture wallpaper.

### Built-ins

The catalog holds two media, and the distinction is load-bearing — a photograph
carries far more contrast than vector artwork, so they render at different
opacities (`WALLPAPER_OPACITY`).

**Artwork (8).** Wallpapers evoking the default desktops of each macOS/iOS
release (Big Sur → Tahoe, plus iOS Aurora and Sunset). These are **original CSS
artwork** — layered radial blooms in the same OKLCH language as the weather
gradients — not Apple's image files, which are copyrighted and would add tens of
megabytes of binaries to a static site. As vectors they cost ~1KB each, stay
crisp at any resolution and need no network.

**Photographs (3).** `Limb`, `Ember` and `Icefall` — NASA imagery, public domain
under NASA's media usage guidelines. Downloaded and encoded by
`scripts/wallpaper-fetch.mjs`; the encoded WebP files are committed so a build
never depends on nasa.gov.

| | Light half | Dark half |
|---|---|---|
| **Limb** | Cloud field over the Indian Ocean | First rays of an orbital sunrise |
| **Ember** | Fog over the Namib dune field | The Sun clearing the limb |
| **Icefall** | Jakobshavn calving front | An orbital sunset fading out |

They were curated on a measurement, not taste alone: behind body copy what hurts
is not brightness but **detail**, so every frame is empty — a limb, a field, a
void — with one tonal direction. That criterion also explains the size of the
set. Scoring the whole candidate pool for luminance and detail turned up plenty
of dark frames that qualify and very few light ones: orbital photography is
overwhelmingly dark material, and a fourth pair (Voyager's *Pale Blue Dot*) was
cut because no light half of it survived a readability check against real text.

```bash
pnpm wallpapers:fetch          # download missing, encode into public/wallpapers
pnpm wallpapers:fetch --force  # re-download everything
pnpm wallpapers:fetch --report # luminance / detail per file — the curation data
pnpm wallpapers:check          # CI: committed files are current
```

Adding one: put its NASA ID in `SOURCES` in the script, run it, then add the
entry to `PHOTO_WALLPAPERS` with the `base` colour the script prints. Each photo
also gets a `-thumb.webp` rendition; picker tiles resolve to it, so opening the
picker costs tens of kilobytes rather than the whole catalog.

### Light/dark pairs

Every wallpaper ships as a pair. Which half shows is the **appearance**:

```typescript
type WallpaperAppearance = "auto" | "light" | "dark";
```

`auto` follows the app theme (the macOS Dynamic Desktop behaviour) and is the
default. Pinning `light` or `dark` against the current theme would put light
artwork under light text, so the background layer damps itself hard in that case
— the pin still reads as a tint, but the themed page background carries the
contrast.

Opacity is resolved once, in the provider, and read by both the full-page layer
and the widget overlay as `useWallpaper().opacity`:

| | Light theme | Dark theme |
|---|---|---|
| Weather gradient / artwork | 0.60 | 0.75 |
| Photograph | 0.35 | 0.75 |
| Pinned against the theme | 0.25 | 0.30 |

### Placement

Where the active wallpaper paints is `weatherGradientMode` (named for weather
because that was the only source when it shipped; it now governs whichever
source is active):

| Mode | Effect |
|------|--------|
| `full` | Behind the whole page |
| `widget` | Only inside widget cards (each a viewport-aligned window onto it) |
| `off` | Nowhere — the global background kill switch |

### Triggers

| Surface | How |
|---------|-----|
| Command palette | `Wallpaper: <name>` (⌘K), or `/` then `B` |
| Devtool panel | Wallpaper module — source, appearance, swatch hot-swap |
| Anywhere in code | `useWallpaper().openPicker()` |

The picker itself is a secondary window (`wallpaper-sheet.tsx`) built on vaul,
mounted once in the root layout and shaped like the music playlist sheet: a
bottom action sheet on narrow viewports, a right-edge floating panel on wide
ones.

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
  source,              // "weather" | "picture"
  setSource,
  wallpaper,           // The selected built-in
  wallpapers,          // The whole catalog
  selectWallpaper,     // Selects AND switches source to "picture"
  appearance,          // "auto" | "light" | "dark"
  setAppearance,
  resolvedAppearance,  // Which half "auto" lands on right now
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
                                    wallpaperSource
                                          │
        ┌─────────────────────────────────┴──────────────────┐
        │ "weather"                                "picture" │
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
