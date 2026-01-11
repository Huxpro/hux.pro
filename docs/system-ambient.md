# Ambient System

The ambient system creates a **living, breathing interface** that responds to real-world context: weather, location, and time of day.

## Overview

```
systems/ambient/
├── provider.tsx                  # AmbientProvider (Location + Weather + Time contexts)
├── components/
│   ├── greeting.tsx              # Time-based greeting component
│   ├── surface.tsx               # Route-aware gradient container
│   ├── gradient-background.tsx   # Weather gradient renderer
│   ├── weather-icon.tsx          # Weather condition icons
│   ├── weather-widget.tsx        # iOS-style weather widget
│   └── index.ts                  # Component exports
├── lib/
│   ├── gradient.ts               # OKLCH gradient generation
│   ├── greeting.ts               # Time-of-day helpers
│   ├── location.ts               # IP/GPS location resolution
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

### Gradient System

OKLCH-based gradients that respond to:
- Weather condition
- Day/night state
- Light/dark theme
- Sun events (special sunrise/sunset palettes)

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
| `/prose/*` | ❌ OFF (reading focus) |
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
getWeatherGradient → CSS gradient
       ↓
WeatherGradientBackground
```

## Caching

- **Location**: 24 hours (IP doesn't change often)
- **Weather**: 45 minutes (weather changes more frequently)
- Persisted to localStorage via React Query
