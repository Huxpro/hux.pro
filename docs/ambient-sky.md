# The Sky

The weather wallpaper: an iOS-lock-screen-style animated sky (sun, moon,
clouds, rain, snow, fog, lightning, stars) that tracks the visitor's real
weather and the real positions of the sun and the moon, with rain and snow
falling along the device's own gravity. This page is how it is drawn. Where
its inputs come from is the [Ambient System](./system-ambient.md); the things
it does when you touch it are [the easter eggs](./ambient-easter-eggs.md);
the styles, the picker and the pictures are [Wallpapers](./wallpapers.md).

## What it looks like done well

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-ambient/home-night.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The phone home screen on a clear night under the Sky: a deep navy gradient with a field of small stars behind the greeting and widgets." />
  <img src="/img/docs/ambient-sky/night-rain.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same hour in rain: the stars are gone under a low grey deck, and thin rain streaks lean slightly across the page." />
</div>

The same place and hour (San Francisco, 22:30) under two forecasts: clear,
then moderate rain (WMO 63, 3.2 mm/h, 95 % low cover). The stars go because
the cover hides them, not because a "rain" palette was swapped in; the streaks
lean with the forecast's wind. (Headless phone, software WebGL, forecast
mocked.)

- Minute-resolution: dawn brightens gradually, the sun's glow tracks east →
  south → west, stars fade in below −6°. There are no steps at phase changes.
- A forecast never snaps the sky: every value eases to its new target.
- A clear night and an overcast one look different, and so do 40 % cloud and
  95 %: the scene comes from measurements, not from the condition's name.
- Under the dark theme a day is a deep sky, not a veiled bright one.

## How it works

