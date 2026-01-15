# Ambient System

The ambient system creates a **living, breathing interface** that responds to real-world context: weather, location, and time of day. It makes the homepage feel **alive**—like an iOS widget that reflects the user's real-world environment.

## Product Design

### Core Experience

The ambient system creates an environment-aware experience by sensing the user's location, weather, and time of day to personalize the UI with contextual greetings and atmospheric gradients:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AMBIENT EXPERIENCE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   👋  Ambient Greeting                                              │
│   "good morning." / "日出时分，愿你满怀希望。"                        │
│   Contextual greeting based on time of day + sun events             │
│                                                                     │
│   🌤️  Weather Widget                                                │
│   ┌──────────────────────┐                                          │
│   │ BEIJING              │  ← Location (city name)                  │
│   │ 23°           ⛅     │  ← Temperature + Condition               │
│   │               Clear  │                                          │
│   └──────────────────────┘                                          │
│                                                                     │
│   🎨  Background Gradient                                           │
│   The page background subtly reflects the weather and time of day.  │
│   Sunrise window → hopeful peach/gold tones                         │
│   Sunset window → nostalgic amber with purple sky                   │
│   Clear morning → warm golden tones                                 │
│   Rainy evening → cool blue-grey tones                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Ambient Time Phases

The system uses a 6-phase model derived from current time + sunrise/sunset windows:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AMBIENT TIME PHASES                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   🌅 sunrise  │ ±45min around actual sunrise time                   │
│   🌫️ morning  │ After sunrise window until noon                     │
│   ☀️ afternoon│ Noon until sunset window                            │
│   🌇 sunset   │ ±45min around actual sunset time                    │
│   🌙 evening  │ After sunset window until 21:00                     │
│   🌃 night    │ 21:00 until sunrise window                          │
│                                                                     │
│   Special sun event phases (sunrise/sunset) trigger:                │
│   • Special greeting messages                                       │
│   • Atmospheric gradient backgrounds                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Sunrise/Sunset Gradients

Carefully tuned gradients for both light and dark mode:

| Event   | Light Mode                          | Dark Mode                           |
|---------|-------------------------------------|-------------------------------------|
| Sunrise | Dramatic peach/gold + clean sky     | Soft morning light + blue sky       |
| Sunset  | Golden-hour amber + warm rose       | Bright yellow-orange + purple sky   |

### Privacy-First Location

Location uses a two-tier model that respects privacy:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      LOCATION MODES                                 │
├──────────────────────────────┬──────────────────────────────────────┤
│       IP Mode (Default)      │        Accurate Mode                 │
├──────────────────────────────┼──────────────────────────────────────┤
│ • No permission required     │ • Requires user consent              │
│ • City-level accuracy        │ • GPS-level accuracy                 │
│ • Works automatically        │ • User must explicitly enable        │
│ • Privacy-preserving         │ • Shows 📍 indicator when active     │
└──────────────────────────────┴──────────────────────────────────────┘
```

### Smooth Transitions

When location mode changes, the UI uses stale-while-revalidate to prevent jank:

```
┌─────────────────────────────────────────────────────────────────────┐
│ User toggles IP → Accurate                                          │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Spinner appears in weather widget                                │
│ 2. Old weather/gradient remain visible (stale data)                 │
│ 3. New location fetched in background                               │
│ 4. New weather fetched in background                                │
│ 5. UI updates smoothly when new data arrives                        │
│ 6. Gradient cross-fades to new colors                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Technical Architecture

