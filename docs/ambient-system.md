# Ambient System

The ambient system creates an environment-aware experience by sensing the user's location and weather to personalize the UI.

## Product Design

### Core Experience

The ambient system makes the homepage feel **alive** - like an iOS widget that reflects the user's real-world environment:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AMBIENT EXPERIENCE                           │
├─────────────────────────────────────────────────────────────────────┤
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
│   Clear morning → warm golden tones                                 │
│   Rainy evening → cool blue-grey tones                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

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

## Technical Design

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
│  │ Weather: { temperatureC, condition, isDay }                 │   │
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
│  │ UI State:                                                   │   │
│  │   • debugPanelOpen: boolean                                 │   │
│  │                                                             │   │
│  │ Debug Overrides (ephemeral):                                │   │
│  │   • debugOverride: { condition, isDay }                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│              COMPUTED VALUES                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Gradient: computed from weather + theme + debug override    │   │
│  │           (not stored, recalculated on every render)        │   │
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
│   Providers (components/providers.tsx)                              │
│   └── QueryClientProvider (TanStack Query)                          │
│       └── AmbientProviders                                          │
│           ├── LocationContext.Provider                              │
│           ├── WeatherContext.Provider                               │
│           └── DebugContext.Provider                                 │
│                                                                     │
│   Consumers:                                                        │
│   ├── WeatherWidget          → useLocation(), useWeather()          │
│   ├── WeatherGradientBackground → useWeather()                      │
│   ├── PageSurface            → useWeather() (for bg-transparent)    │
│   ├── CommandPalette         → useLocation(), useWeather()          │
│   └── DebugPanel             → useDebug(), useWeather()             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `lib/query.ts` | TanStack Query client + persister |
| `lib/ambient/queries.ts` | `useLocationQuery()`, `useWeatherQuery()` |
| `lib/ambient/settings.ts` | User preference persistence |
| `lib/ambient/location.ts` | IP + GPS location fetching |
| `lib/ambient/weather.ts` | Open-Meteo API integration |
| `lib/ambient/gradient.ts` | Weather → OKLCH gradient mapping |
| `lib/ambient/route-config.ts` | Per-route gradient enablement |
| `components/ambient/weather-widget.tsx` | iOS-style weather display |
| `components/ambient/weather-gradient-background.tsx` | Background renderer |
| `components/debug/debug-panel.tsx` | Debug FAB and panel |