`deriveWeatherScene()` (`lib/scene.ts`) turns weather × sun × moon × theme
into one renderer-agnostic `WeatherScene` (fields in
[the overview](./system-ambient.md#the-scene)). Two engines draw it, so
switching engines changes the fidelity, never the mood:

| Engine | Where | How |
|--------|-------|-----|
| **Sky** (`lib/wallpaper/`) | The `sky` style, full-page, when WebGL2 is available | One full-screen fragment pass (`shader.ts`): sky gradient + sun glow and disc, twinkling stars, a phased moon shaded as a lit sphere, two parallax fbm cloud decks lit toward the sun, drifting fog, stochastic lightning, rain streaks, five depth layers of fluttering snow, theme veil, dither. No textures. |
| **Gradient** (`gradient.ts` + `gradient-stack.tsx`) | The `gradient` and `classic` styles; widget cards under every style; the Sky's fallback without WebGL2 | Sun-glow radial + cloud wash + zenith → horizon linear from the scene palette, crossfaded through the layer stack. `gradient.ts` also keeps the original per-condition palettes for Classic and the devtool's 40px condition thumbnails, where conditions must stay distinguishable. |

### The renderer

`WallpaperRenderer` (`lib/wallpaper/renderer.ts`) gets the scene through
`setScene()` and owns everything that happens per frame:

- **Every scene is a target.** Each uniform eases with its own time constant
  (sky ≈ 1.8 s, clouds and precipitation ≈ 2.5 s), so a refetch never snaps.
- **Where a body is drawn eases far faster** (≈ 0.25 s for the sun and moon).
  A live clock moves them a thousandth of a screen a minute, so that easing is
  only felt when a hand drives the clock (the devtool's sliders), and there
  the disc should feel attached to the slider. A real jump glides instead
  ([below](#gliding-across-a-jump)).
- **Drift is accumulated in JS** from the smoothed wind (`uCloudDrift`, and
  the fall vectors below), so a change of wind glides instead of teleporting
  the sky.
- **A pixel budget**, from `support.ts`: 1.1 M px on a desktop (700 k with 4
  cores or fewer), 480 k on a phone (320 k), backed off further when frames
  run long and recovered when they meet the cap. The scene is soft, so CSS
  upscaling is invisible. The frame cap is 60 on both profiles, because a cap
  can only deliver a whole divisor of the refresh rate (45 on a 60 Hz panel is
  30), so pixels are the only lever. "Cheap enough for more pixels" means
  *meeting* the cap, not beating it: the cap holds `dt` at the budget.
- **A cloud deck is skipped the moment its coverage is zero** (`cov <= 0.0`,
  not a threshold), so no pixel carrying cloud is touched and the frame is
  bit-identical. The deck's sun-facing rim sample is the most expensive thing
  in the frame and a clear night would otherwise pay for it on every pixel.
- Pauses when the tab is hidden, renders one still frame under
  `prefers-reduced-motion` (`setReducedMotion`), survives context loss, and
  fades the canvas in only after its first frame (no black flash).
- `<WeatherWallpaper />` (`components/wallpaper.tsx`) is the canvas shell; a
  WebGL failure is reported to the provider (`reportShaderFallback`) and the
  page falls back to the Gradient.

### The sun and the moon

`lib/solar.ts` computes the sun's **elevation and azimuth** for the visitor's
coordinates (NOAA algorithm). Without coordinates it falls back to an arc
estimated from sunrise / sunset (or the local clock), so a first paint still
reads right.

The **moon** uses a low-precision lunar ephemeris (Schlyter, about 1°):
topocentric elevation and azimuth plus the phase from the sun–moon elongation.
It rises, crosses and sets when it really does, and the phase matches the
calendar (`getMoonPhaseName()` gives the eight-way name). A bright, high moon
lifts the night sky and cloud tops and washes out the faint stars; cloud and
fog occlude it. In the southern hemisphere the crescent is mirrored. Without
coordinates the moon is the sun's estimated arc running behind by its phase's
share of a day: new, it crosses with the sun; full, it rises at sunset.

**Staging** (`stageSun` / `stageMoon` in `lib/scene.ts`). Where a body *is*
comes from the ephemeris and is never bent; where it is *drawn* is a
composition decision:

- The vertical mapping is a stage, not a protractor: a moon a few degrees up
  is already drawn in the strip above the page content, and climbs from there
  to just under the top edge. A linear mapping put most of a night's moon
  behind the widget grid.
- Horizontally it crosses east → west with its azimuth (mirrored in the
  south), kept off the extreme edges so a rising moon is never half a moon.
- The daytime moon shows only when well up and more than about 40° from the
  sun, as a pale disc under a fifth of its night strength.
- It is drawn up to 30 % larger near the horizon (the moon illusion).

**Drawing the moon.** The disc is the sun's size (`DISC_R`; both are half a
degree across in the real sky); what makes the sun read as the sun is its
glow. The moon is shaded as a sphere, not masked as a disc: the phase becomes
a light direction and the surface is lit with Lommel-Seeliger (the backscatter
that keeps a full moon bright to its limb) plus a little Lambert and limb
darkening, so the terminator is a gradient. Its texture (maria, highlands, a
sparse crater field whose relief tilts the normal) is laid out by arc angle so
it foreshortens toward the limb, and fades with a pixel's footprint so
nothing shimmers. All procedural.

### Where the weather falls

This is the core of the model. A drop at terminal velocity settles almost at
once into falling along the **sum** of gravity and the wind: the same speed
through the air, aimed somewhere else. So a wind changes *which way down is*
for the things that fall, and the gyroscope moves gravity itself. **Tilt and
wind are one expression**, and the shader only ever sees the sum:

```
fall = g + perp(g) · lean
```

`g` is the unit gravity in page space (`(0, −1)` upright or flat on a table,
the sensor's reading otherwise), `perp(g)` is gravity turned a quarter turn
(screen-right when `g` is screen-down). A tilt moves `g`; a wind sets `lean`.
Both reach the weather through four uniforms and nothing else:

| Uniform | What it is |
|---|---|
| `uRainDown` | The direction the rain travels. A streak *is* a drop's motion blur, so the rain is sampled in a frame aligned to this (`fallSpace()`, the one rotation in the shader). |
| `uRainFall` | How far the rain has fallen, in seconds of its own travel. A leaning fall is a longer one, so a gust quickens the rain as well as leaning it. |
| `uSnowDown` | The same direction for the snow, a far flatter angle at the same wind. The flutter is measured across it. |
| `uSnowFall` | How far the snow has travelled and along what, as a vector of seconds. It is also the wind's whole sideways effect on the snow. Not normalised before it accumulates (a leaning fall is longer); wraps at an hour, where float32 runs out of fraction. |

- **It rotates rather than shears.** A shear stretches a drop as it leans it,
  so a hard gust reads as brushwork; a rotation leans a drop without touching
  its shape.
- **The lean is across gravity, not across the page.** Wind is horizontal in
  the world, which means perpendicular to the fall. Turn the phone on its side
  and the storm turns with you, every flake keeping its angle to gravity.
  Along the page instead, at 90° the wind would blow straight down the fall.
- **The snow keeps its travel instead of a clock**, so its direction can come
  round slowly while the flakes already falling carry on and curve into the
  new down. The snow's lean is therefore the same at every depth for free.
- **A flake's place never depends on where down is.** Only the travel and each
  flake's flutter follow gravity; the cells, rows and long waft stay with the
  page, or the whole field would slide as the snow came round. Upright, the
  frame is bit-for-bit the sky without a gyroscope.

Each field answers at its own speed, the same for a tilt and a wind (a flake
cannot know which moved):

| | Re-aimed by | Why |
|---|---|---|
| **Rain** | an ease, `RAIN_FALL_TAU` 0.08 s | A drop is small, fast and already all the way down, so it is at the new angle within a blink. The ease only keeps a slammed gust from cracking. |
| **Snow** | a critically damped spring, `SNOW_FALL_OMEGA` 0.9 rad/s | An ease leaves at full speed and reads as drag; a spring leaves at rest and reads as **mass**. Critical damping: no overshoot. Implicit integration: a stalled frame cannot make it ring. |
| **Clouds** | the forecast only | You cannot stir a cloud deck by waving at it. |

Against a 54° flick held, rain is at 97 % in 0.12 s; snow is at 21 % at
0.84 s and 94 % at 5 s, with no overshoot. That gap is what reads as weight.

**The wind's sign.** Every horizontal quantity in the Sky is screen-space and
**positive goes right**: `wind.x`, a hand's gust, `uCloudDrift`, `uSnowFall`.
`scene.ts` maps the met wind onto that: the screen looks south, so a westerly
(from 270°) blows toward the east, screen-*left* in the northern hemisphere,
mirrored in the south. In the shader the travels are **subtracted** where they
are used, because sampling a procedural field further right walks it left; that
negation honours the convention. The wind is odd-symmetric: there is no
constant drift added to it (one once made the snow lean the opposite way to
the rain under light crosswinds), and the snow's wind starts at the scene's,
not at zero.

`wind.x` is `speed × sin(from) × hemisphere`, so a wind along the south axis
leans nothing at any speed. That is why the devtool's Tune fold has **two**
wind rows, `Wind` and `From` (`SceneOverrides.windSpeedKmh` /
`windDirectionDeg`). The `From` track runs 270° → 450° (west through north to
east) rather than 0° → 359°, because over that half the lean is monotonic:
drag left and the rain leans left. Every southerly bearing paints exactly
what its northerly mirror does (`sin(180° − d) = sin(d)`), so nothing is lost.

### Gyroscope tilt

Rain and snow fall along gravity, not along the bottom of the viewport: lean
the phone and the streaks lean with it, turn it on its side and the snow
crosses the page sideways. Only the Sky has drops to lean; Gradient and
Classic ignore it.

**The gyroscope is a second gravity, not a camera.** The sky is a world held
inside the page: its zenith is the top of the viewport and the sun and moon
cross it where the ephemeris puts them. Tilting tells that world which way is
down, and only the things that fall answer. The other reading, where the
phone is a window and the view counter-rotates, is a separate feature:
[the sky window](./ambient-easter-eggs.md#the-sky-window-any-weather).

`lib/gyroscope.ts` turns a `deviceorientation` reading into one unit vector,
where down is in the page's frame (`gravityFromOrientation`):

```
g_device = (cos β · sin γ, −sin β, −cos β · cos γ)     // Earth-down, in device axes
```

Alpha (the compass) drops out: which way you face cannot change which way
things fall. The screen-plane part is turned by `screen.orientation.angle` and
blended back to upright when the phone lies too flat to have a direction. The
reading is smoothed at the sensor (`SENSOR_TAU`, 0.12 s, against the clock,
since events arrive at whatever rate the device likes). It is not React state:
one shared `deviceorientation` listener feeds
`WallpaperRenderer.setGravity()` directly. Under reduced motion both downs
snap to the reading.

**Access.** Every browser with a sensor fires the event freely except WebKit,
which gates it behind `DeviceOrientationEvent.requestPermission()` and a user
gesture:

| | Behaviour |
|---|---|
| Chrome / Firefox / Android | The saved wish (`weatherGyro`, on by default) is honoured on load. |
| iOS / iPadOS | The wish waits for one tap: the **Tilt** row in the picker's Weather tab, the devtool's Sky → Gyro row, the tilt primer below, or the sky window's offer. Turning it on *is* the gesture that asks. |
| Granted before | `weatherGyroGranted` records it and access is re-taken silently on the next load. That record is the only reason `requestPermission()` is ever called without a gesture. |
| No sensor (desktop) | Every desktop browser defines `DeviceOrientationEvent` and none fires it, so the provider watches for a first reading and the Tilt row says *no motion readings* (`gyro.readings === "silent"`). |

### The tilt primer

The picker's switch is three taps from the page, offering something the
visitor has never seen. So **on a rainy or snowy Sky, resting a finger on the
home's background brings up what the tilt does, and a button under it asks**
(`TiltPrimerSheet`, `lib/tilt-primer.ts`). The first press buys the
explanation; the second spends the one chance, since a refused permission is
final everywhere.

- **The picture explains**: a phone rocks and the rain inside it swings the
  other way. The camera follows the device part of the way (phone drawn at
  0.45·θ, rain at −0.55·θ, θ = 24°), so cause and effect both move. It is
  CSS, not JS: two declarative animations of one duration cannot drift apart
  over a busy main thread. Reduced motion pauses them at 0%.
- **It stays up to say how it went**, because the sky alone cannot: granted
  (1.4 s, keeps rocking), refused (3.0 s, upright with rain straight down, and
  where to undo it), or neither (WebKit declined without a dialog; the buttons
  come back). That is why `setGyroEnabled` hands the access back.
- **Offered once.** `weatherGyroPrimed` is written the moment the sheet is
  answered (via `setTiltPrimed`), before the asking, and a close or swipe
  counts. `shouldOfferTilt` stays quiet for every absence: spent, nothing to
  ask (not WebKit, or already refused), tilt turned off in the picker, nothing
  falling, or the Sky not painting.
- **On the system surface only.** The press must land inside
  `.system-surface` (the home, a composition rather than a document; see
  [Four voices](./design-system.md#four-voices-chrome-surface-voice-document)).
  The wallpaper is full-page on every route, and on an article a long press
  belongs to the reader.
- **Stillness, so it never collides with the gust** on the same background: a
  hold that goes nowhere for 400 ms (`TOUCH_HOLD_MS`) is the offer; any move
  before that belongs to the gust or the scroller and this stands down. It
  never calls `preventDefault`.
- **It sits on iOS's own press.** WebKit's ~500 ms callout clock would fire
  `pointercancel` on top of a 400 ms hold, so the whole press suppresses
  `-webkit-touch-callout` (`holdCallout()` in `lib/poke.ts`, shared with the
  fog wipe), saved and restored rather than cleared. Chromium's CSSOM drops
  that property silently, so headless tests can only spy on `setProperty`.

The sheet opens from a `setTimeout`, which is not a gesture; the button inside
it is, and reaches `requestPermission()` in the same task.

### Gliding across a jump

Easing is for drift. A **jump** (a location fix a city away, a refetch after
hours asleep, a preset on the devtool's clock) glides over `GLIDE_SEC` (0.9 s,
ease-in-out): what is interpolated is the body's **direction in the world**,
the short way round the sphere, and each frame is staged through `stageSun` /
`stageMoon` (or projected through the sky window). The disc arcs over instead
of sliding across the glass in a straight line, a way the sun never moves. A
glide is measured between one target and the next, not against where the disc
has eased to, so a drag on a slider never restarts it.

The sky window's camera does the same when its view jumps more than
`VIEW_JUMP_DEG` (20°) in one update: a quaternion slerp (`slerpView`) over
`VIEW_GLIDE_SEC` (0.6 s). The star sphere eases its latitude and sidereal
angle. A stopped renderer lands every glide; reduced motion never starts one.

### Settling (the spinner)

Routine change stays silent: the sun drifting, a poll that returns the same
city. When the sky spends a second getting from one state to another, a tiny
ring stands in the top-right corner (`<SettleSpinner />`), fed by
`lib/settle.ts`: each source holds a named reason while it is settling.

| Reason | Stands while |
|---|---|
| `sky` | the full-page renderer has a glide running (sun, moon or camera) |
| `compass` | the window waits for its first reading (up to 1.5 s), or WebKit's compass offset is correcting by more than 6° (until within 2°) |
| `location` | a requested fix is in flight; and `SETTLE_EASE_MS` (2.6 s) after the place moves more than `SETTLE_MOVE_KM` (30 km) |
| `weather` | a relocated forecast is fetching, then 2.6 s while it rolls in; and 2.6 s after a forecast changes the condition or the cloud cover by more than 30 points |

It appears after 150 ms (`SHOW_AFTER_MS`) and holds 700 ms (`HOLD_MS`), so a
change that settles at once never flashes it and two reasons back to back
read as one. It takes no pointer, sits on the wallpaper as `--ink`, and is
still under reduced motion.

### Gradient crossfade

When the scene changes, the CSS gradient must morph rather than snap. The
provider keeps a **layer stack** (`layers`): each change pushes a layer, the
shared `<GradientStack />` fades the newest in over the one beneath over
`crossfadeMs`, then the provider prunes back to the latest. One renderer
serves the full-page wash and the per-widget overlays, so they transition
identically. The iOS `fixedBgTracker` (`lib/fixed-bg-tracker.ts`: a
background-attachment polyfill plus a viewport-relative edge mask) is applied
per layer, so soft edging holds mid-crossfade.

### The sky and the theme

The sun decides what is in the sky; the theme decides how light it is. By day
under Light and by night under Dark those agree and the veil is enough. The
other pairings are where a veil fails: mixed toward the page colour, a noon sky
under Dark becomes a grey-blue midtone and a night under Light becomes slate.

**The key.** So `deriveWeatherScene()` re-keys the sky, the way Apple's
light/dark wallpaper pairs do: each sky and cloud colour's OKLab lightness is
moved into the theme's range with its hue kept (`THEME_KEY` in
`lib/scene.ts`).

| | What it becomes |
|---|---|
| Dark theme, day | The noon sky pressed into the dark range: deep blue, clouds still lighter than the sky, the sun's disc left bright and its glow half keyed. Blue hour, held all afternoon. |
| Light theme, night | The night lifted into the light range: pale moonlit lavender, the brighter stars still showing, the moon dimmed to a day moon so it does not read as the sun. |

The amount runs on the sun's elevation and is **zero through twilight on both
sides** (horizon to 14° for Dark, −2° to −10° for Light), which is where the
theme changes hands under Follow the Sun, so the handover never has a key to
fight. Everything downstream reads the keyed scene without knowing: the
shader, the Gradient, widget cards, `profileFromScene`, the devtool's day
strip. Classic is not keyed: its table is hand-tuned for all four of
day/night × light/dark. On a change of theme the Sky's keyed colours (`keyed`
in `renderer.ts`) ease on the theme's clock (`setThemeEase`) instead of their
own 1.8 s, so the sky lands with the chrome.

**The twilight look.** With the key at zero across the crossing, what was left
of the theme at sunset was the veil and the exposure, so a theme change there
turned a bright milky sunset into a dim one. So **twilight belongs to neither
theme** (`TWILIGHT_LOOK` in `lib/scene.ts`): toward the sun's crossing both
looks are drawn to one (no veil, 0.8 exposure), and through it they are the
same, to the bit.

```
           light's own   ←──── meet ────→   dark's own
  light  ──────┬────────────┬────┬───┬───────────────────────
             +12°          0°  −1.5 −4
  dark   ──────────────┬────┬────┬──────────────┬────────────
                      +4    0°  −1.5           −8°
```

- **The plateau** (−1.5° to 0°) covers where the handover really lands:
  sunrise and sunset as the forecast has them, −0.83° on the ephemeris, 0° on
  the estimated arc. It ends where the dark key begins.
- **Past the crossing**, where only a hand-picked theme goes, each theme takes
  its own look back within a few degrees, before the key arrives.
- **Where it meets** is a legibility decision: about the frame lightness at
  which the light card's tone conflict and the dark card's are equal
  (`toneSafe` in `lib/legibility.ts`: Light wants the picture above 0.62, Dark
  below 0.45). A clear sunset lands near 0.53.

The two looks are mixed as what they paint (`gain·col + offset`), so every
frame between is the plain mix of the two. The Gradient trades its own veil
lift (`CSS_VEIL_BOOST`) for the shared exposure on the same weight, and
`profileFromScene` measures with the same exposure. Both read it off the scene
(`flat`), so neither has to know twilight exists; away from twilight it is 1
and 1. The handover itself (when the chrome switches) is
[the theme follows the sun](./system-ambient.md#the-theme-follows-the-sun).

## Constraints

| Constraint | Why | What breaks |
|---|---|---|
| Every wind and tilt reaches the weather through `uRainDown` / `uRainFall` / `uSnowDown` / `uSnowFall` only | One model for both, so the sky never has two physics | Snow and rain disagree; a gust and a tilt move flakes at different rates |
| Nothing positional in the snow follows gravity | Only travel turns | The whole field slides across the page as the phone turns |
| Horizontal is screen-space, positive right; travels are subtracted where sampled | The met wind is mapped once, in `scene.ts` | The sky blows backwards against the compass (it once did, unnoticed, until a hand's gust revealed it) |
| A body's world position is never bent; only `stageSun` / `stageMoon` place it | The ephemeris is the truth, the stage a composition | A moon in the wrong part of the sky for the date and place |
| Reduced motion: one still frame, no glides, downs snap | The setting is about motion | Animation behind a preference that asked for none |
| Keep `cov <= 0.0` an exact test | Bit-identical frames, verified that way | A threshold changes pixels that carry cloud |
| Gyroscope readings stay out of React | ~60 events/s, nothing renders from them | A render per sensor event |

## Recipes

**See a condition without waiting for it.** Devtool → Sky module. The six
condition chips force one (click again for the real weather); the timeline's
playhead and the phase names move the effective clock (`timeScrubMinutes`),
and the date row moves the day (`dayOffset`, which moves the moon). The **Tune**
fold holds sliders over the derived scene: Cloud, Precip, Wind, From, Veil. **Now** resets all of it. Forcing a
condition paints its profile exactly; measurements only enter from a real
forecast.

**Check a shader change.** The bar is "bit-identical where it should be": the
window's code at `uWindow = 0`, the cloud skip, the gyroscope upright. Compile
the old and new shader side by side and compare frames over the same uniforms.

**Without WebGL2.** Devtool → Wallpaper → **No WebGL2** (the `noWebGL`
override) forces the Gradient fallback; the picker's Sky tile shows the note.
