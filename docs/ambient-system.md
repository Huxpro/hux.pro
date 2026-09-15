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
│  │   • timeScrubMinutes / dayOffset: devtool time travel       │   │
│  │                                                             │   │
│  │ UI State:                                                   │   │
│  │   • debugPanelOpen: boolean                                 │   │
│  │                                                             │   │
│  │ Debug Overrides (ephemeral):                                │   │
│  │   • weatherOverride: { condition }                          │   │
│  │   • sceneOverrides: cloud / precip / wind / veil            │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│              COMPUTED VALUES                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Scene: weather × sun position × theme (+ devtool overrides) │   │
│  │        → sky palette, clouds, precipitation, wind, fog…      │   │
│  │ Wallpaper: WebGL shader (or CSS gradient) from the scene    │   │
│  │ Greeting: computed from phase + visitor context             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Weather Wallpaper Rendering

```
┌─────────────────────────────────────────────────────────────────────┐
│                     WALLPAPER PIPELINE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   NormalizedWeather ──┐                                             │
│   getSolarPosition ───┼──▶ deriveWeatherScene() ──▶ WeatherScene    │
│   theme / overrides ──┘         (lib/scene.ts)          │           │
│                                                         ▼           │
│                   ┌─────────────────────────────────────┴─────────┐ │
│                   ▼                                               ▼ │
│     WallpaperRenderer (WebGL2)                     sceneToCssGradient│
│     lib/wallpaper/renderer.ts + shader.ts          lib/gradient.ts  │
│     • eased uniforms (no snapping)                 • crossfade stack│
│     • pixel budget + adaptive scale                • widget overlays│
│     • pauses hidden / reduced-motion still frame   • no-WebGL path  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Style selection: `settings.weatherStyle` (`sky` | `gradient` | `classic` — the
three tiles of the picker's Weather category). Sky is the shader; Gradient is
the same scene as CSS, live; Classic is the original condition palettes. A
runtime WebGL2 probe (or a failure at any point) turns Sky into Gradient;
nothing else falls back. Widget cards always paint the CSS stack (one canvas
cannot be shared across cards).

### Cache & Freshness

| Data | Stale Time | Why |
|------|------------|-----|
| Location | 24 hours | User doesn't move often |
| Weather | 45 minutes | Weather changes moderately (key versioned `v2` for the richer payload) |

Both are persisted to localStorage via TanStack Query's persister, so returning visitors see cached data immediately.

### Route Configuration

The gradient background is opt-in per route:

| Route | Gradient | Rationale |
|-------|----------|-----------|
| `/` | ✅ Enabled | Homepage should feel alive |
| `/writing/[slug]` | ❌ Disabled | Reading focus |
| `/career` | ❌ Disabled | Professional context |

Configuration lives in `systems/ambient/lib/route-config.ts`.

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
│   ├── WallpaperBackground    → useWallpaper() (kind, renderer)     │
│   │   └── WeatherWallpaper / GradientStack                          │
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
| `systems/ambient/lib/queries.ts` | `useLocationQuery()`, `useWeatherQuery()` |
| `systems/ambient/lib/settings.ts` | User preference persistence (location mode, gradient mode, renderer) |
| `systems/ambient/lib/location.ts` | IP + GPS location fetching |
| `systems/ambient/lib/weather.ts` | Open-Meteo `current` integration, 6-condition model, precipitation intensity |
| `systems/ambient/lib/solar.ts` | Sun elevation/azimuth (NOAA), moon phase, twilight helpers |
| `systems/ambient/lib/scene.ts` | `deriveWeatherScene()` — palette keyframes, condition profiles, theme veil |
| `systems/ambient/lib/gradient.ts` | Scene → CSS gradient (fallback renderer + devtool previews) |
| `systems/ambient/lib/wallpaper/shader.ts` | GLSL wallpaper (sky, sun, moon, stars, clouds, fog, lightning, rain, snow) |
| `systems/ambient/lib/wallpaper/renderer.ts` | `WallpaperRenderer` — uniform easing, drift, adaptive quality, lifecycle |
| `systems/ambient/lib/wallpaper/support.ts` | WebGL2 probe, reduced-motion, quality profile |
| `systems/ambient/lib/sun.ts` | Sunrise/sunset window detection |
| `systems/ambient/lib/phase.ts` | 6-phase ambient time model |
| `systems/ambient/lib/greeting.ts` | Time-based greeting logic |
| `systems/ambient/lib/route-config.ts` | Per-route wallpaper enablement |
| `systems/ambient/components/greeting.tsx` | Contextual greeting component |
| `systems/ambient/components/weather-widget.tsx` | iOS-style weather display |
| `systems/ambient/components/wallpaper-background.tsx` | Full-page background (image / CG / gradient switch) |
| `systems/ambient/components/wallpaper.tsx` | `<WeatherWallpaper />` canvas shell |
| `systems/ambient/components/wallpaper-sheet.tsx` | The picker: Weather (CG / Gradient), Apple, Nature |
| `systems/devtool/panel.tsx` | Devtool: Wallpaper and Sky modules |

## Debug Panel

The debug panel (press `D` to toggle) provides tools for testing ambient states:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEBUG PANEL                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   WALLPAPER                                  weather · gl   W       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ Now: Weather · Sky · dark · full @1.00                      │   │
│   │ Kind [Weather|Image]  Style [Sky|Gradient|Classic]  No WebGL2 ○│ │
│   │ Full / Widget / Soft edge · Reading blur / dim              │   │
│   │ GL · 1266×791 · 0.88× · 6.4ms  (internal res, scale, ms)   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   SKY                                            Live / [⟲ Now]    │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │ ☁ Cloudy · Afternoon · 14:32            ☀ 41°  🌔 78%       │   │
│   │ TIME OF DAY *                                  [▶ 🌅→🌇]    │   │
│   │ ▓▓▓▒░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒▓▓▓▓  ← the day, │   │
│   │      ↑sunrise            │playhead            ↑sunset      │   │
│   │ Sunrise Morning [Afternoon] Sunset Evening Night  (jump)   │   │
│   │ CONDITION *                              live: Cloudy      │   │
│   │ ☀️ ☁️• 🌫️ 🌧️ ❄️ ⛈️   (previewed at this hour; click again = live)│  │
│   │ DATE / MOON  ──●──  Sep 14 (+2d)   🌔 Waxing gibbous · up   │   │
│   │ ▸ TUNE  cloud 40% · precip 0% · wind 14   (sliders + API)  │   │
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
