# Ambient System

The ambient system creates an environment-aware experience by sensing the user's location, weather, and time of day to personalize the UI with contextual greetings and atmospheric gradients.

## Product Design

### Core Experience

The ambient system makes the homepage feel **alive** - like an iOS widget that reflects the user's real-world environment:

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
│   🎨  Weather Wallpaper                                             │
│   Full-page iOS-style atmosphere: shader sky + weather particles.   │
│   Sunrise → peach horizon, low sun, warm cloud light                │
│   Sunset → amber / rose / violet with crepuscular rays              │
│   Clear night → moon halo and stars                                 │
│   Rain / snow / thunder → live precipitation over the sky plate     │
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
| `/writing/[slug]` | ❌ Disabled | Reading focus |
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
│           ├── AmbientTimeContext.Provider                           │
│           └── DebugContext.Provider                                 │
│                                                                     │
│   Consumers:                                                        │
│   ├── AmbientGreeting        → useAmbientTime(), useVisitor()       │
│   ├── WeatherWidget          → useLocation(), useWeather()          │
│   ├── WeatherGradientBackground → useWeather(), useAmbientTime()    │
│   ├── PageSurface            → useWeather() (for bg-transparent)    │
│   ├── CommandPalette         → useLocation(), useWeather()          │
│   └── DebugPanel             → useDebug(), useWeather(),            │
│                                 useAmbientTime(), useLocation()     │
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
| `lib/ambient/weather.ts` | Open-Meteo API integration (incl. sunrise/sunset) |
| `lib/ambient/gradient.ts` | Weather + sun event → OKLCH gradient mapping |
| `lib/ambient/sun.ts` | Sunrise/sunset window detection |
| `lib/ambient/phase.ts` | 6-phase ambient time model |
| `lib/ambient/greeting.ts` | Time-based greeting logic |
| `lib/ambient/route-config.ts` | Per-route gradient enablement |
| `components/ambient/ambient-greeting.tsx` | Contextual greeting component |
| `components/ambient/weather-widget.tsx` | iOS-style weather display |
| `components/ambient/weather-gradient-background.tsx` | Background renderer |
| `components/debug/debug-panel.tsx` | Debug FAB with time/weather/refetch modules |

## Debug Panel

The debug panel (press `D` to toggle) provides tools for testing ambient states:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEBUG PANEL                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   WEATHER                                              [Toggle] ○   │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ DAY:   ☀️ ☁️ 🌫️ 🌧️ ❄️ ⛈️  (6 conditions × gradient preview)   │   │
│   │ NIGHT: 🌙 ☁️ 🌫️ 🌧️ ❄️ ⛈️  (6 conditions × gradient preview)   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   TIME OF DAY                                          [Toggle] ○   │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ 🌅 06:30  🌇 18:30              Current: Morning            │   │
│   │ [🌅] [🌫️] [☀️] [🌇] [🌙] [🌃]   (6 phases, icon-only)        │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   REFETCH                                                           │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ [Location]  [Weather]   (force re-request)                  │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Phase Icons

| Phase     | Icon       | Description                    |
|-----------|------------|--------------------------------|
| sunrise   | `Sunrise`  | ±45min around sunrise          |
| morning   | `Haze`     | After sunrise until noon       |
| afternoon | `SunMedium`| Noon until sunset window       |
| sunset    | `Sunset`   | ±45min around sunset           |
| evening   | `Moon`     | After sunset until 21:00       |
| night     | `MoonStar` | 21:00 until sunrise window     |
