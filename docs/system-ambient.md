# Ambient System

The ambient system makes the interface answer to the real world: where the
visitor is, the weather there, and the time of day. It owns the page
background (the **wallpaper**), whose centrepiece is a live sky that tracks the
actual weather and the real positions of the sun and moon; it names the time of
day in the greeting and announces sunrise and sunset in the Dock; and it moves
the theme with the sun. Code: `systems/ambient/`.

This page is the entry point: the model, the data flow, the phase, the cache.
The rest is in four focused pages:

| Page | What it covers |
|---|---|
| [The Sky](./ambient-sky.md) | How the weather wallpaper is drawn: the two engines, sun and moon, wind and gravity, the gyroscope tilt, the theme's key and the twilight look |
| [Ambient easter eggs](./ambient-easter-eggs.md) | The strike, the shooting star, the gust, the fog wipe, the sky window and its pull |
| [Wallpapers](./wallpapers.md) | Weather styles and pictures, light/dark pairs, placement and the bezel, the catalog and its files, the picker (skill: `.claude/skills/wallpapers`) |
| [Legibility](./system-legibility.md) | What the wallpaper does to the text and glass on it |

## What it looks like done well

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-ambient/home-sunset.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The phone home screen at 18:40 in San Francisco: a dusk gradient from blue-grey to peach, the greeting 'Sun Is Setting', and a Dock pill at the top reading 18:42 with a sunset glyph." />
  <img src="/img/docs/system-ambient/home-night.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same screen at 22:30: a deep navy sky with stars, the greeting 'Good Night', and the page in the dark theme." />
</div>

One clear day, two phases (San Francisco, sunrise 07:11, sunset 18:42;
headless phone, forecast mocked). At 18:40 the phase is `sunset`: the greeting
says so, the Dock carries the sunset time, and the sky is at the horizon's
colours because the sun is there, not because a phase picked a palette. By
22:30 the phase is `night`, the sun is far below, the stars are out, and under
Follow the Sun the theme has gone dark.

- Nothing asks the visitor for anything on load. The place is guessed from the
  network, marked as a guess, and improved only from a tap that says why.
- The sky follows the minute; the words and the Dock follow the phase; the
  theme follows the sun's own crossing. Three clocks, never fighting.
