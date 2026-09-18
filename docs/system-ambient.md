# Ambient System

The ambient system creates a **living, breathing interface** that responds to real-world context: weather, location, and time of day. Its centrepiece is the **weather wallpaper** — an iOS-lock-screen-style animated sky (sun, moon, clouds, rain, snow, fog, lightning, stars) that tracks the visitor's actual weather and the real positions of the sun and moon, and whose rain and snow fall along the device's own gravity — offered in three styles: Sky, Gradient and Classic. On a thunder day it answers a click with [a bolt](#the-strike-thunder-day-easter-egg) and on a clear night with [a shooting star](#the-shooting-star-clear-night-easter-egg); while it is raining or snowing a drag across the background [stirs up a gust](#stirring-the-wind-rain-and-snow-easter-egg), and on a foggy one a drag [wipes the mist clear](#the-fog-wipe-foggy-day-easter-egg).

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
│   ├── wallpaper-background.tsx  # Full-page wallpaper renderer (image / CG / gradient)
│   ├── wallpaper.tsx             # <WeatherWallpaper /> — the CG sky's WebGL canvas shell
│   ├── wallpaper-sheet.tsx       # Wallpaper picker (an <AdaptiveSurface>)
│   ├── gradient-stack.tsx        # Shared CSS crossfade renderer (full-page + widgets)
│   ├── weather-icon.tsx          # Weather condition icons
│   ├── weather-widget.tsx        # iOS-style weather widget (header + WeatherNow)
│   ├── weather-now.tsx           # Shared weather body + useDisplayWeather()
│   ├── phase-activity.tsx        # Sun-event notification (plugs into the Dock)
│   └── index.ts                  # Component exports
├── lib/
│   ├── weather.ts                # Open-Meteo integration + condition model
│   ├── gyroscope.ts              # Screen-space gravity from `deviceorientation` + motion access
│   ├── solar.ts                  # Sun elevation/azimuth, lunar ephemeris, moon phase
│   ├── scene.ts                  # weather × sun × moon × theme → WeatherScene
│   ├── gradient.ts               # WeatherScene → CSS gradient + crossfade types
│   ├── wallpaper/
│   │   ├── shader.ts             # GLSL: the full-screen procedural sky (CG)
│   │   ├── renderer.ts           # WallpaperRenderer: uniform easing, adaptive quality
│   │   ├── stir.ts               # Drag the background to stir up a gust of wind
│   │   └── support.ts            # WebGL2 / reduced-motion / quality-profile detection
│   ├── strike.ts                 # The thunder-day strike: timing + "is this the sky?"
│   ├── wipe.ts                   # The foggy-day wipe: the stroke, the hand, the gesture
│   ├── greeting.ts               # Time-of-day helpers
│   ├── location.ts               # IP/GPS location resolution
│   ├── notification.ts           # Upcoming sun-event detection (lead-up + window)
│   ├── phase.ts                  # Ambient phase derivation
│   ├── queries.ts                # React Query hooks
│   ├── route-config.ts           # Form-factor types
│   ├── settings.ts               # User preference persistence
│   ├── wallpaper.ts              # Wallpaper kinds, weather styles + built-in catalog
│   ├── wallpaper-play.ts         # Shuffle / Loop over Apple and Nature
│   ├── wallpaper-profile.ts      # Profile types + keys (shared with the profiler script)
│   ├── wallpaper-profiles.json   # The measured table — `pnpm wallpapers:profile`
│   ├── legibility.ts             # Profile → CSS variables (docs/system-legibility.md)
│   ├── sun.ts                    # Sunrise/sunset window detection
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

### Weather Model

Open-Meteo's `current` block is normalised into a condition plus the
measurements the wallpaper actually renders:

```typescript
type WeatherCondition = "clear" | "cloudy" | "fog" | "rain" | "snow" | "thunder";

type NormalizedWeather = {
  temperatureC: number;
  condition: WeatherCondition;
  isDay?: boolean;
  cloudCover?: number;              // 0..1
  precipitationIntensity?: number;  // 0..1, derived from mm/h (or cm/h snow) + WMO code
  precipitationType?: "none" | "rain" | "snow";
  windSpeedKmh?: number;
  windDirectionDeg?: number;
  humidity?: number;
  sunriseMs?: number;
  sunsetMs?: number;
  // …
};
```

The six conditions stay coarse on purpose (they name the mood for icons and
labels); the finer WMO distinctions survive as measurements. So a 40 %-cover
"cloudy" and a 95 % overcast look different, drizzle is not a downpour, and the
wind actually leans the rain.

### Solar & Lunar Geometry

`lib/solar.ts` computes the sun's **elevation and azimuth** for the visitor's
coordinates (NOAA algorithm). This is what makes the wallpaper time-sensitive
at minute resolution rather than in six steps: dawn brightens gradually, the
sun glow tracks east → south → west across the viewport, the horizon warms
through civil twilight, and stars fade in as the sun drops below −6°. Without
coordinates it falls back to an arc estimated from sunrise/sunset (or the local
clock), so a first paint still reads right.

The **moon** uses a low-precision lunar ephemeris (Schlyter, ~1°): topocentric
elevation/azimuth plus the phase from the sun–moon elongation. So the moon
rises, crosses and sets when it really does, a young crescent follows the sun
down in the west while a full moon climbs in the east at dusk, and the phase
matches the calendar (`getMoonPhaseName()` gives the eight-way name). Moonlight
is modelled too: a bright, high moon lifts the night sky and cloud tops and
washes out the fainter stars; cloud cover and fog occlude it. In the southern
hemisphere the crescent is mirrored.

**Staging the moon.** Where the moon *is* comes from the ephemeris and is never
bent. Where it is *drawn* is a composition decision (`stageMoon` in
`lib/scene.ts`), made on purpose:

- The vertical mapping is a stage, not a protractor. A moon a few degrees up is
  already drawn in the strip above the page content, and it climbs from there
  to just under the top edge. Mapping elevation linearly put most of a night's
  moon behind the widget grid.
- Horizontally it crosses east → west with its azimuth (mirrored in the south),
  kept off the extreme edges so a rising or setting moon is never half a moon.
- The daytime moon is intentional and quiet. A first-quarter moon really is up
  all afternoon; here it shows only when well up and far enough from the sun
  to be seen in daylight (elongation over ~40°, so a crescent near the sun
  stays invisible by day, as in the sky), and then as a pale disc at under a
  fifth of its night strength.
- It is drawn up to 30 % larger near the horizon — the moon illusion.

**Drawing the moon.** The disc is the same size as the sun's — both are half a
degree across in the real sky, which is why an eclipse fits — and what makes
the sun read as the sun is the glow around it, not a bigger disc (`DISC_R` in
the shader is the one radius, times the moon illusion above).

It is shaded as a sphere rather than masked as a disc. The phase becomes a
light direction — the phase angle, from the same
elongation the ephemeris gives — and the surface is lit with Lommel-Seeliger,
the backscatter that keeps the real full moon bright right out to its limb,
plus a little Lambert and limb darkening for roundness. The terminator is
therefore a gradient of grazing light, not a cut edge.

The texture is laid out over the visible hemisphere by arc angle from the
centre of the disc, so it foreshortens toward the limb the way a sphere's
does: broad maria (smooth, being flooded basalt), a mottle of highlands, and a
sparse field of craters whose relief is a height field tilting the sphere's
normal into the same light. Detail fades with the size of a pixel's footprint
on the surface — near the limb, and on a small disc — so nothing shimmers.
Like everything else in the Sky engine it is procedural: no texture is loaded.

### WeatherScene

`deriveWeatherScene()` (`lib/scene.ts`) is the single pure function that turns
`weather × sun × theme` into a renderer-agnostic description:

| Field | What it carries |
|-------|-----------------|
| `sun` | elevation, azimuth, screen position, daylight factor |
| `moon` | elevation, azimuth, phase, illumination, visibility, screen position, moonlight |
| `sky` | zenith / horizon colours, sun-glow colour + strength (keyframed on elevation, tinted by condition) |
| `clouds` | cover, density, storminess, lit/shade colours, drift speed |
| `precipitation` | type + intensity |
| `wind` | screen-space direction × strength |
| `fog`, `lightning`, `stars` | 0..1 amounts |
| `veil` | theme blend toward the page background (light: white, dark: `#1a1a1a`) |

Both renderers consume the same scene, so switching engines never changes the
mood — only the fidelity. (The devtool condition thumbnails deliberately keep
the older hand-tuned per-condition palettes so conditions stay distinguishable
at 40 px.)

### Two Engines

| Engine | Where | How |
|--------|-------|-----|
| **Sky** (`wallpaper/`) | The `sky` weather style, full-page, when WebGL2 is available | One full-screen fragment pass: sky gradient + sun glow/disc, twinkling stars, a phased moon shaded as a lit sphere, two parallax fbm cloud decks lit toward the sun, drifting fog, stochastic lightning flashes, wind-sheared rain streaks, five depth layers of slow fluttering snow, theme veil, dither. |
| **Gradient** (`gradient.ts` + `gradient-stack.tsx`) | The `gradient` and `classic` weather styles; widget cards under every style; the Sky's fallback when WebGL2 is missing (or the devtool pretends it is) | Sun-glow radial + cloud wash + zenith→horizon linear gradient built from the scene palette, crossfaded via the layer stack. (`gradient.ts` also keeps the original hand-tuned per-condition palettes for the devtool thumbnails.) |

The Sky engine (`WallpaperRenderer`):
- treats every scene as a **target** — each uniform eases in with its own time
  constant (sky ≈ 1.8 s, clouds/precipitation ≈ 2.5 s), so a refetch never snaps;
- eases *where a body is drawn* far faster (≈0.25 s for the sun and moon): a
  live clock moves them a thousandth of a screen a minute, so that easing is
  only ever felt when a hand drives the clock — the devtool's date and time
  sliders — and there the disc should feel attached to the slider. A real jump
  of the clock still snaps, measured between one **target** and the next: a
  large gap between the target and where the disc has eased to is only lag, and
  snapping on that teleports the disc mid-drag;
- accumulates cloud/snow **drift in JS** from the smoothed wind, so a wind change
  glides instead of teleporting the sky — and the snow takes that wind *slowly*,
  see [Stirring the wind](#stirring-the-wind-rain-and-snow-easter-egg);
- lets a hand dragged across the page add to the wind, same section;
- renders at a **pixel budget** (≈1.1 M px desktop, ≈0.5 M px phones) and backs
  off further when frames run long, recovering when they are cheap — the scene
  is soft, so CSS upscaling is invisible;
- pauses when the tab is hidden, renders a single still frame under
  `prefers-reduced-motion`, and survives context loss;
- fades the canvas in only after the first frame is painted (no black flash).

### Gyroscope Tilt (Sky engine)

Rain and snow fall along **gravity**, not along the bottom of the viewport:
lean the phone and the streaks lean with it, turn it on its side and the snow
crosses the page sideways. A raindrop re-aims in a moment, a flake over
seconds, because a flake has a body and a raindrop barely does. Only the Sky
has drops to lean, so this is a Sky feature; the Gradient and Classic styles
ignore it.

**It is the same vector the wind leans** — see [Wind does not shear the
weather; it tilts the way it falls](#wind-does-not-shear-the-weather-it-tilts-the-way-it-falls),
which is where the four uniforms, the ease and the spring all live. A tilt
moves gravity, a wind adds a term across it, and the weather only ever sees the
sum:

```
fall = g + perp(g) · lean
```

**The gyroscope is a second gravity, not a camera.** This sky is a world held
inside the page: its zenith is the top of the viewport, its horizon the bottom,
the sun and moon cross it where the ephemeris puts them, and the wind blows
across it. Tilting the device does not turn any of that — it tells that world
which way is down, and only the things that FALL answer.

The other reading, where the device is a window and the view counter-rotates,
is a different feature: if the view turns then the sky gradient, the sun, the
moon, the stars, the clouds and the fog all have to turn with it, and it stops
being about rain and snow at all. It would also leave nothing for the weight of
a flake to mean, since gravity in a world seen through a turning window never
moved.

`lib/gyroscope.ts` turns a `deviceorientation` reading into one unit vector —
where *down* is, in the page's frame:

```
g_device = (cos β · sin γ, −sin β, −cos β · cos γ)     // Earth-down, in device axes
```

Alpha (the compass heading) drops out, which is right: which way you face
cannot change which way things fall. The first two components are the part
lying in the screen plane, turned by `screen.orientation.angle` so a rotated
layout still gets gravity down its own page, and blended back to upright when
the screen is too flat to have a direction (a phone on a table).

- **Not React state.** Readings arrive ~60×/s and nothing renders from them, so
  they go from the sensor to `WallpaperRenderer.setGravity()` — one shared
  `deviceorientation` listener, however many surfaces are drawing.

#### Asking for it, on a rainy day

WebKit puts `deviceorientation` behind
`DeviceOrientationEvent.requestPermission()`, which needs a user gesture — so
on an iPhone the whole feature above waits for one tap. Until this, the only
place to make it was the wallpaper picker's Weather tab: three taps from the
page, offering a switch for something the visitor has never seen.

So on a rainy or snowy sky, **resting a finger on the background brings up what
the tilt does, and a button under it asks.** Two presses to reach the browser's
dialog, and the first is why the second gets a yes — a permission prompt that
arrives with no idea what it is for gets refused, and a refusal is final
everywhere: there is no second prompt, only the site settings nobody opens.
The first press buys the explanation; the second spends the one chance.

The picture is the argument. A phone tilts one way and the rain inside it tilts
the other — the same relationship the shader draws at full size, at a size that
fits above a paragraph. Saying "the rain leans" is the part nobody reads.

**Where the camera stands is the whole legibility of it**, and the first
version got that wrong. Drawn in the WORLD's frame — rain fixed, phone turning
— the rain never changes on screen, so the one thing the viewer is meant to
notice is the one thing that never moves. But nobody watches their phone from
the world's frame: it is in your hand, so the screen is what holds still and
the rain is what swings.

So the camera follows the device part of the way. With a device tilt of θ the
phone is drawn at `c·θ` and the rain at `(c − 1)·θ`, with c = 0.45 and θ = 24°:

| | drawn at | what it does |
|---|---|---|
| the phone | c·θ = ±10.8° | tilts, so the cause is on screen |
| the rain | (c − 1)·θ = ∓13.2° | tilts the other way, so the effect is too |
| between them | θ = **24°** | the device's own angle, exactly, at every instant |

Nothing is exaggerated to get that: the two are simply both moving, where at
c = 1 only one of them was. The rain's group is nested in the phone's, so its
own rotation stays −θ whatever the camera does and only the phone's amplitude
carries c — which also means the refusal pose (both still, rain straight down
the screen) now differs from the rocking one in two ways rather than one.

Two more things make the picture hold up, and both are the kind of bug that
only shows at an angle:

- **The rain field is sized by the screen's half-diagonal, not by the screen.**
  It turns under the phone, so a field only as wide as the screen swings out
  from under its own corners — and what you then see cutting the shower off is
  the field's edge, not the phone. 79.2 units about the rock's centre covers
  every corner at every angle, so θ can change without touching it. (The
  viewBox has the same problem from the other side and does *not* get that for
  free: it has to hold the phone at the angle the phone is **drawn** at, c·θ —
  107 × 164 — or the SVG viewport cuts a straight line through the corner.)
- **It is CSS, not a JS animator.** The rain is level only for as long as the
  phone's rotation and the rain's counter-rotation stay exactly opposite, and
  two declarative animations of one duration cannot drift where a dozen
  independently started JS springs can — over a live WebGL sky, on a main
  thread already spoken for. Three animations drive the whole thing whatever
  the drop count, because the rain is a seamless tile stamped three times and
  slid by exactly one tile, rather than an animation per drop. Under
  `prefers-reduced-motion` they are simply paused at 0%, which is a tilted
  phone with level rain — the still frame IS the animation, not a second
  drawing to keep in step.

And it is **a diagram, not a downpour**: eleven strokes evenly spaced, one
length and one weight, about five on screen. It has exactly one thing to say,
and every drop past the few it takes to read as rain competes with it. Even
spacing for the same reason — scattered drops read as a simulation, and a
window showing only two fifths of the field turns scatter into clumps as the
field rotates through it. The fall is slow, because the rocking is the thing to
watch.

**And it stays up to say how it went.** The sheet is the only thing on screen
that can. A refusal especially: the sky simply goes on falling straight down,
and without a word here the only explanation lives three taps away in the
picker's Weather tab — which is the very problem this sheet exists to fix. So
it says it once, with where to undo it, and lets itself out. A grant gets a
word too, shorter, because the phone in your hand is about to do the thing and
the sheet is in front of it.

| outcome | the sheet says | the picture | gone after |
|---|---|---|---|
| granted | tilt is on, lean the device | keeps rocking — it is real now | 1.4 s |
| refused | motion access was refused, and where to allow it again | **upright, rain straight down** — what a refusal actually leaves you with | 3.0 s |
| neither | nothing; the offer is still standing | keeps rocking | — |

"Neither" is WebKit's gate declining to even consider the request (no user
gesture): no dialog was shown and nothing was answered, so the buttons simply
come back.

That the outcome is reportable at all is why `setGyroEnabled` **hands the
access back** rather than only storing it. A toggle can afford to ignore how it
went; a sheet that has to speak cannot.

**It is offered once.** `weatherGyroPrimed` is written the moment the sheet is
answered, either way, and nothing clears it — including a close or a swipe,
which mean the same thing as *Not now*. It is written **before** the asking,
not after: a prompt that is refused, and no browser asks twice, must not leave
the offer armed for the next rainy day, and neither must a visitor who walks
away with the dialog still up. An introduction repeated is a nag, and
this one interrupts a page the visitor came to for something else. It is also
armed by the *absence* of things, so every one of them is a reason to stay
quiet (`shouldOfferTilt` in `lib/tilt-primer.ts`): the offer is spent, or there
is no permission to ask for (everywhere but WebKit the sky is already tilting,
and a refusal already counts as answered), or the visitor went to the picker
and turned tilt off, or nothing is falling, or the Sky is not what paints.

**And it has to sit on iOS's own press first.** A finger resting on the page
starts a ~500 ms clock in WebKit; when that fires, WebKit's gesture recognizer
takes the touch, stops sending pointer events and fires `pointercancel` —
landing right on top of a 400 ms hold and killing it before it can. The fog
wipe has suppressed `-webkit-touch-callout` on `pointerdown` since it shipped,
which is why its hold works on a phone; the primer did not, which is why its
did not. Both now go through `holdCallout()` in `lib/poke.ts`, along with
`TOUCH_HOLD_MS` / `TOUCH_HOLD_SLOP_PX` — one hold, one definition, instead of
two copies of 400/10 and three comments promising they agreed.

The suppression covers the **whole press**, not just the hold: handing it back
the moment the sheet opens would let iOS's own clock run out underneath and put
the callout up over it. It is saved and restored rather than cleared, because
the page sets the property for its own reasons (`.system-surface` does).

> Not verifiable in Chromium, and worth knowing before trusting a test here:
> `-webkit-touch-callout` is WebKit-only and Chromium's CSSOM **drops it
> silently** — `CSS.supports` is false and `setProperty` is a no-op. A harness
> that reads the property back always sees nothing, whatever the code did. What
> can be checked headlessly is that the calls happen at the right moments, by
> spying on `setProperty` / `removeProperty`.

**And only on the system surface.** Those five are about the scene; this last
one is about where the finger landed, so it lives in the recognizer instead:
the press must be inside `.system-surface` — the page that has declared itself
one OS composition rather than a document (see "System chrome / System surface"
in `docs/design-system.md`). The wallpaper is full-page on *every* route, so
without this an article is fair game too — and `isBackgroundPress` cannot tell
the difference, because it asks whether anything **paints** over the wallpaper
and a paragraph paints nothing. On an article the whole column answers
"background", so a finger resting in the margin, or on the prose itself, would
put a permission sheet over what somebody is reading. A long press on a
document belongs to the reader. Keying off the class rather than a list of
routes also means any surface that later opts into being system UI gets this
for free, and no route knowledge lives in the ambient system.

**Not a fourth easter egg**, whatever the sheet's own copy says. The eggs are
rewards for poking at a sky that owes you nothing; this is a feature explaining
itself, and it stops existing once it has been. (The copy greets it as a find
because that is honestly how it arrives for the visitor. The distinction is
about lifecycle, not about how it feels to meet.) But it shares a background with [the gust](#stirring-the-wind-rain-and-snow-easter-egg),
which on a rainy day is armed on that same background — and they cannot
collide, because **a gust is travel and this is stillness**:

| the hand | what it is |
|---|---|
| rests 400 ms, going nowhere | the offer |
| moves at all before that | the gust's, or the scroller's — this stands down for the rest of the press |
| lifts early | nothing |

A hold that has gone nowhere has reported no speed to `attachWindStir`, so
there is no gust to take away. And like the gust, this recognizer never calls
`preventDefault` and never touches a style: a press that turns out to be a
scroll scrolls, on the browser's own fast path. The 400 ms is
`TOUCH_ACTIVATION`'s, the same beat as the widget grid and the fog wipe, so a
visitor who has learned one hold has learned all of them.

The sheet opens from a `setTimeout`, which is *not* a user gesture — and that
is fine, because the gesture WebKit wants is the button inside it, which
reaches `requestPermission()` in the same task as the press.

#### Across gravity, not across the page

A storm's wind is horizontal **in the world**, and horizontal means
perpendicular to the way things fall — which is why the lean is laid along
`perp(g)` and not along the page's own x. Turn the phone on its side and a real
snowfall does not stop being laid over: the whole storm turns with you, every
flake keeping its angle to gravity. Measured, that angle is invariant to
**0.00°** across tilts of 0°, ±30°, 60°, 90° and −45°, for both fields and both
signs of wind.

Holding the wind along the page instead is the other reading, and it is the
wrong one: at ninety degrees the wind would blow straight *down* the fall,
speeding the rain up rather than leaning it — the measured lean collapses from
14.7° to 0.0° as the phone turns — and that is nothing that happens outdoors.
(An earlier draft did hold it across the page, of necessity rather than choice:
while the wind was still a positional offset added to a flake's cell, a term
that turned with gravity would have slid the whole field across the page as the
snow came round. Once the wind became part of the travel that reason dissolved,
and only the choice was left.)

#### Each field re-aims at its own weight

Against a 54° flick of the wrist, held:

| | at 0.12 s | at 0.84 s | at 2 s | at 5 s |
|---|---|---|---|---|
| rain — ease, `RAIN_FALL_TAU` 0.08 s | **97 %** | 100 % | 100 % | 100 % |
| snow — spring, `SNOW_FALL_OMEGA` 0.9 rad/s | 3 % | 21 % | 56 % | **94 %** |

…and no overshoot anywhere: both arrive at 54° and stop.

A raindrop at terminal velocity really does re-aim in a moment — it is small,
fast and already all the way down — so only the fastest flick shows its lag at
all. The snow's is not a slower ease but a **critically damped spring**, and
the difference is what each does at the *start*: an ease leaves at full speed
and decelerates, which reads as drag, while a spring leaves at rest and has to
be accelerated, which reads as mass. Critical damping means no overshoot, and
the integration is implicit, so no length of stalled frame can make it ring.

**One ease and one spring, for the tilt and the wind alike.** A flake's body
cannot know which of the two moved, and a sky where the same flakes came round
at two rates depending on the cause would be a sky with two physics in it. The
constants are the ones the snow's shipped answer to a *change of wind* was
already worth, so a tilt costs the same seconds — slower than a tilt-only draft
of this wanted, and right for the same reason.

**The sensor's own noise is filtered at the sensor.** `SENSOR_TAU` (0.12 s) in
`lib/gyroscope.ts` smooths the reading against the clock, not against a frame
count, because events arrive at whatever rate the device feels like. That lag
belongs to an accelerometer — one at rest on a table still wanders a degree or
so — and not to a raindrop, which is why it is no longer folded into the rain's
own easing.

**The snow keeps its travel, not a clock.** `uSnowFall` accumulates in the
renderer, and that is what lets the direction come round slowly without
dragging the flakes that have already fallen along with it: each one carries on
the way it was going and curves into the new down. (Max-blended frame stacks of
a turn draw exactly that: paths vertical where the flake started, bending over
as gravity takes hold.) The direction is normalised before it is accumulated,
so a fall still coming round loses its aim but never its speed, and the vector
wraps at an hour for the reason the shader clock does — past that, float32 has
no fraction left to place a flake inside its cell with. It is **not**
normalised before it is accumulated: a leaning fall really is a longer one
(gravity plus wind is the hypotenuse), so the vector's length is the speed, and
`uRainFall` carries the same for the rain.

The rain needs none of that: its streaks are sampled in a frame aligned to
`uRainDown` (`fallSpace()`, the one rotation in the shader, because a streak is
a drop's motion blur and has to lie along its travel), and a drop lives a few
tenths of a second and leaves no path behind it.

**A flake's place never depends on where down is.** Only the travel and each
flake's own flutter follow gravity; the cells, the rows and the long waft stay
with the page, because anything positional that turned with gravity would slide
the whole field about as the snow came round, which is the one thing a tilt
must not look like. (The wind is no longer in that list — it left it when it
stopped being an offset and became part of the travel.) Upright, every one of
those lines is the line it replaced: the rendered frame is **bit-for-bit** the
sky without a gyroscope, at every wind and intensity tested.

- **Off under `prefers-reduced-motion`** — that sky is one still frame, so both
  downs snap to the reading rather than animating toward it, and the snow's
  travel is the clock the still frame always read, aimed where it is pulled.

**Access.** Every browser with a sensor fires the event freely except WebKit,
which gates it behind `DeviceOrientationEvent.requestPermission()` *and* a user
gesture. So:

| | Behaviour |
|---|---|
| Chrome / Firefox / Android | The saved wish (`weatherGyro`, **on** by default) is honoured on load; the sky tilts by itself. |
| iOS / iPadOS | The wish waits for one tap — the **Tilt** row in the picker's Weather tab, or the devtool's Sky → Gyro row. Turning it on *is* the gesture that asks. |
| Granted before | `weatherGyroGranted` records it, and access is re-taken silently on the next load. That record is the only reason `requestPermission()` is ever called without a gesture, so a visitor who has never answered is never prompted out of nowhere. |
| No sensor (desktop) | `DeviceOrientationEvent` exists in every desktop browser and fires in none, so "on" is not "working": the provider watches for a first reading and the Tilt row says *no motion readings* rather than pretending. |

### Gradient Crossfade (Gradient engine)

When the scene changes, the CSS gradient must morph — never snap. The
provider keeps a **layer stack** (`gradientLayers`): each change pushes a new
layer, and the shared `<GradientStack />` fades the newest layer in over the
settled one beneath it, then the provider prunes back to the latest.

One renderer (`gradient-stack.tsx`) serves both the full-page fallback and the
per-widget overlays, so they transition identically. The iOS `fixedBgTracker`
(background-attachment polyfill + viewport-relative edge mask) is applied per
layer, so soft-edging keeps working mid-crossfade.

│   ├── poke.ts                   # The two tapped eggs: which weather, how long,
│   │                             #   and "is this the sky?" — asked for all of them
│   ├── wipe.ts                   # The foggy-day wipe: the stroke, the hand, the gesture

`lib/poke.ts` owns the part with no engine in it: which condition is armed
(`armedPoke`), how long each answer lives, how often one may fire, and the one
question the interaction turns on — **did that click land on the sky, or on
something?** It is not a guess: the handler walks from the clicked element up to
`<body>` and the click counts as background only when nothing on the way paints
anything (no background colour, no background image, no backdrop filter) and
nothing on the way is interactive. That is the same question the visitor already
answered with their eyes — the pixel under the pointer was wallpaper — so the
two cannot disagree. A widget card, a link, the dock, an open sheet: all of them
are something. Mark any transparent layer that should still swallow pokes with
`data-no-poke`.

The listener lives in `wallpaper-background.tsx`, on the document, because the
wallpaper layer is `pointer-events-none` and must stay that way — it is behind
the whole page. It listens for `click`, not `pointerdown`, which is what makes
it survive a phone: a click is a press and a release on the same spot, so
scrolling the page with a thumb on the sky never lights it up.

**The Sky is the only engine that answers.** `uPokeKind == 1` drives `strike()`
in the shader: a forked channel drawn top-down out of the cloud base over
~70 ms, landing exactly on the point clicked, flickering through two return
strokes and gone inside 1.2 s. The flash it throws lights the cloud decks the
same way the weather's own `lightning()` does. `WallpaperRenderer.poke("strike",
x, y)` is the entry point.

Under the Gradient and Classic styles the egg **does not exist**, and that is
the decision rather than an omission. A wash has no geometry to draw a channel
on, so the most those styles could offer is the flash without the bolt — a
different and lesser find, dressed as the same one. An easter egg is worth
having only at full strength; where it cannot be that, it should be absent.
The rule generalises: every ambient easter egg belongs to the Sky, and the
wash keeps its one job, which is to be the quiet fallback.

Three things it will not do, all of them deliberate:

- **Not under `prefers-reduced-motion`.** A flash is precisely the motion that
  setting is asking about. The renderer refuses one too, so nothing can route
  around the check.
- **Never a strobe.** One strike per 500 ms, so clicking as fast as you can is
  two flashes a second (WCAG allows three).
- **Only where the sky is.** The weather kind, painting full-page, with the
  shader the engine in use — an image wallpaper has no sky to strike, and a
  wash has no channel to draw. A Sky that fell back to the Gradient for want
  of WebGL2 is disarmed with it.

To see it without waiting for a storm: force **Thunder** in the devtool's Sky
module and click the page background.

### The Shooting Star (clear-night easter egg)

**On a clear night, clicking the star field sends a meteor in off the edge of
the screen and through the point you clicked.** Same grammar as the strike — a tap, a point, a second, no state —
and deliberately the opposite tone: the thunder day answers a click with
violence, the clear night answers it with a wish. The second discovery should
feel like a different joke, not the same one told again.

Armed on `scene.stars > 0.35`, never on `condition === "clear"`. `stars` is not
a proxy for a clear night, it *is* "can you see stars right now": it already
accounts for cloud cover, fog and a bright moon washing the field out. So the
gate falls out correctly for free — a partly cloudy night with stars still
showing gets a meteor, a full-moon night loses it as the field dims, and a
thunder or foggy night can never have one.

`meteor()` in the shader (`uPokeKind == 3`) draws it:

- **It passes through the click**, it is not launched from it. A meteor was
  always already falling; the click only says where you happened to catch sight
  of one. So the path is backed up from the point until it leaves the frame —
  that is the entry, just outside whichever edge it meets — and carried on past
  the point until it burns out or an edge arrives, but never by less than 60% of
  the lead-in. That last ratio is really about *time*: it puts the crossing at
  0.62 of the flight at the latest, so the head is still inside its light curve
  when it gets there rather than past it.
- **Everything about the path is re-rolled per click**: which side it comes from
  and how steeply it falls (20°–70° off the horizon, so never horizontal and
  never vertical), which way it bows, and what *grade* of meteor it is. The
  angle is what decides where on the edge it appears, so randomising it
  randomises the entry point for free. Nothing is held for the session. A real
  shower does share one radiant, and an earlier cut modelled that, but an egg
  you will click a dozen times wants to be unpredictable more than it wants to
  be right — with a fixed radiant every trail pointed back at the same spot.
- **The grade is the reason to click again.** One roll, `pow(hash, 1.8)`, sets
  how bright it is, how big the coma, how far it runs, how slowly it falls, how
  long the train lasts, and whether it flares at all. The skew is the payload:
  the median grade is 0.29 and one in eight is above 0.8, so most clicks give
  something modest and now and then you get a fireball that comes apart.
  Measured over 24 rolls, total light output spans 11× — median 94, top 754 —
  and four of the 24 show a flare as a convexity in their light curve where the
  smooth ones are flat. A real sky is mostly faint quick ones too.
- **Fragmentation flares** (`meteorBurst`) are what a fireball does that a faint
  streak never does: one or two bursts partway down, each brightening and
  swelling the head. They multiply into the light curve, so the train remembers
  a flare as a knot where it happened. Only the top grades get them.
- **A slight bow.** A meteor's track is dead straight in space and projects
  straight onto a narrow field — but this is a wide field, and a wide field
  bends a great circle, so a little curvature is honest as well as prettier. The
  sagitta is 2.5–6% of the run. It is carried as a *circular arc*, which is what
  makes a bowed path cost no more than a straight one: the distance from a pixel
  to an arc and its position along it are both an angle, where for a parabola
  they would be a cubic. The radius is deliberately bounded away from infinity —
  a nearly-straight arc is a huge radius, and float32 cannot subtract those
  accurately.
- **It always bends so the path steepens as it falls**, and that is a choice
  rather than a roll. The real track is straight, so its projected bow could go
  either way and the sign is free — but one of the two reads as wrong.
  Steepening is what diving into thicker air looks like; the other sign flattens
  the far end and reads as a meteor *pulling up*, which nothing falling does. On
  screen it still varies, because which way is "steeper" depends on which side
  it came from.
- **And the bow is clipped to the room the pitch has.** The arc turns
  `8 × bow` radians end to end — up to 27° — which is enough to lift a 20° pitch
  above the horizon at one end, or push a 70° one past vertical at the other. So
  the bow is bounded at both ends by `METEOR_PITCH_FLOOR` / `_CEIL`. That fault
  was found by sweeping the parameter space rather than by rendering samples:
  0.4% of combinations climbed, by up to 7.4°, and another 0.4% curled past
  vertical — rare enough that 48 rendered cases all passed it, common enough to
  be seen by anyone clicking a few dozen times. With the clip the same sweep
  reports zero of either.
- **One pace, not one duration.** The head moves at a fixed speed, so a long
  sweep across the frame takes about a second and a short chord near a corner
  is over quickly — bounded at both ends (`METEOR_MIN_FLIGHT` /
  `METEOR_MAX_FLIGHT`) so the shortest is never a blink and the longest still
  fits the poke's lifetime on a very wide screen.
- **The head crosses the clicked point 0.06–0.73 s in** (median 0.23 s),
  depending on how far away its entry edge was, and the streak itself is on
  screen from ~0.03 s. Something appearing promptly is part of what "fires every
  time" means — an egg that answers late reads as broken just as an egg that
  answers one click in five does — and so is brightness, which is why the head
  is never under about a third of its peak where you pointed.
- **The pace is constant.** A meteor does not slow down, it stops giving off
  light, and those two look nothing alike: an eased path reads as a thrown
  object losing steam, or worse, as an animation curve, and the eye knows that
  signature. The first cut of this eased out over its flight and measured a
  1.5× slowdown — 34 px/frame down to 22 — which was the single loudest tell
  that it was drawn rather than falling.
- **One light curve, asymmetric, peaking somewhere past the middle**
  (`meteorGlow`, re-rolled per click). It climbs as it digs into thicker air and
  is spent faster than it climbed; nothing switches on or off. That curve also
  sets the head's size, so a brightening reads as a swelling coma, and only the
  tip of the peak clips to white — a dozen pixels for a fifth of a second
  instead of the whole first half of the flight, which is what a flat-topped
  envelope was doing.
- **The head is kept small**, which is most of what separates a meteor from a
  comet: what a meteor is long in is its streak, not its head. On a 13" laptop
  it measures about 2 px of white core and 9 px to the edge of its glow, across
  the streak. An earlier cut was a 28 px bright ball inside a 63 px glow —
  nine percent of the screen's height — because the halo carried 0.42 of the
  core over a 3.3× exponential, and an exponential that wide takes a very long
  way to reach nothing.
- **Colour is keyed to the age of the air, not to the wake and train
  amplitudes** (`meteorTint`), and that is the whole trick. An earlier pass gave
  the wake one colour and the train another, and it was invisible: the warm wake
  outweighed the cool train everywhere the train could still be seen, so two
  colours in the source came out as one on screen — measured at saturation
  0.05–0.12 from head to tail, with the blue never appearing at all. Keyed to
  age, the gradient cannot be cancelled by a weighting. Three stages, each
  something different emitting: the head, hot and near white; the metal it has
  just shed, burning sodium-orange a few hundredths of a second later; then the
  air itself, green — the forbidden oxygen line at 557.7 nm, which is the green
  in photographs of real meteors. The stages have to fit inside the first tenth
  of a second of air, because that is all of the streak that is still bright; a
  first attempt spread them over 0.15 s and the green arrived at rgb(7,7,5),
  where there was no light left to colour.
- **Every roll has its own hue**, from a draw of its own, deliberately not the
  grade's — so a faint one can be the blue one and a fireball can be the orange
  one, and two independent draws make many more distinct meteors than one. It
  maps the real thing: sodium and iron burn orange and yellow, magnesium and
  shock-excited air burn blue-white. The oxygen green at the end is atmospheric
  rather than compositional, so every meteor shares it — a signature rather
  than a variable. Measured, the streak now runs at saturation 0.37–0.66 through
  the metal stage and lands green (G clearly over R and B) in the train, in both
  themes.
- **Shape**: a bright head, a short wake right behind it, and a faint, wider
  train beyond that. The wake and the train are the same air at
  two ages, so they come from one walk down the streak — see below. Gone inside
  1.2 s (`POKE_MS.meteor`, which the shader's `METEOR_LIFE` must match).
- **The tail is short, and its two time constants are really lengths.** At
  `METEOR_SPEED`, a tau of 0.1 s is 0.28 of the screen's height, so the decay
  clocks decide how much of the screen the thing covers. An earlier cut ran the
  train at 0.3 s and drew a streak 833 px long on a 945 px-tall laptop — 88% of
  the height, still carrying 34/255 halfway down — which reads as a light beam.
  What the eye sees of a real meteor is a bright dash and a ghost behind it; the
  full path only appears in a photograph, which integrates the whole flight. So
  the wake is a short bright dash (`METEOR_WAKE_TAU`) and the train is a faint
  ghost (`METEOR_TRAIN_GAIN`) whose greater length never adds up to a band. It
  now measures under 300 px at its longest, a third of the height, with the
  bright part inside the first 55 (of an ordinary grade — a fireball is
  brighter and thicker, which is the point of it).
- **The wake also has a floor that is about displays, not meteors.** The dash is
  `tau × speed` long and the head moves `speed/fps` between frames, so what
  decides whether consecutive frames *overlap* is `tau × fps` — the speed
  cancels, and slowing a strobing meteor down does not stop it strobing. A cut
  of this moved the head 44 px a frame behind a 25 px dash, which drew a row of
  separate dashes: broken, and in motion faintly bent, while every still frame
  of it looked right. The wake is therefore never shorter than about two frames
  of travel, taken from `uFrameSec` — the renderer's own measured frame time,
  the same number `adaptQuality` steers resolution by — so a machine that drops
  to 20 fps gets a longer dash instead of a strobe, capped so that the
  adaptation cannot run away and draw the beam back at a few frames a second.
  With that floor in hand the
  pace could come down to something watchable: 25 px a frame, 39 frames of
  flight, against 44 px and 22 frames before.
- **Every point of the train decays on its own clock.** Constant pace is what
  makes that cheap: where a bit of the streak sits says *when* the head made it,
  and so both how old it is now and how bright the head was that made it. Hence
  a train with a bright middle, an old end that goes first, and a thread that
  widens and dims as the air diffuses. The decay is deliberately steeper than an
  exponential (`METEOR_TRAIN_FALL`), because under a plain `exp(-t/tau)` every
  point ages at the same rate once emission has stopped, so the whole profile
  scales by one factor per frame and the thing reads as a rigid stick on a
  dimmer — measurably: first and last point both lost exactly half between
  0.45 s and 0.60 s. Raised to a power, the visible extent collapses from 500 px
  to 200 px over the same interval instead.
- **Drawn over the star field and under the cloud decks**, the opposite of the
  strike's channel: a meteor behind a cloud should be hidden, so a drifting deck
  occludes a lingering trail.
- **Brightness scales with `scene.stars`**, for the same reason the stars' does:
  on a washed-out night the meteor is faint too.

**Sky only, and that is deliberate.** The CSS wash draws no stars at all —
`gradient.ts` builds a sun-glow radial, a cloud wash and a zenith→horizon
linear, and nothing else — so there is no field for a meteor to belong to, and a
streak over a flat night gradient would read as a scratch on the screen. Unlike
the strike, this egg has no honest CSS answer, so it does not have one: on
Gradient and Classic a clear night does nothing. The wash is documented as the
low-fidelity engine and the Sky is the default; inventing a fake for the sake of
parity would be worse than the gap.

To see it without waiting for nightfall: force **Clear** in the devtool's Sky
module, run the clock into the night with the time slider, and click the page
background.

### Stirring the wind (rain-and-snow easter egg)

**While it is raining or snowing, drag a hand across the page's background and
you stir up a breeze.** Stop, or let go, and it dies away and the sky settles
back.

That is the whole of it: **a hand adds a term to the wind**. Everything the sky
does with wind it already knew how to do, so there is no second physics to keep
honest and nothing to hand back when a gesture ends.

Air has mass, and that is the entire feel of it:

| | |
|---|---|
| A hand that stops moving stops making wind | its stir goes stale within a breath, so resting a finger on the page does nothing |
| A flick raises a puff, a long sweep raises a gust | the wind chases the stir over ~0.13 s, so a short gesture never quite reaches full strength |
| Letting go needs no announcement | the stir simply stops arriving, and the wind passes over ~1.6 s |

**It arrives all at once and then passes** — rise and fall differ by twelve
times, which is the shape of the thing. Getting up and dying away at the same
rate is what makes a gust read as a twitch. Measured: a 0.15 s **flick** peaks
at **0.68** within 0.2 s and is still **0.44** a second later and **0.23** at
two; a 0.45 s **swipe** reaches **0.96**; a long sweep saturates at **1.0** and,
from the moment the hand lifts, passes through 0.67 at one second, 0.35 at two
and is gone by six.

The choice of constant is made on *rising or falling*, not on stirring-or-not:
the gust takes the fast one whenever it is asked for more wind than it has —
including a hand that reverses and whips it the other way — and the slow one
whenever it is asked for less, whether because the hand eased off or because it
let go.

`GUST.max` is 1.1 — above the top of the forecast's own range (50 km/h ⇒ 1.0) on
purpose, because a gust is not a wind and is allowed to be briefly harder than
any weather the sky is showing.

#### Wind does not shear the weather; it tilts the way it falls

This is the part worth reading twice, because it is the whole model.

A drop at terminal velocity is a balance: gravity pulling down, drag pushing
back along its travel. Put a crosswind on it and it settles into a new balance
almost at once and falls along the **sum** of the two — the same speed through
the air, aimed somewhere else. So a wind is not a distortion applied to falling
weather. It is a change to **which way down is**, for the things that fall, and
every visible consequence follows from that one vector.

Which is also the model [the gyroscope](#gyroscope-tilt-sky-engine) wants, and
deliberately so. **The two are one expression**, and the weather only ever sees
the sum:

```
fall = g + perp(g) · lean
```

`g` is the unit gravity in page space — `(0, −1)` for a screen lying flat or
held upright, the sensor's reading otherwise — and `perp(g)` is gravity turned
a quarter turn, which is screen-right when `g` is screen-down. A tilt moves
`g`; a wind sets `lean`; both arrive through the same four uniforms:

| Uniform | What it is |
|---|---|
| `uRainDown` | The direction the rain travels. A streak *is* a drop's motion blur, so it has to lie along the travel: the rain is sampled in a frame aligned to this — the one rotation in the shader. |
| `uRainFall` | How far the rain has fallen, in seconds of its own travel. A tilted fall is a longer one, so a gust quickens the rain as well as leaning it. |
| `uSnowDown` | The same direction for the snow, which is a far flatter angle at the same wind. The flutter is measured across it, so a flake's wobble stands up the way it is going. |
| `uSnowFall` | How far the snow has travelled and along what, as a vector of seconds — and the wind's whole sideways effect on the snow, because a flake blown sideways and a flake falling are the same flake. |

**Rotating rather than shearing is the point.** A shear stretches a drop as it
leans it, so past a breeze the streaks stop reading as rain and start reading as
brushwork — and the harder the gust, the worse the smear. That is what made a
hard gust read as a whip-crack rather than as air, and no choice of pivot fixes
it; a rotation leans a drop without ever touching its shape.

**Keeping the travel rather than multiplying a clock by a direction** is what
lets the snow's direction come round slowly without dragging the flakes that
have already fallen along with it: each one carries on the way it was going and
curves into the new one. A page that slides sideways is exactly what a gust must
not look like.

Nothing answers at the same speed, and that is the rest of the feel:

| | How it is re-aimed | Why |
|---|---|---|
| **Rain** | an **ease**, 0.08 s (`RAIN_FALL_TAU`) | A drop is small, fast and already all the way down, so it really is at the new angle within a blink. What is left for the ease to do is keep a slammed gust from cracking: the curtain's far corner sweeps under a screen height a second, against the 1.5–2.5 the rain is falling at. |
| **Snow** | a critically damped **spring**, ω = 0.9 rad/s (`SNOW_FALL_OMEGA`) | Not just a slower ease. An ease leaves at full speed and decelerates, which reads as drag; a spring leaves at **rest** and has to be accelerated, which reads as **mass**. At critical damping there is no overshoot, so the snow never swings past the new direction and back. |
| **Clouds** | never, from a hand | You cannot stir a cloud deck by waving at it. They answer the forecast only. |

Measured against one 0.5 s swipe into a calm sky: the gust peaks at **0.57** at
0.48 s, the rain's lean peaks **with it** at 22° off vertical, and the snow's
goes on rising to 29° at **2.6 s** — long after the air has fallen to a quarter
of its peak — then comes home with no overshoot, still leaning at 6 s and gone
by twelve. That gap is the weight.

One consequence worth naming: **the snow's lean is now the same at every depth
for free.** Both halves of a layer's travel are that layer's own fall speed
times the same vector, so the angle cannot depend on the layer — where before it
took two depth ramps, hand-tuned to span the same 3×, to arrange it.

Three pieces, one per layer:

| Piece | Job |
|-------|-----|
| `lib/wallpaper/stir.ts` | Recognises the gesture and reports the hand's horizontal speed in CSS px/s. |
| `WallpaperRenderer` ("Stirring up a gust", "Where the weather falls") | The air: how a stir goes stale, how the gust rises and falls, and how each field's fall is re-aimed by it. |
| `shader.ts` | Draws it — every wind reaches the weather through the four uniforms above and through nothing else. |

What it deliberately does **not** do:

- **Nothing is `preventDefault`ed and no style is touched.** Every listener is
  passive, so scrolling, tapping, long-pressing and selecting text behave
  exactly as they would without it.
- **Only the horizontal component counts.** Wind here is horizontal, and a hand
  swiped straight down does not make a sideways breeze — which also means an
  ordinary vertical scroll leaves the weather alone.
- **It does not invent a second idea of "the sky".** What counts as background
  is [`isBackgroundClick`](#the-easter-eggs) from `lib/poke.ts`, the same
  question the tapped eggs ask, so no two of them can disagree — and
  `data-no-poke` keeps all of them off.
- **It uses touch events, not pointer events.** A touch drag that turns into a
  scroll fires `pointercancel` and stops sending `pointermove`, which would cut
  the gesture off exactly where it is most fun.
- **It is off** under `prefers-reduced-motion`, off for the Gradient/Classic
  styles (no particles to blow), off in the wallpaper picker's preview tile, and
  off whenever the sky is dry.

### The wind's sign

Every horizontal quantity in the Sky is screen-space, and **positive goes
right**: `wind.x`, the gust a hand stirs up, and the accumulated `uCloudDrift`
and `uSnowFall` travels. `scene.ts` maps the met wind onto that — a westerly (from
270°) blows toward the geographic east, which is screen-*left* in the northern
hemisphere and mirrors in the south — and the shader follows it.

It was not always so. Until the gust landed, the shader read `uWind.x` with the
**opposite** sign in all three places that consume it: the rain's slant, the
snow's drift and the cloud advection. They agreed with each other, so the sky
was self-consistent and nothing ever looked broken — the measured wind simply
blew the whole sky backwards with respect to the compass, which no one can see
without a compass. Adding a gust, whose direction the visitor's own hand
supplies, is what made it visible.

One thing to keep in mind when reading the shader: the travels are
**subtracted** where they are used, because sampling a procedural field further
right is what walks it left. That negation is the convention being honoured, not
broken.

#### A constant is not a wind

The snow's sideways travel used to carry a constant — `snowWind * 0.6 + 0.03` — meant as a
whisper of travel so flakes never fell dead straight in still air. But a
constant added to a wind is a wind that always blows one way: it adds to a wind
going with it and eats one going against. The flakes leant **2.3× further right
than left** at the same wind strength, and under about 2.5 km/h of crosswind the
constant won outright and the snow leant *the opposite way to the rain in the
same sky*. It is gone; the flakes have their own wander (the waft and the slow
beat in `snow()`), and wind → drift is now odd-symmetric to three decimal places
at every strength.

The snow's wind also **starts at the scene's**, not at zero. Easing up from
nothing would mean the first ten seconds of a page had snow falling as if it
were calm while the rain beside it already leant into the forecast.

#### Speed is only half of a wind

The devtool's Sky module has **two** wind rows, `Wind` and `From`, and it needs
both. `wind.x` works out to `speed × sin(from) × hemisphere`: the screen looks
south, so a wind along that axis has no horizontal component at all and **no
amount of it leans the rain or drifts the snow** — at a due-southerly forecast
the speed slider moves `wind.x` from 0.000 to 0.000 at every setting, and only
the clouds change pace. A speed you can set and a direction you cannot is a
control that can look broken while working exactly as written, so
`SceneOverrides.windDirectionDeg` exists too.

**The `From` track runs 270° → 450°**, west through north to east, rather than
0° → 359°. A full turn is not monotonic in anything you can see — it goes calm,
right, calm, left, calm, so the direction you drag bears no relation to the
direction the rain leans. Over this half it is monotonic the whole way: drag
left and the rain leans left, drag right and it leans right, and the middle is
the one bearing with no crosswind in it. The readout carries the arrow, so the
answer is on the row: `270° W ←` … `0° N ·` … `90° E →`.

Nothing is lost by covering half the compass. The sky only ever shows a wind's
east–west component, and `sin(180° − d) === sin(d)`, so every southerly bearing
paints exactly what its northerly mirror does — which is also how a forecast
bearing outside the track is placed on it, by folding onto the one that blows
the same way.

### The Fog Wipe (foggy-day easter egg)

**On a foggy day, dragging across the wallpaper wipes the mist clear along the
path, and the fog closes back over it in a few seconds.** Fog is the one
condition where the medium is literally between you and the view — uniform, in
front, obscuring — so it is the one with an obvious gesture already attached.

- **Tap** → one soft mark of cleared air, about 5.6% of the viewport height
  across at half strength — a fingertip on a misted window, not a fist — with no
  edge to it, thinning away into the mist around it.
- **Drag** → the swath follows the hand along the whole path.
- **Write** → a short word, and then the hand has had enough. See **The hand
  tires** below; that is the size the egg is really for, and the reason is the
  hand rather than an array bound.
- **Close** → every point starts giving back the instant it is made, on an
  exponential with a long tail (`WIPE_DECAY`), and is gone inside
  `WIPE_LIFE_MS`. There is no hold, deliberately: a stroke that sits at full
  strength for a while and then fades is a drawing with a timer on it — you
  watch a finished mark, and then you watch it go. Mist never lets you see a
  finished mark. So the visible life is mostly tail, and the start of a long
  stroke is already dissolving while the hand is still moving.

**A path, not a point.** A fragment shader has no memory, so
`WallpaperRenderer.wipe(x, y)` keeps a bounded ring of the path's recent
*corners* and `fogWipe()` sweeps the swath along the polyline they describe — no
FBO, no second pass, no texture unit; the renderer stays the single full-screen
pass with no textures at all that it has always been. Corners rather than a row
of discs is what makes the trail long enough to write with: one entry buys a
whole segment rather than one dot. Five things make that hold up:

- **The whole path goes in.** A `pointermove` is not one position — the browser
  coalesces everything the digitiser reported since the last one into it, and a
  pen or a trackpad reports several times a frame. Keeping only the newest hands
  the renderer a frame-rate polygon to draw, so a fast curve comes out as the
  chords between wherever the hand happened to be on each frame. Every coalesced
  sample goes through, in order; delivery is still once a frame, because that is
  how often anything can be drawn.
- **Corners are committed by shape, not by distance or by frame.** How far the
  hand has travelled since the last corner, against how far it has actually got:
  equal on a straight run, drifting apart the more the path bows. Past
  `WIPE_SLACK` of drift the straight line the shader would draw has stopped
  being the path, and a corner lands. A straight run never trips it and spends
  one corner per `WIPE_MAX_GAP`, so the trail stays long; a letter spends as
  many as its curves ask for, which is what keeps it off the polygon it would
  otherwise be. On the worst case there is — a circle, where every chord shows —
  the deepest facet left is two or three per cent of the stroke's own width, and
  it does not change when the input rate quadruples.
- **Strokes are separate.** Each corner carries whether it continues the one
  before it, so lifting between two letters does not join them with a line
  across the gap. A move longer than `WIPE_JUMP` is a pointer that went
  somewhere else, not a stroke, and starts a new one.
- **Healing fades as well as shrinks**, per corner and interpolated along each
  segment. Shrinking alone pulls a swath apart into beads.
- **The loop is skipped where the stroke is not.** The live corners' bounding
  box goes to the shader as `uWipeBox`; outside it, a scribble costs one box
  test instead of sixty-three segment distances. Whole tiles fall on the same
  side of that test, which is the one early-out a GPU actually likes.

**What the wipe uncovers.** The point of the gesture is that there is a real sky
up there — on a clear night, a moon and stars. `deriveWeatherScene` has already
thrown both away by the time the shader runs:

```
stars       = night × (1 − smoothstep(0.15, 0.65, cover)) × (1 − fog) × …
moonVisible = … × (1 − smoothstep(0.45, 0.9, cover)) × (1 − 0.8 × fog)
```

On a fog day `cover` is 0.75, which saturates the star term on its own — stars
are exactly **0** — and together with `fog` at 0.9 it leaves the moon at 0.07.
So clearing the fog uncovers nothing, and the whole promise of the gesture goes
with it: you wipe, and there is no sky behind.

The scene therefore hands over the unhidden version too, as `scene.behind`: the
same stars and moon with neither the fog nor the deck a fog day puts in front of
them. The shader works the wipe out first — before anything is composited, since
stars and the moon are drawn at the very back of the frame — and lerps toward
`behind` by how much of the murk that fragment has lost. Three things yield
together, all of them gated on `uFog` so no other sky can be touched:

- **The fog**, which is the wipe proper.
- **The deck**, because on a fog day the deck *is* the murk — the profile
  carries three quarters cover with a white lit colour precisely because fog
  reads as overcast. Leave it standing and there is nothing to see: by day the
  mist and the cloud above it are the same white, and by night the deck is what
  buries the stars.
- **The night sky** — `uStarsBehind` and `uMoonBehind` — so a swath drawn across
  a foggy night opens a band of stars, and one drawn across where the moon
  really is uncovers the moon. They arrive at the brightness a clear sky would
  have given them, which is the test: a stroke across a foggy night lights the
  same pixels, as brightly, as the unfogged sky does.

**Nothing about it is a circle**, because a circle in fog reads as a lens. The
field is looked up through a domain warp made of the same drifting noise the fog
itself is made of; the width is pushed around by two more scales on top of that
— big lobes, then a fine tear — and a third leaves streaks of mist standing
inside the swath. It is wiped, not deleted, and it keeps moving with the mist
rather than sitting on top of it.

**And it is carried off, by the same door the rain and the snow come in.** A
cleared patch is a hole in something that is moving, so it goes downwind and
settles as it ages — the old end of a stroke has travelled further than the new
end, and the stroke shears rather than sitting still. The displacement is
resolved in `aimWipe`, against gravity exactly as a fall is (see **Wind does not
shear the weather** above): the wind **across** gravity, the settle **along**
it, and the gust in the sum because it is wind. So a tilted phone leans the
drift as it leans the weather — measured, the displacement turns rigidly with
gravity and keeps its length — and an upright calm sky is the plain downward
settle it was before there was a gyroscope to ask.

**The hand tires.** Wipe a misted window for real and you do not get to keep
wiping: the hand cools, the finger picks up what it took off the glass, and the
same stroke stops coming up clear. Rest a moment and it works again.

That is the difference between a wallpaper that answers you and a drawing board
— a board's ink is the same on the hundredth stroke as on the first, and no
amount of prettiness in the swath fixes that. Only running out does.

`lib/wipe.ts` owns it, and both engines use the same hand on the same terms:

- **Spent by the distance rubbed** (`WIPE_DRAIN`, an e-fold rate per screen unit
  of path), with a floor (`WIPE_SPENT`) — a hand that has had enough still
  smears a little, and wiping while almost nothing happens is the effect rather
  than a failure of it. Half a screen leaves about half; one sweep across leaves
  a quarter; two screen-heights of path is the floor. The budget is deliberately
  tight enough to be felt **inside the first stroke** — a hand that tires is
  only worth having if you can watch it tire.
- **Recovered by time off the glass** (`WIPE_RECOVER`), where "off the glass"
  means a gap longer than `WIPE_REST_S`. So a slow, careful stroke tires it
  exactly as much as a fast one — it is the rubbing that does it, not the clock
  — and holding still mid-stroke gives nothing back.
- **It belongs to the hand, not to a stroke.** Lifting between two letters does
  not refill it; only waiting does.

Each corner keeps whatever the hand had when it was made, so the falling-off
runs *along* the path — the far end of a long stroke comes up markedly less
clear than the near end did — rather than dimming the whole of it at once. It is
strength and not width: a tired hand covers the same ground, it just stops
bringing anything up. The charge rides in the sign-and-magnitude of `uWipe[i].w`,
whose sign was already carrying the new-stroke flag, so it costs no bandwidth at
all.

**And nothing about it has an edge.** The swath is a Gaussian falling off from
the path, and one field drives the whole effect — the fog, the deck, the stars,
the moon, the scattering. That is the difference between mist and a mark:
anything with a shoulder draws an outline, and an outlined stroke is the most
pen-like thing there is. A disc with a soft edge has one. A core term unioned
with a wider halo term has two. Mist made to bead along the boundary — which is
true of a real misted window, and was in here for a while — paints the outline
in the brightest thing on screen. A Gaussian has no shoulder at any width, and
no boundary anywhere to put an outline on: it is a density, falling off forever,
which is what mist around a wiped patch actually is.

**The Sky is the only engine that answers**, on the rule the strike sets out
above: a wash has no fog layer to thin and no sky behind it to uncover, so the
most it could offer is a smudge dressed as the same find. The fog term's `fa`
yields along the stroke, the deck goes with it, and the night sky the murk was
hiding comes back — plus the one mark a hand leaves on a misted window that
survives having no edge: clear air scatters less, so the swath sits a shade
darker than the mist around it.

What it will not do:

- **Not under `prefers-reduced-motion`.** A judgement call, written down rather
  than inherited: a slow fog clear is gentle and not the hazard a flash is, but
  the setting is about motion generally, and under it the renderer draws one
  still frame and has no loop for a wipe to live in anyway.
- **Not fight the page.** On a mouse the wipe waits for the slop, which is what
  keeps a click, a double-click and a word-select on the sky working as they
  did. On touch it waits for a hold — see below. Once it is a wipe, selection is
  suppressed for the duration: a hand dragged across the sky should not leave a
  blue smear of whatever text it crossed. It never starts on a widget, so
  dnd-kit's sorting is untouched; dragging *over* one keeps wiping, because the
  mist does not care what is in front of it. It stands down entirely while the
  home grid is in jiggle edit mode, where a tap on the background means Done.
- **Not persist.** Nothing survives a reload or a route change. It heals; that
  is the whole shape.

#### Touch, where scroll has first claim

A finger on the sky is ambiguous — it could be a scroll — and **the ambiguity
cannot be resolved by watching which way it goes.** `preventDefault` on a
pointer event does not stop scrolling; only a non-passive `touchmove` does, and
only before the scroll has started, which on iOS means before the finger has
moved at all. By the time a direction is readable it is too late. (An earlier
version gated on horizontal movement, which both leaked scrolls and — since a
letter is mostly vertical strokes — made the thing unwritable on a phone.)

So the question is settled while the finger is still still, exactly the way this
site already settles it for the widget grid: **a long press arms it**
(`TOUCH_ACTIVATION` in `components/ui/sortable-order.ts`; the wipe uses the same
400 ms, so both hands-on gestures here wait the same beat).

- Nothing is bound and nothing is blocked until the hold is good. Until then the
  page scrolls on the browser's own fast path — the non-passive `touchmove`
  listener is attached when a stroke arms and removed when it ends, never while
  one is merely possible, because a listener sitting on the document makes the
  browser wait for JS on every scroll frame.
- The finger drifting past `WIPE_ARM_SLOP_PX` before the hold is good means it
  was the scroller's all along. Nothing was taken, so nothing has to be handed
  back.
- Arming opens the mist under the finger. That is the only "ready" tell there
  is, and the only one worth having: it is the effect itself.
- **Writing is letters**, and holding before every stroke of every letter is not
  writing — so for `WIPE_RESUME_MS` after a stroke ends, a touch landing within
  `WIPE_RESUME_NEAR` of where it ended arms at once. Proximity is what buys back
  most of what the open window gives away: the next stroke of a word starts
  about where the last one finished, a flick meant for the scroller usually does
  not.
- A second finger is a pinch, or a scroll starting over. Either way it is not
  one hand drawing, so the gesture is given back rather than fought for.

Verified end to end against the real page under touch emulation:

| gesture | page scrolled | stroke |
|---|---|---|
| plain swipe up | 245 px | none |
| swipe starting after 250 ms (under the arm) | 245 px | none |
| hold 520 ms, then draw straight **down** | **0 px** | drawn |
| straight into another stroke, no hold | **0 px** | drawn |
| plain swipe up, after the window | 245 px | none |

To see it without waiting for the weather: force **Fog** in the devtool's Sky
module and drag across the page background — on a phone, press and hold there
first.

### Phase Notification

A heads-up that the ambient phase is about to change to sunrise/sunset. It is a
**Dock Live Activity** (see `docs/system-dock.md`), not a bespoke widget:

- **Pill** — a sun-event icon + the exact event time (e.g. `🌅 05:46`).
- **Panel** — unfolds into the shared `<WeatherNow />` body, the same readout the
  homepage weather widget uses.

Visibility (`lib/notification.ts`): from ~90 min before the event through the end
of its ±45 min window, then it hands off to the gradient + greeting. A forced
sunrise/sunset phase from the devtool also surfaces it for testing.

### The theme follows the sun

The app's theme follows the day: Light while the sun is up, Dark once it is
down. On by default (`themeFollowsSun` in the ambient settings), turned off in
the wallpaper picker's Weather group, in the command palette (`/s`), or in the
devtool's Sky module.

**At the sun's own crossing — the middle of the long animation, not its end.**
Sunrise and sunset are ±45 min windows here and the sky spends all of both
moving; the moment it moves fastest is the middle. A theme change is a cut
however gently it is painted, and a cut lands softest inside motion: at the end
of the window the sky has settled again, and the same cut stands out against
it.

```
dark ─────┬──── sunrise ────┬───── light ─────┬──── sunset ────┬───── dark
      rise-45      ▲     rise+45          set-45      ▲     set+45
                   └ here                             └ here
```

`solarThemeAt()` (`lib/solar-theme.ts`) is therefore the plain rule — light
between sunrise and sunset, dark outside, null when the sun times are unknown
(and then nothing switches). Everything about *how* it changes hands is in
`SOLAR_HANDOVER`.

**The handover puts the cut in the middle of a short animation too**, so it has
motion on both sides of it. The timeline is `SOLAR_HANDOVER` in
`lib/solar-theme.ts` and the numbers live only there:

```
0           the sky starts moving to the new theme — the wallpaper stack
            crossfades over `skyMs` instead of its usual 0.7s, and the Sky's
            shader is put on the same clock by `setThemeEase`.
chromeAtMs  halfway through, the chrome changes: one commit, inside a view
            transition, so the page crossfades as a single composited image —
            the same 200ms a route change uses.
skyMs       the sky settles, and the notice lands.
```

`wallpaperTheme` is what makes the lead possible: the scene, the wash's weight,
a picture's half and the profile of what is painting all read it, while
everything that belongs to the chrome — the page ground, the bezel, the ink
ladder — reads `chromeTheme`, which is what the provider calls the theme the
app is actually in. The lead runs for exactly the sky's animation and outlives
the switch in its middle; a theme the user picks while it is running calls the
whole thing off, sky included: theirs wins.

The greeting is not part of this. It follows the phase, which changes at the
window's *ends*, three quarters of an hour either side of the switch — far
enough that the two never read as one event that failed to line up.

The chrome's half is deliberately **not** a transition per element. That was an
earlier cut of this, and it cost ~1.2s of style recalculation for a 1s dissolve
— a page this size has ~1000 elements and their colours are `color-mix()` over
custom properties, so every frame re-ran the document's style. The composited
crossfade is ~60ms of capture for the same effect, and where it is unavailable
(Firefox, `prefers-reduced-motion`) the chrome simply changes, which is what the
rest of the app does when the user picks a theme.

Three more rules make it a system gesture rather than a setting changing behind
the user's back:

1. **Only a crossing watched live.** `<SolarThemeSync />` remembers which side
   of the day it last saw and acts when that changes *while it is mounted*.
   Arriving after dark does nothing; sitting on the page through dusk does.
   That is what "in the same session" means — the sun may interrupt you, it may
   not greet you.
2. **A session override, never the preference.** It sets the theme service's
   `override` (`services/theme.tsx`), which lives in sessionStorage: a reload in
   the same tab keeps the theme the sun set — unless the sun has moved on since,
   in which case the stale override is dropped on the way back in — and closing
   the tab forgets it. The saved Appearance preference never moves, and any
   explicit choice (the palette's Appearance command, a toggle) ends the
   override. Turning the setting off takes an active override with it.
3. **It says so.** Once the handover has settled, the small pill in the
   bottom-center toast slot — the one the language switch uses — names the mode
   and says the preference is unchanged. By then the change has already
   dissolved in over two seconds, so there is nothing to confirm and nothing to
   undo in a hurry; the way to turn it off is where settings live.

Because the rule reads the ambient clock, **devtool time travel crosses it
too**: playing the day in the Sky module crosses sunrise and sunset for real,
and the theme changes there exactly as it would on the real clock — or does
not, if the setting is off. The Sky module carries the toggle beside that
timeline for the same reason.

## Wallpaper

The background is **one layer stack fed by exactly one source**:

```typescript
type WallpaperKind = "weather" | "image";
```

- `weather` — the live sky, in one of three **styles** (`weatherStyle`):

  | Style | Name | Subtitle | What it is |
  |---|---|---|---|
  | `sky` | **Sky** | shader · webgl | The WebGL shader (`lib/wallpaper/`): the whole scene, animated, at full strength. Needs WebGL2. |
  | `gradient` | **Gradient** | css · gradient | The same scene as a CSS gradient (`sceneToCssGradient`): the sky's colour at the real sun position, live to the minute. The Sky's automatic fallback. |
  | `classic` | **Classic** | css · gradient | The original: six hand-tuned condition palettes by day and night plus the sunrise / sunset event gradients (`getClassicGradient`). Steps at phase and weather changes rather than following the clock. Chosen by hand only. |

- `image` — a picture from the built-in catalog (`lib/wallpaper.ts`), either
  pinned to one still or playing Shuffle / Loop over Apple or Nature.

Style and engine are one-to-one: Sky is the canvas, the other two are the CSS
stack. The only resolution is the fallback — `resolveWeatherStyle` turns a Sky
without WebGL2 (or with the devtool pretending there is none) into the
Gradient — and `useWallpaper().effectiveStyle` / `.renderer` say what won.
Widget cards always paint the CSS stack: the Classic palette under Classic,
the scene gradient under the other two.

Because there is a single stack and a single kind, the two are **mutually
exclusive by construction** — there is no state in which both paint, and nothing
has to arbitrate between them. Switching kind pushes a new layer, so
weather → image dissolves through the same crossfade as a weather change.

The sun-event Live Activity is unaffected: it renders in the Dock from the
clock and never reads the background, so sunrise and sunset still announce
themselves under an image wallpaper.

### Built-ins

Three categories, switched in the picker with the same capsule the Featured
Talks widget uses for albums (`WALLPAPER_CATEGORIES` in `lib/wallpaper.ts`).

- **Weather** — first, and the live one. Three tiles: **Sky**, previewed by
  a small live canvas running the shader at a tile-sized pixel budget (the one
  wallpaper that moves should move in its tile); **Gradient**, previewed with
  the very gradient the page would paint; and **Classic**, previewed with the
  palette for this condition and hour. Every tile wears a chip: Live on the two
  realtime styles, Preset on Classic. Where WebGL2 is missing the Sky tile shows the Gradient with a note,
  which is also what choosing it would paint.
- **Apple** — the default macOS, iPadOS and iOS wallpapers as light/dark pairs,
  the artwork each release is recognised by. Seventeen pairs: macOS Golden
  Gate, Tahoe, Sequoia, Sonoma, Ventura, Monterey, Big Sur, Catalina and
  Mojave; iPadOS 26 and iPadOS 18 in its four colourways (Violet, Indigo,
  Blue, Teal); iOS 15, 14 and 13. Every pair ships a @1x cover beside the
  full @2x (or native) file when the source is larger than 1×. The grid
  opens with **Shuffle** and **Loop** — iOS Photo Shuffle (a fanned collage,
  random order) and macOS Change Picture without Randomly (a tidy stack,
  catalog order). They sit as their own pair above the stills, and while
  either is selected a Frequency row sits directly under them: On Visit
  (iOS On Lock, once per tab session), Hourly, and Daily. Tapping a specific
  pair pins it and turns play off.
- **Nature** — the 19 Mac OS X Nature desktop pictures (Aurora, Zebra, Zen
  Garden, …), taken from ryOS. One photograph each, so both theme halves are
  the same file (`isSingleImage()`), and the picker shows it unsplit. Clown
  Fish and Ladybug are omitted. Shuffle and Loop sit at the front of this
  album too, walking only Nature.

The iPadOS colourways are named for the colour rather than the release, and
their caption is the year alone: the tile would otherwise read "iPadOS 18
Violet — iPadOS · 2024", which both stutters and overflows.

The **iOS** pairs are phone artwork, so the picker caption marks them with a
phone glyph — the tiles are all the same 16:10 card and could not otherwise
show it. `isPhoneWallpaper()` derives it from the platform rather than storing
a flag. Apple ships these stills on a square canvas and lets the device crop
(iOS 14 is 3072², iOS 15 2916², iOS 13 3208² at source); nothing here was cropped.

#### Resolution

Every wallpaper paints `cover`, so the rule is about the stretch on a real
screen, not megapixels: **a full-size file is the smallest cover of a 2560×1600
viewport at 2× (5120×3200 device pixels), never upscaled past the source.** A
matching `@1x` cover (`.1x.webp`) ships beside it whenever that is smaller, so a
1× display does not download the retina file. Sources that cannot cover 2×
(most Nature stills are 2560×1600 at source) keep a single file. Each tile
prints the committed full file's pixels under its name.

| | Full file | @1x | Stretch at 1× |
|---|---|---|---|
| macOS Golden Gate | 4480×3088 | 2560×1765 | 1.00× |
| macOS Tahoe … Big Sur, Catalina | 5120×5120 | 2560×2560 | 1.00× |
| macOS Mojave, Earth & Moon | 5120×2880 | 2844×1600 | 1.00× |
| iPadOS 26 landscape | 2752×2064 | 2560×1920 | 1.00× |
| iPadOS 18 | 3840×2668 | 2560×1779 | 1.00× |
| iOS 15 / 14 / 13 | 2916² / 3072² / 3208² | 2560×2560 | 1.00× |
| Mt. Fuji | 3200×2000 | 2560×1600 | 1.00× |
| Nature (the rest) | 2560×1600 | — (same file) | 1.00× |
| iOS 17 | 2048×2048 | | 1.25× — removed |
| iOS 18 / 27, portrait iPadOS 26 | too tall/narrow | | omitted |

The landscape Nature photographs still stretch about 1.64× on a 3× portrait
phone; the source is 1600px tall and we never upscale.

ryOS serves each photograph as one original JPEG (Aurora is 1.3MB, Snowy Hills
2.3MB) plus a picker thumb, and paints a 24px blur-up while the JPEG decodes.
We encode `@1x` / `@2x` covers so a 1× display does not download a 5K file, at
WebP q95 with 4:4:4 chroma (q90 only when a file would exceed ~1.8MB per
2560×1600 megapixel — Zen Garden's raked sand). `pickWallpaperSrc()` chooses
the smallest rendition that covers the current viewport × DPR. The desktop
paints the 480px picker thumb immediately and fades the chosen file in over it
once it has decoded — the same blur-up, using a thumb we already ship.

Release pairs are WebP q80. Photographs — Nature, and the Catalina / Mojave
pairs — use the photo pipeline. The byte budgets differ by kind: a graphic pair
past 2MB at 2× means something went wrong (Big Sur dark is a grainy illustration
around 1.2MB), while a photograph of raked sand is
detail all the way down, so photographs get 8MB at 2×. Provenance for every
file lives in `public/wallpapers/sources.json`.

High-resolution originals were collected from wallpapers.poutanen.dev (macOS 6K
graphics Tahoe–Big Sur, iOS 13 3208², iOS 14 3072²), 4kwallpapers.com (Golden
Gate native 4480×3088 — the 6016×4147 "6K" files are a uniform upscale of that
pair and are not used — Catalina 6016×6016, Mojave 5120×2880, iOS 15 2916×2916),
static.applewalls.com (iPadOS 26 landscape), LAYTAT/macOS-Wallpapers and
Deeeee-macOS-Wallpapers (`/System/Desktop Pictures` dumps), with 512pixels.net
6K files skipped as hand-upscales. Portrait iPhone lock-screens never cover
2560×1600.

```bash
pnpm wallpapers:encode              # fetch sources.json and rebuild WebP @1x/@2x
pnpm wallpapers:encode golden-gate  # rebuild one release pair marked `"encode"` in sources.json
pnpm wallpapers:check   # every file present, sharp enough, sized as declared, within budget
pnpm wallpapers:profile # measure every wallpaper for the legibility system (commit the table)
```

Every wallpaper — the weather gradients included — also has a static
**profile** (`lib/wallpaper-profiles.json`): its lightness by band, how busy
it is, its dominant colour. The legibility policy reads that at runtime
instead of the pixels; see [docs/system-legibility.md](./system-legibility.md).

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
| Weather · Sky | 1.00 | 1.00 |
| Weather · Gradient | 0.70 | 0.85 |
| Weather · Classic | 0.70 | 0.85 |
| Image wallpaper | 1.00 | 1.00 |

Keyed by the family of what is *painting*, not what was asked for: a Sky that
fell back to the Gradient is a wash. The Sky paints at 1 because
its theme veil is mixed inside the shader; the restraint happens in the scene.

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

**Each wallpaper family says what it wants at the edge.** A look (`getWallpaperLook`
in `lib/wallpaper.ts`) belongs to a family — `picture` (an image, the Sky) or
`wash` (the CSS styles) via `WALLPAPER_LOOK_FAMILY` — and the family keys both
the opacity and the edge table (`WALLPAPER_FAMILY_EDGES` in `lib/bezel.ts`).
On an iOS phone the provider resolves every page from that, live, as the look
changes:

| Look | Bezel | Soft edge |
|---|---|---|
| Weather · Sky | on | off |
| Weather · Gradient | off | on |
| Weather · Classic | off | on |
| Image | on | off |

A CSS weather wash is the page's own colour pushed outward, so it fades back
into the ground. A photograph is a picture on the page, so it ends on a line
inside a bezel. The Sky is a picture too — a rendered one — and gets exactly
the image configuration, so the two framed looks start from one place (and
the boot script keys on the saved style, not on WebGL support, so a Sky that
falls back to the Gradient keeps its frame rather than flickering). A desktop
window gets none of it unless overridden. Session edge overrides are stamped with the family they were set under, so a
change of family (a kind switch, or Sky ↔ a CSS style) ends them.

**The bezel** is `@hux/bezel` (`packages/bezel`), after ryOS (os.ryo.lu): one
flat colour around the page, black by default, with the page rounded off inside
it and, on iOS, scrolling in a container while the document holds still. A
devtool override turns it on or off for the session and ends when the kind
switches. Tint, band and radius are saved settings shared by both kinds (black,
0px, 16px by default). Everything is live, including the browser chrome. See
the package README for what Safari does and why.

**Soft edging** — the top/bottom fade — applies only while the bezel is off.
An image wallpaper is just another layer in the stack, so when it is on it
gets the same mask the weather gradient gets (`EDGE_FADE_MASK`, or the wider
`EDGE_FADE_MASK_HIGH_CONTRAST` for dark-mode sunrise/sunset). The devtool
switch overrides it either way.

### Triggers

| Surface | How |
|---------|-----|
| Command palette | `Wallpaper: <name>` / `Wallpaper: Weather · Sky` (⌘K), or `/` then `W` |
| Devtool panel | Wallpaper module — the whole background system in one place |
| Anywhere in code | `useWallpaper().openPicker()` |

The picker itself is a secondary window (`wallpaper-sheet.tsx`) built on
`<AdaptiveSurface>` (see [Surface System](./system-surface.md)), mounted once in
the root layout and shaped like the music playlist sheet: a bottom action sheet
on narrow viewports, a right-edge floating panel on wide ones.

Its tiles are **macOS Settings pair cards**: a 16:10 split of the light and dark
originals, a sun / moon marking each half, a check when selected, and `Name` +
`macOS · 2020` underneath. Apple and Nature each lead with Shuffle and Loop
tiles in that same frame — a three-photo collage, fanned for Shuffle and
stacked for Loop — matching iOS Photo Shuffle and macOS Change Picture. The
two modes are a pair above the stills, not mixed into the catalog grid, so
Frequency can sit directly under them (On Visit / Hourly / Daily) instead of
after the last picture. The Weather category's three tiles are the **same
frame at the same size** — the sky is one of the wallpapers, just the only one
that moves, and it opens on that tab whenever the sky is what is in use. Where
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
  scene,               // WeatherScene — what both engines render (lib/scene.ts)
  sceneWeather,        // The scene's weather input, for deriving other times
  isLoading,
  isFetching,
  error,
  debugOverride,       // { condition } | null — devtool, condition only
  setDebugOverride,
  sceneOverrides,      // devtool tweaks: cloud / precip / wind / veil
  setSceneOverrides,
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
  weatherStyle,           // "sky" | "gradient" | "classic" — the persisted choice
  selectWeather,          // Selects a style AND switches kind to "weather"
  effectiveStyle,         // The style painting: Sky becomes Gradient without WebGL2
  renderer,               // "shader" | "css" — the engine behind it
  shaderSupported,        // WebGL2 probe result
  reportShaderFallback,   // <WeatherWallpaper /> → provider on a WebGL failure
  statsRef,               // Live renderer stats for the devtool
  gyro,                   // { enabled, access, active, readings, gated, denied, supported }
  setGyroEnabled,         // The wish — and, from a tap, WebKit's motion grant
  wallpaper,              // The selected pair (the frame showing, even while playing)
  wallpapers,             // The whole catalog
  selectWallpaper,        // Pins a still AND switches kind to "image"; play turns off
  selectPlay,             // Shuffle / Loop over Apple or Nature
  play, playAlbum, playEvery, setPlayEvery,
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
  opacity,                // Resolved for what is painting (look) and theme
  veil,                   // The flat veil alpha over an image (reading pages)
  blurred,                // Whether this route defocuses the wallpaper
  bezel,                  // Whether the bezel is drawn (kind, or a session override)
  bezelTint, bezelBand, bezelRadius,  // Saved settings, and their setters
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
  nowMs,               // The effective clock — real, or time-travelled
  realNowMs,           // The wall clock, untouched
  phase,               // Always derived from nowMs; there is no phase override
  sunriseMs,           // For the effective day
  sunsetMs,
  timeScrubMinutes,    // Devtool: minutes past midnight, or null
  setTimeScrubMinutes,
  dayOffset,           // Devtool: whole days (moves the moon)
  setDayOffset,
  isTimeTravelActive,
  resetTimeTravel,
} = useAmbientTime();
```

### useSolarTheme

```typescript
const {
  followSun,           // The setting — on by default, saved with the ambient settings
  setFollowSun,
  sunTheme,            // "light" | "dark" at the effective clock, or null when unknown
  beginThemeHandover,  // Stage the next theme change (slow sky, then chrome)
} = useSolarTheme();
```

The provider only says what the sun implies; `<SolarThemeSync />` (mounted in
the root layout) is what watches it cross and applies it.

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
the clock (nowMs) + lat/lon → sun & moon                    ↓
        ↓                                                    ↓
deriveWeatherScene → scene                     getWallpaperBackground
        ├── sky:      <WeatherWallpaper /> (WebGL)           │
        ├── gradient: sceneToCssGradient ─────┐              │
        └── classic:  getClassicGradient ─────┼──────────────┘
                                      ▼
                    wallpaper.layers (one stack, crossfaded)
                                      ▼
              WallpaperBackground (full) / WidgetShell (widget)
```

Both branches feed the same stack, which is what makes "one background at a
time" a structural property rather than a rule. The Sky's canvas is the one
exception to "everything is a layer": it paints the full-page slot directly
from the scene, while widget cards keep painting the gradient of that same
scene.

The sun-event phase runs alongside this and never touches the background:

```
phase    → AmbientPhaseActivity → Dock Live Activity
sunTheme → SolarThemeSync       → theme override (this session) + notice
```

## Caching

- **Location**: 24 hours (IP doesn't change often)
- **Weather**: 45 minutes (weather changes more frequently)
- Persisted to localStorage via React Query
