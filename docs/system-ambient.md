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
- `image` — a fixed picture from the built-in catalog (`lib/wallpaper.ts`).

Because there is a single stack and a single kind, the two are **mutually
exclusive by construction** — there is no state in which both paint, and nothing
has to arbitrate between them. Switching kind pushes a new layer, so
weather → image dissolves through the same crossfade as a weather change.

The sun-event Live Activity is unaffected: it renders in the Dock from weather +
phase and never reads the background, so sunrise and sunset still announce
themselves under an image wallpaper.

### Built-ins

Two categories, switched in the picker with the same capsule the Featured Talks
widget uses for albums (`WALLPAPER_CATEGORIES` in `lib/wallpaper.ts`). Weather
leads the grid in both.

- **Apple** — the default macOS, iPadOS and iOS wallpapers as light/dark pairs,
  the artwork each release is recognised by. Twelve pairs: macOS Tahoe,
  Sequoia, Sonoma, Ventura, Monterey and Big Sur; iPadOS 18 in its four
  colourways (Violet, Indigo, Blue, Teal); iOS 14 and 13.
- **Nature** — the 21 Mac OS X Nature desktop pictures (Aurora, Zebra, Zen
  Garden, …), taken from ryOS. One photograph each, so both theme halves are
  the same file (`isSingleImage()`), and the picker shows it unsplit.

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
| Nature | 2560×1600 (Earth & Moon 2844×1600) | 1.00× | added |

The landscape Nature photographs stretch about 1.64× on a portrait phone; most
of the set tops out at 2560×1600 at source.

Release pairs are WebP q80 and photographs WebP q75, each with a 480px
thumbnail for the picker. The byte budgets differ by kind: a pair past 120KB
means something went wrong, while a photograph of raked sand is detail all the
way down (27KB for Water, 1.4MB for Zen Garden at the same quality), so
photographs get 1.5MB. Provenance for every file — source URL, and HEIC frame
index where a pair came out of one file — lives in
`public/wallpapers/sources.json`.

```bash
pnpm wallpapers:check   # every file present, sharp enough, sized as declared, within budget
```

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
| Weather gradient | 0.70 | 0.85 |
| Image wallpaper | 1.00 | 1.00 |

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

**Letterbox** — on by default on iOS — is the ryOS (os.ryo.lu) answer to a
full-bleed background on a phone. Everything outside the page's safe area is
one flat frame colour: `<html>` and `<body>` paint it, `theme-color` matches it
so Safari's own chrome is the same, and the wallpaper and the page ground are
fixed layers inset to the safe area (`surface.tsx`, `LETTERBOX_INSET`). The
frame colour is `--letterbox`, the **dark ground (`#1a1a1a`) in both themes**:
ryOS paints black, but Safari on a phone refused a black tint and kept its own
dark grey, which `#1a1a1a` sits a few points from, so frame and chrome become
one surface. The page inside stays white in light via its own ground layer.
The bands and four corner pieces are drawn above everything
(`letterbox-frame.tsx`), so content scrolling under them is hidden and the page
is rounded off inside them, which is what makes the black read as a bezel
rather than as a page that ran out (the corners are only visible where the
wallpaper meets the frame). The bands overshoot the viewport by half a
screen: iOS Safari relays out `fixed` a beat after the toolbar collapses, and
the overshoot is what covers the strip it uncovers in that beat. The radius is
`wallpaperLetterboxRadius` (default 24, ryOS ships 12; devtool slider 0–48).
`theme-color` is created before first paint by an inline script in
`app/layout.tsx` and updated by the provider — Safari reads it at load. Black in both themes: the frame is
chrome, not part of the page. The wallpaper then ends on a hard line against
black, and black surrounds it on every side — the status bar, the toolbar, the
overscroll — so there is no seam left for a fade to soften. `wallpaperLetterbox` persists `true` / `false`;
`null` is auto (iOS). The devtool row toggles it.

**Soft edging** — the top/bottom fade — is what iOS had before letterbox, and
it stays as the fallback: on by default on iOS when letterbox is off, for both
kinds alike. An image wallpaper is just another layer in the stack, so it gets
the same mask the weather gradient gets (`EDGE_FADE_MASK`, or the wider
`EDGE_FADE_MASK_HIGH_CONTRAST` for dark-mode sunrise/sunset). The devtool
switch overrides it either way.

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
  isLoading,
  isFetching,
  error,
  isOverrideEnabled,   // Debug mode
  debugOverride,
  setDebugOverride,
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
  opacity,                // Resolved for kind and theme
  veil,                   // The flat veil alpha over an image (reading pages)
  blurred,                // Whether this route defocuses the wallpaper
  letterbox,              // Resolved; letterboxSetting is the stored tri-state
  letterboxSetting,
  setLetterbox,
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
Open-Meteo API → useWeatherQuery                        app theme
        ↓                                                    ↓
        ↓ (sunrise/sunset times)                           ↓
deriveAmbientPhase → phase                     getWallpaperBackground
        ↓                                                    ↓
getWeatherGradient / getSunEventGradient                     │
        └──────────────────────┬─────────────────────────────┘
                               ▼
                    wallpaper.layers (one stack, crossfaded)
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