- A reload shows the last weather at once (the cache), and a stale answer is
  refreshed when the world changes (the tab returns, the network returns, the
  forecast's next interval lands, midnight).

## How it works

![Location (IP, or a precise fix when allowed) gives lat and lon to the Open-Meteo forecast and to the sun-and-moon ephemeris; the forecast's sun times and the clock give the phase; weather, sun and moon give the WeatherScene; the scene drives the Sky's uniforms, the Gradient and Classic, and the legibility profile that sets the CSS variables on html.](/img/docs/system-ambient/data-flow.svg)

The data flow, with the real names. Read it top to bottom:

1. **Location** (`useLocationQuery`, `lib/queries.ts` + `lib/location.ts`).
   An IP lookup (ipapi.co, then ipwho.is), or, in Accurate mode and only when
   `canTakeFix` allows, a coarse `navigator.geolocation` fix, reverse-geocoded
   through Nominatim. Out comes a `ResolvedLocation` with `lat`, `lon`, city and
   `source` (`"ip"` or `"geolocation"`).
2. **Weather** (`useWeatherQuery` → `fetchCurrentWeather`, `lib/weather.ts`).
   Open-Meteo's `current` block plus `daily=sunrise,sunset`, normalised into a
   `NormalizedWeather` ([below](#the-weather-model)).
3. **The clock** (`useAmbientTime().nowMs`): the wall clock, re-read at every
   minute boundary and on `visibilitychange` / `pageshow`, or the devtool's
   time travel.
4. **Sun and moon** (`lib/solar.ts`): elevation and azimuth at `nowMs` for
   `lat, lon`, and the moon's position and phase.
5. **The phase** (`deriveAmbientPhase`, `lib/phase.ts`): `nowMs` against the
   forecast's sunrise and sunset. A label, read by the greeting, the Dock and
   the Classic palette ([below](#the-phase)).
6. **The scene** (`deriveWeatherScene`, `lib/scene.ts`): weather × sun × moon ×
   `wallpaperTheme` → one `WeatherScene` ([below](#the-scene)).
7. **What paints**: the Sky's `WallpaperRenderer.setScene()` eases the scene
   into shader uniforms; `sceneToCssGradient` and `getClassicGradient(scene,
   phase)` push CSS layers. See [The Sky](./ambient-sky.md) and
   [Wallpapers](./wallpapers.md).
8. **Legibility**: the profile of what is painting (`profileFromScene` for the
   Sky and the Gradient; the measured `wallpaper-profiles.json` for Classic and
   pictures) goes through `resolveLegibility`, and `applyLegibility` sets the
   CSS variables on `<html>` that the ink and glass read. See
   [Legibility](./system-legibility.md).

Beside that, the sun's answer for the theme (`solarThemeAt`) goes to
`<SolarThemeSync />` and the theme service ([below](#the-theme-follows-the-sun)).

One provider, `AmbientProvider` (`provider.tsx`), holds all of it and exposes
five hooks: `useLocation`, `useWeather`, `useAmbientTime`, `useSolarTheme`,
`useWallpaper` ([reference](#reference)).

### The phase

```typescript
type AmbientPhase = "sunrise" | "morning" | "afternoon" | "evening" | "sunset" | "night";
```

![A day bar for San Francisco on 7 October: night until 06:26, sunrise 06:26–07:56, morning to 12:00, afternoon to 17:57, sunset 17:57–19:27, evening to 22:27, then night. Above it, the Dock activity spans 90 minutes of lead plus each window. Below it, the Follow the Sun theme switches at 07:11 and 18:42 exactly.](/img/docs/system-ambient/phase-timeline.svg)

The six phases over one day, with the two things timed off the same sun
events: the Dock's activity above, the theme under Follow the Sun below. Note
where each changes: the phase at the windows' edges, the theme at the event
itself, in the middle of the window.

| Phase | From | To |
|---|---|---|
| `sunrise` | sunrise − 45 min | sunrise + 45 min |
| `morning` | sunrise + 45 min | 12:00 local |
| `afternoon` | 12:00 | sunset − 45 min |
| `sunset` | sunset − 45 min | sunset + 45 min |
| `evening` | sunset + 45 min | 3 hours later |
| `night` | otherwise | |

The window is `DEFAULT_SUN_EVENT_WINDOW_MINUTES` (45) in `lib/sun.ts`. Without
sun times there are no event phases and `getTimeOfDay()` (`lib/greeting.ts`)
splits the local clock at 05, 12, 17 and 21. There is no phase override: the
phase is always derived from `nowMs`, so the devtool changes it by moving the
clock.

Who reads the phase: `<AmbientGreeting />` (`getAmbientGreetingKeyFromPhase`),
`<AmbientPhaseActivity />`, and the Classic style's palette and profile. The
Sky and the Gradient do **not**: they follow the sun's elevation to the
minute.

### Phase notification

A heads-up that a sunrise or sunset is coming, as a **Dock Live Activity**
(`<AmbientPhaseActivity />`, mounted in the root layout; see
[Dock](./system-dock.md)):

- **Pill**: a sun-event glyph and the event's exact time (`18:42` in the
  screenshot above).
- **Panel**: unfolds into the shared `<WeatherNow />` body, the readout the
  home weather widget uses.

It shows from 90 minutes before the window (`DEFAULT_NOTIFICATION_LEAD_MINUTES`
in `lib/notification.ts`) to the window's end, then hands off to the greeting.
It reads the effective clock, so to see it, move the devtool's Sky clock into
the lead-up (drag the playhead, or click **Sunrise** / **Sunset** under the
timeline). It renders from the clock alone, so it shows under a picture
wallpaper too.

### The weather model

Open-Meteo's `current` block is normalised into a coarse condition plus the
measurements the sky renders:

```typescript
type WeatherCondition = "clear" | "cloudy" | "fog" | "rain" | "snow" | "thunder";

type NormalizedWeather = {
  temperatureC: number;
  condition: WeatherCondition;      // normalizeWeatherCode(weather_code)
  isDay?: boolean;
  cloudCover?: number;              // 0..1, also cloudCoverLow / Mid / High
  visibilityM?: number;
  dewPointC?: number;
  capeJkg?: number;
  precipitationIntensity?: number;  // 0..1, from mm/h (or cm/h snow) + WMO code
  precipitationType?: "none" | "rain" | "snow";
  windSpeedKmh?: number;
  windGustsKmh?: number;
  windDirectionDeg?: number;
  humidity?: number;
  sunriseMs?: number;
  sunsetMs?: number;
  observedAtMs?: number;            // current.time; with intervalS, times the next poll
  // …
};
```

The six conditions stay coarse on purpose (they name the mood for icons and
labels); the finer WMO distinctions survive as measurements, so 40 % cover and
95 % overcast look different, drizzle is not a downpour, and the wind leans the
rain.

**Measurements first, profile second.** Each condition has a hand-tuned
profile in `scene.ts` (`PROFILES`). It is the fallback: every measurement the
forecast carries replaces the profile value for what it describes, and a
condition on its own (the devtool, the legibility gallery, the profiler) paints
exactly the profile.

| Scene value | From the forecast | Without it |
|---|---|---|
| precipitation type | `rain + showers` vs `snowfall` (7 cm snow ≈ 10 mm water), from 0.1 mm/h; only a *cloudy* code is upgraded by a measurement | the condition |
| cloud cover | measured cover; floored only when something falls (0.4 + 0.45 × intensity); fog keeps its profile floor | profile |
| cloud density | cover by layer (low 0.95, mid 0.7, high 0.3) plus precipitation and instability: 80 % cirrus is a veil, 80 % stratus a lid | profile |
| cloud darkness | low and mid cover, precipitation, instability; halved for snow, mostly lifted in fog | profile + precipitation |
| fog | visibility on a log scale (10 km → 0, 200 m → 1), a fog code keeps at least 0.5, dew point within ~2 °C adds haze; held under `WIPE_MIN_FOG` while anything falls, so the fog wipe and the gust never co-arm | profile + humidity + precipitation |
| lightning | 0.55–1: hail codes (96/99) at 1, otherwise CAPE | 1 |
| wind | mean + ⅓ of the way to the gusts | mean |

**Sun times are epoch seconds.** The forecast is requested with
`timeformat=unixtime`. Open-Meteo's default ISO strings are the *location's*
wall clock with no offset, which `new Date()` reads in the *browser's* zone, so
a location one zone off moved sunrise by an hour.

### The scene

`deriveWeatherScene()` is the single pure function between the data and every
renderer:

| Field | What it carries |
|-------|-----------------|
| `sun` | elevation, azimuth, screen position, daylight factor, `isDay` |
| `moon` | elevation, azimuth, phase, illumination, visibility, screen position, moonlight |
| `sky` | zenith / horizon colours, sun-glow colour and strength (keyframed on elevation, tinted by condition) |
| `clouds` | cover, density, storminess, lit / shade colours, drift speed |
| `precipitation` | type + intensity |
| `wind` | screen-space direction × strength |
| `windWorld`, `celestial` | the same wind as east / north components; latitude, local sidereal time and magnetic declination, for the sky window |
| `fog`, `lightning`, `stars`, `clarity` | 0..1 amounts; `clarity` is cover and fog alone (the meteor's question) |
| `behind` | the stars and moon with no fog or fog deck in front (the fog wipe's uncovering) |
| `veil`, `exposure`, `flat` | the theme's blend toward the page, the brightness, and what the painters that never took the exposure paint with |

Every colour in it is already in the theme's key, so a day under the dark
theme is a deep sky rather than a veiled bright one
([The Sky](./ambient-sky.md#the-sky-and-the-theme)).

### The theme follows the sun

**Follow the Sun is an Appearance** (`services/theme.tsx`), and the default.
The four are Follow the Sun, Light, Dark and Follow the System; the palette's
`A` cycles them starting from what the sun shows, so the first press out of
Follow the Sun always changes the page. Under it the app is Light while the sun
is up and Dark once it is down; the other three are what they say. The
devtool's Sky module has a Follow the Sun toggle beside its timeline.

**The switch is at the sun's own crossing**, the middle of the ±45-minute
window, where the sky moves fastest: a cut lands softest inside motion.
`solarThemeAt()` (`lib/solar-theme.ts`) is the plain rule: light between
sunrise and sunset, dark outside, null when the sun times are unknown (and then
nothing switches).

**The handover** puts the cut in the middle of a short animation too
(`SOLAR_HANDOVER`):

```
0           the sky starts moving to the new theme: the wallpaper stack
            crossfades over skyMs (3000) instead of its usual 0.7 s, and the
            Sky's shader is put on the same clock by setThemeEase.
chromeAtMs  (1500) the chrome changes: one commit inside a view transition,
            so the page crossfades as one composited image.
skyMs       the sky settles, and the notice lands.
```

`wallpaperTheme` is what makes the lead possible: the scene, the wash's weight,
a picture's half and the profile read it, while the chrome (page ground, bezel,
ink) reads `chromeTheme`. Through twilight the scene is identical under either
theme ([the twilight look](./ambient-sky.md#the-sky-and-the-theme)), so the
sky's half of the handover crosses nothing. Where view transitions are missing
(Firefox, reduced motion) the chrome simply changes.

`<SolarThemeSync />` (root layout) hands the sun's answer to the theme service
(`setSunTheme` via `useSunThemeSlot`) under every Appearance, so choosing
Follow the Sun lands on it at once. Under Follow the Sun it moves the page two
ways:

1. **The first answer of a visit, quietly.** Until a forecast lands, Follow the
   Sun trusts the system (the bezel's boot script does the same for the first
   frame). If the sun then disagrees, the page crossfades once, with no notice.
   Nothing about the sun's answer is saved.
2. **A crossing watched live, staged**: the handover, then a one-line notice
   naming the mode. Picking another Appearance while the sky is moving calls
   the whole handover off; so does the clock turning back across the line.

Devtool time travel crosses it for real: playing the day in the Sky module
changes the theme at sunrise and sunset exactly as the real clock would.

### Permissions

Three offers stand in front of a browser prompt: the tilt (rain and snow), the
sky window, and the location. They share one pipeline:

```
provider facts            gyro state · geolocation permission · the place in use
  → lib/permissions.ts    status per kind: ready | askable | refused | unsupported
  → usePermissions(kinds) { status, askable, request() }; request asks in order
  → the feature's policy  shouldOfferTilt · skyOpenAction · skyAsksPlace · once-flags
  → PermissionSheet       usePermissionOffer (offer → asking → outcome) + the sheet
```

- **Status is read from what is in effect.** Motion is `ready` when readings
  can flow (`motionStatus`, from `gyro.reachable`); the location is `ready`
  only when a fix is the place in use (`locationStatus`). The raw facts
  disagree on edges: Safari reads `prompt` after an Allow, a `granted`
  location can still be on the IP because the fix failed, and WebKit's motion
  gate has no query at all.
- **`request()` asks in the only order that works**: motion first and
  synchronously, because WebKit opens its gate only inside the tap's own task;
  then the location, which waits for motion's answer rather than stacking a
  second dialog. Call it straight from the press, nothing awaited before it.
- **Policy is each feature's**: whether to offer and how often (the tilt's
  once-ever `weatherGyroPrimed`, the window's once-a-session
  `skyLocationOffered`). Permissions never decide those.
- **The sheet** (`PermissionSheet`) knows nothing about which permission it
  fronts: `ask(fn)` runs the feature's `request()` call and lands on the
  outcome it maps to.

A new feature adds a `PermissionKind` only if the browser guards something
new; otherwise it picks its kinds, writes its policy and renders a
`PermissionSheet`.

### Location, the cache and freshness

The query cache is persisted to `localStorage` (`hux_query_cache`, through
`queryPersister` in `lib/query.ts`, 24 h `gcTime`), so a reload paints the last
place and weather before any network. The weather key is
`["weather", "v4", lat.toFixed(2), lon.toFixed(2)]`; bump the version segment
when the payload's meaning changes, so a persisted entry is never served as
complete. The provider lives as long as the tab, so a stale time alone
refreshes nothing; something has to ask:

| Data | Stale after | Asked again when |
|------|-------------|------------------|
| IP location | 30 min | mount, the tab coming back (`visibilitychange`), the network coming back, a back/forward-cache restore |
| GPS location | 30 min | mount and the tab coming back, only while a fix may be taken, so a refetch never raises the prompt |
| Weather | 15 min | all of the above; a poll timed to Open-Meteo's next interval (`current.time + interval` + 2 min, clamped 5–60 min, visible tabs only; `nextWeatherPollMs`); local midnight (one forecast day, so yesterday's sun times would stale everything) |
| The clock | n/a | every minute boundary, and at once on `visibilitychange` / `pageshow` (timers do not run in a locked phone) |

**A misplaced IP.** IP databases misplace whole carriers (a phone in San Jose
can come back as Dallas, as can Private Relay or a VPN). The browser's time
zone is a free second opinion: a provider that puts the address in a different
UTC offset is doubted and the next one asked; if all disagree, the first
answer is kept with `timezoneMismatch: true`. The devtool's Sky section shows
who located you, how long ago, and `tz≠` when flagged.

**Asking for the real location.** Nothing raises the browser's prompt by itself
(not a load, a focus or a refetch):

- In Accurate mode a fix is taken only when `canTakeFix` allows: the
  permission reads `granted` (or the browser cannot say), or a fix from the
  primer or palette was recorded in the last day (`locationGrantedAt`,
  `GRANT_MEMORY_MS`), because iOS Safari keeps reading `prompt` after an Allow.
  Otherwise the query *is* the IP one (same key, same cache), so a permission
  Safari reset overnight degrades to the network's guess, not a prompt on load.
  A failed fix falls back to the IP; a refusal clears the record.
- The fix is coarse (`enableHighAccuracy: false`, `maximumAge` 10 min): weather
  is a city-sized question, and it works with iOS's Precise Location off.
- The prompt is raised only by a tap on something that says why: the
  **location primer** (`LocationPrimerSheet`), the command palette's
  Geolocation row (`/` then `C`; a refusal there opens the primer to say where
  to undo it), or [the sky window's offer](./ambient-easter-eggs.md#asking-for-the-window).
- **An IP location is always marked as a guess** in the weather card: the city
  carries an `ip` tag (both screenshots above) where a fix shows its arrow, and
  city and tag are one button to the primer. With `timezoneMismatch` the city
  reads "Dallas?". There is no unprompted notice: the time-zone check misses
  most misplacements, and a toast on every guessed visit would be louder than
  the problem.
- The permission is followed live (`PermissionStatus` `change`): a grant made
  during the visit switches to Accurate; one the page loads with does not,
  since IP was then chosen on purpose. A grant from the primer seeds the
  Accurate query with the fix just taken.

## Constraints

| Constraint | Why | What breaks |
|---|---|---|
| Nothing raises a browser prompt except a tap on something that explains it | A refusal is final everywhere; a prompt with no reason gets refused | Geolocation or motion lost for good on the first visit |
| `request()` is called synchronously from the press, motion before location | WebKit opens its motion gate only inside the tap's task | Motion is never granted on iOS, or two dialogs stack |
| A permission's status is read from what is in effect, never from the wish or the permission string | The facts disagree (Safari's `prompt` after Allow; `granted` with a failed fix) | A sky window opens over the IP's city without asking |
| Sun times are requested as `unixtime` | ISO strings carry the location's wall clock with no offset | Sunrise off by an hour for a location in another zone |
| Bump the weather key's version when the payload's meaning changes | The cache is persisted for a day | Old entries served as if complete |
| The phase is derived from `nowMs`, never set | One clock for the sky, the words and the Dock | A devtool phase that disagrees with the sky (this used to exist) |
| The sky reads the sun's elevation, not the phase | Minute resolution | Six visible steps a day |

## Reference

### Files

```
systems/ambient/
├── provider.tsx                  # AmbientProvider: location, weather, time, solar theme, wallpaper
├── components/
│   ├── surface.tsx               # AmbientSurface: the bezel (vitre) + the full-page wallpaper mount
│   ├── wallpaper-background.tsx  # Full-page wallpaper (image / Sky / CSS), the egg listeners
│   ├── wallpaper.tsx             # <WeatherWallpaper />: the Sky's WebGL canvas shell
│   ├── wallpaper-sheet.tsx       # The wallpaper picker (an AdaptiveSurface)
│   ├── gradient-stack.tsx        # CSS crossfade renderer (full-page + widgets)
│   ├── greeting.tsx              # AmbientGreeting
│   ├── weather-widget.tsx        # The home weather card (header + WeatherNow)
│   ├── weather-now.tsx           # Shared weather body + useDisplayWeather()
│   ├── weather-line.tsx          # One-line weather, lock-screen style
│   ├── weather-icon.tsx          # Condition icons
│   ├── phase-activity.tsx        # AmbientPhaseActivity (Dock Live Activity)
│   ├── solar-theme.tsx           # SolarThemeSync
│   ├── permission-sheet.tsx      # PermissionSheet + usePermissionOffer
│   ├── use-permissions.ts        # usePermissions: status, and one press that asks in order
│   ├── location-primer-sheet.tsx # The offer before the location prompt
│   ├── tilt-primer-sheet.tsx     # The tilt's offer (rain and snow)
│   ├── sky-window-sheet.tsx      # The sky window's offer: motion, and the place with it
│   ├── sky-pull-cue.tsx          # The light at the top while the home is pulled down
│   ├── sky-body-hints.tsx        # Edge hints toward an off-screen sun or moon
│   ├── body-glyph.tsx            # Solid sun and moon-phase glyphs
│   └── settle-spinner.tsx        # The top-right ring while the sky settles
└── lib/
    ├── location.ts               # IP providers, geolocation, reverse geocode, tz check
    ├── weather.ts                # Open-Meteo fetch + condition model
    ├── queries.ts                # useLocationQuery, useWeatherQuery, canTakeFix, poll timing
    ├── sun.ts · phase.ts         # Sun-event windows; deriveAmbientPhase
    ├── greeting.ts               # Time-of-day fallback, greeting keys
    ├── notification.ts           # Upcoming sun event (lead + window)
    ├── solar.ts                  # Sun and moon ephemerides, moon phase
    ├── magnetic.ts               # WMM2025 declination (the sky window's true north)
    ├── solar-theme.ts            # solarThemeAt, SOLAR_HANDOVER
    ├── scene.ts                  # deriveWeatherScene, staging, THEME_KEY, TWILIGHT_LOOK
    ├── gradient.ts               # sceneToCssGradient, getClassicGradient
    ├── color.ts · format.ts      # Colour maths; display formatting
    ├── wallpaper/                # The Sky: shader.ts, renderer.ts, stir.ts, support.ts
    ├── gyroscope.ts              # deviceorientation → gravity; motion access
    ├── sky-window.ts             # The phone as a window: view, projection, compass
    ├── sky-pull.ts               # The pull gesture; skyOpenAction, skyAsksPlace
    ├── sky-bodies.ts             # Per-frame channel: where the bodies are in the window
    ├── settle.ts                 # Named settle reasons (the spinner)
    ├── poke.ts                   # Tapped eggs: arming, cooldown, isBackgroundClick, holdCallout
    ├── wipe.ts                   # The fog wipe's stroke and hand
    ├── tilt-primer.ts            # The tilt primer's press and shouldOfferTilt
    ├── permissions.ts            # motionStatus, locationStatus
    ├── wallpaper.ts              # Kinds, styles, catalog, families, opacity
    ├── wallpaper-play.ts         # Shuffle / Loop
    ├── wallpaper-profile(s).ts   # Profile types; lookups into wallpaper-profiles.json
    ├── legibility.ts             # Profile → CSS variables (docs/system-legibility.md)
    ├── reading-surface.ts        # Which routes are reading pages
    ├── bezel.ts · platform.ts    # Bezel settings and family edges; edge masks, platform checks
    ├── fixed-bg-tracker.ts       # iOS background-attachment polyfill
    ├── settings.ts               # Persisted preferences (hux_ambient_settings)
    └── route-config.ts           # Form-factor types
```

### Hooks

The full shapes are the `*ContextType` interfaces in `provider.tsx`.

```typescript
const {
  locationMode,            // "ip" | "accurate" (the wish)
  location,                // ResolvedLocation | null (source: "ip" | "geolocation")
  permission,              // "granted" | "prompt" | "denied" | "unknown" | null, live
  usingGps,                // Accurate is in effect (false while a wish runs on the IP)
  isLoading, isFetching, error,
  setLocationMode,
  requestAccurateLocation, // may raise the prompt: call from a tap
  refresh,
  isLocationPrimerOpen, openLocationPrimer, closeLocationPrimer,
} = useLocation();

const {
  weather,                 // NormalizedWeather | null
  scene,                   // WeatherScene
  sceneWeather,            // the scene's weather input, for deriving other times
  isLoading, isFetching, error,
  debugOverride, setDebugOverride,     // devtool: { condition } | null
  sceneOverrides, setSceneOverrides,   // devtool Tune: cloud / precip / wind / veil
  refresh,
} = useWeather();

const {
  nowMs,                   // the effective clock: real, or time-travelled
  realNowMs,               // the wall clock
  phase,                   // always derived from nowMs
  sunriseMs, sunsetMs,     // for the effective day
  timeScrubMinutes, setTimeScrubMinutes, // devtool: minutes past midnight, or null
  dayOffset, setDayOffset, // devtool: whole days (moves the moon)
  isTimeTravelActive, resetTimeTravel,
} = useAmbientTime();

const {
  sunTheme,                // "light" | "dark" at the effective clock, or null
  beginThemeHandover,      // stage the next theme change (sky, then chrome)
} = useSolarTheme();
```

`useWallpaper()` is summarised in [Wallpapers](./wallpapers.md#usewallpaper).
The devtool overrides (condition, time, tune) are honoured only while the
devtool is enabled.

### Components

- `<AmbientSurface>` wraps page content: the bezel (`vitre`) around it, and
  `<WallpaperBackground />` behind it when the full-page placement is on.
- `<AmbientGreeting />` says the phase ("Good Morning", "Sun Is Setting";
  `greeting*` keys in `lib/i18n.ts`).
- `<WeatherWidget />` is the home card: city (with the `ip` tag or the fix
  arrow), temperature, condition, sun times. `<WeatherLine />` is the one-line
  form the home can show over the greeting instead.
