# Ambient System

The ambient system creates a **living, breathing interface** that responds to real-world context: weather, location, and time of day.

## Overview

```
systems/ambient/
├── provider.tsx                  # AmbientProvider (Location + Weather + Time contexts)
├── components/
│   ├── greeting.tsx              # Time-based greeting component
│   ├── surface.tsx               # Route-aware gradient container
│   ├── gradient-background.tsx   # Full-page compositor (CSS grade + wallpaper)
│   ├── gradient-stack.tsx        # Shared crossfade renderer (full-page + widgets)
│   ├── weather-wallpaper.tsx     # WebGL sky + particle weather (iOS-style)
│   ├── weather-icon.tsx          # Weather condition icons
│   ├── weather-widget.tsx        # iOS-style weather widget (header + WeatherNow)
│   ├── weather-now.tsx           # Shared weather body + useDisplayWeather()
│   ├── phase-activity.tsx        # Sun-event notification (plugs into the Dock)
│   └── index.ts                  # Component exports
├── lib/
│   ├── gradient.ts               # OKLCH gradient generation + crossfade types
│   ├── wallpaper.ts              # Atmosphere params from phase × weather × theme
│   ├── atmosphere-2d.ts          # Canvas 2D sky fallback (same uniforms as GL)
│   ├── moon-2d.ts                # Shared moon disc for sky + particle overlay
│   ├── weather-particles.ts      # Canvas rain / snow / fog / lightning + moon
│   ├── greeting.ts               # Time-of-day helpers
│   ├── location.ts               # IP/GPS location resolution
│   ├── notification.ts           # Upcoming sun-event detection (lead-up + window)
│   ├── phase.ts                  # Ambient phase derivation
│   ├── queries.ts                # React Query hooks
│   ├── route-config.ts           # Per-route gradient defaults
│   ├── settings.ts               # User preference persistence
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

### Wallpaper System

The full-page background is a layered atmosphere, aiming at iOS Weather:

1. **CSS grade** — richer 4-stop OKLCH radials (also used by widgets + fallback)
2. **WebGL sky** — horizon-to-zenith plate, sun/moon bloom, FBM clouds, rays, stars, fog
3. **Particles** — moon disc (above the sky), rain, snow, near-field cloud puffs, fog wisps, lightning

Sky color follows **phase** (sunrise → night). Precipitation follows **weather**.
A rainy sunset is an amber horizon with rain on top, not a swapped rain plate.
The sun is for sunrise / morning / afternoon / sunset. **Evening and night hide
the sun and show a moon disc** (cool halo, terminator) so "good evening" /
"good night" no longer keep a daytime orb.
Uniforms morph exponentially (~700ms) so condition/phase changes never snap.

`prefers-reduced-motion: reduce` freezes the shader clock and draws a static
rain/snow field instead of animating particles.
If WebGL is missing the same atmosphere draws in Canvas 2D (sky plate, sun/moon,
cloud banks, stars) plus the particle layer. CSS grade remains the last-resort
fallback and the widget renderer.

Widgets keep the CSS stack (no canvas) so iOS `fixedBgTracker` still works.

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

## Components

### AmbientSurface

Wraps page content with the weather gradient background:

```tsx
<AmbientSurface>{children}</AmbientSurface>
```

- Checks route-based gradient preferences
- Renders gradient when enabled
- Falls back to solid background when disabled

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
  isGradientEnabledForPath,
  routeGradientPreferences,
  setRouteGradientPreference,
} = useWeather();
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

## Route-Based Gradients

Each route can have gradient enabled/disabled:

| Route | Default |
|-------|---------|
| `/` (home) | ✅ ON |
| `/writing/*` | ❌ OFF (reading focus) |
| `/docs/*` | ❌ OFF |
| `/*` (fallback) | ✅ ON |

Users can override via command palette or devtool panel.

## Data Flow

```
IP Location API → useLocationQuery
       ↓
Open-Meteo API → useWeatherQuery
       ↓
       ↓ (sunrise/sunset times)
deriveAmbientPhase → phase
       ↓
getWeatherGradient → CSS grade (widgets + fallback)
resolveAtmosphere  → WebGL sky + particles (full page)
       ↓
WeatherGradientBackground
```

## Caching

- **Location**: 24 hours (IP doesn't change often)
- **Weather**: 45 minutes (weather changes more frequently)
- Persisted to localStorage via React Query