### File Structure

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

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐  │
│   │   User      │     │  Location   │     │      Weather        │  │
│   │  Preference │────▶│   Query     │────▶│       Query         │  │
│   │  (mode)     │     │             │     │                     │  │
│   └─────────────┘     └─────────────┘     └─────────────────────┘  │
│         │                   │                       │               │
│         │                   │                       │               │
│         ▼                   ▼                       ▼               │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐  │
│   │ localStorage│     │  ipinfo.io  │     │    Open-Meteo       │  │
│   │  (settings) │     │  or GPS API │     │       API           │  │
│   └─────────────┘     └─────────────┘     └─────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### State Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              SERVER STATE (TanStack Query Cache)                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Location: { lat, lon, city, region, country }               │   │
│  │ Weather: { temperatureC, condition, isDay, sunriseMs,       │   │
│  │            sunsetMs }                                       │   │
│  │                                                             │   │
│  │ • Automatically cached and persisted                        │   │
│  │ • Stale-while-revalidate built-in                          │   │
│  │ • Persisted to localStorage (survives refresh)              │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│              CLIENT STATE (React Context)                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ User Preferences:                                           │   │
│  │   • locationMode: "ip" | "accurate"                         │   │
│  │   • weatherGradientEnabled: boolean                         │   │
│  │                                                             │   │
│  │ Ambient Time:                                               │   │
│  │   • phase: sunrise|morning|afternoon|sunset|evening|night   │   │
│  │   • derivedPhase: computed from now + sunrise/sunset        │   │
│  │   • isOverrideEnabled: boolean                              │   │
│  │   • overridePhase: debug-forced phase                       │   │
│  │                                                             │   │
│  │ UI State:                                                   │   │
│  │   • debugPanelOpen: boolean                                 │   │
│  │                                                             │   │
│  │ Debug Overrides (ephemeral):                                │   │
│  │   • weatherOverride: { condition, isDay }                   │   │
│  │   • phaseOverride: sunrise|morning|...|night                │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│              COMPUTED VALUES                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Gradient: computed from weather + phase + theme + override  │   │
│  │           (sunrise/sunset phases use special gradients)     │   │
│  │ Greeting: computed from phase + visitor context             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Cache & Freshness

| Data | Stale Time | Why |
|------|------------|-----|
| Location | 24 hours | User doesn't move often |
| Weather | 45 minutes | Weather changes moderately |

Both are persisted to localStorage via TanStack Query's persister, so returning visitors see cached data immediately.

### Route Configuration

The gradient background is opt-in per route:

| Route | Gradient | Rationale |
|-------|----------|-----------|
| `/` | ✅ Enabled | Homepage should feel alive |
| `/blog/[slug]` | ❌ Disabled | Reading focus |
| `/career` | ❌ Disabled | Professional context |

Configuration lives in `lib/ambient/route-config.ts`.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      COMPONENT HIERARCHY                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Providers (shared/providers.tsx)                                  │
│   └── QueryClientProvider (TanStack Query)                          │
│       └── ThemeProvider                                             │
│           └── LocaleProvider                                        │
│               └── VisitorProvider                                   │
│                   └── CommandProvider                               │
│                       └── DevtoolProvider                           │
│                           └── AmbientProvider                       │
│                               ├── LocationContext                   │
│                               ├── WeatherContext                    │
│                               └── AmbientTimeContext                │
│                                                                     │
│   Consumers:                                                        │
│   ├── AmbientGreeting        → useAmbientTime(), useVisitor()       │
│   ├── WeatherWidget          → useLocation(), useWeather()          │
│   ├── GradientBackground     → useWeather(), useAmbientTime()       │
│   ├── AmbientSurface         → useWeather()                         │
│   ├── CommandPalette         → useLocation(), useWeather()          │
│   └── DevtoolPanel           → useDevtool(), useWeather(),          │
│                                 useAmbientTime(), useLocation()     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

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

## Key Files

| File | Purpose |
|------|---------|
| `lib/query.ts` | TanStack Query client + persister |
| `systems/ambient/lib/queries.ts` | `useLocationQuery()`, `useWeatherQuery()` |
| `systems/ambient/lib/settings.ts` | User preference persistence |
| `systems/ambient/lib/location.ts` | IP + GPS location fetching |
| `systems/ambient/lib/weather.ts` | Open-Meteo API integration (incl. sunrise/sunset) |
| `systems/ambient/lib/gradient.ts` | Weather + sun event → OKLCH gradient mapping |
| `systems/ambient/lib/sun.ts` | Sunrise/sunset window detection |
| `systems/ambient/lib/phase.ts` | 6-phase ambient time model |
| `systems/ambient/lib/greeting.ts` | Time-based greeting logic |
| `systems/ambient/lib/route-config.ts` | Per-route gradient enablement |
| `systems/ambient/components/greeting.tsx` | Contextual greeting component |
| `systems/ambient/components/weather-widget.tsx` | iOS-style weather display |
| `systems/ambient/components/gradient-background.tsx` | Background gradient renderer |
| `systems/ambient/components/surface.tsx` | Route-aware gradient container |
| `systems/devtool/panel.tsx` | Debug FAB with time/weather/refetch modules |
