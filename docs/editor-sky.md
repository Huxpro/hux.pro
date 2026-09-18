# Sky Engine Lab

A workbench for the weather wallpaper's world model. The wallpaper is a small
physical simulation — a sun, a moon with a real phase, a sky keyframed on
elevation, moonlight, cloud cover, precipitation, a staged moon — and it used to
be tunable only by editing constants in `systems/ambient/lib/` and reloading.
**`/editor/sky`** opens all of it: the ephemeris with its working shown, the
trajectories plotted, every table a lever, and a dev-only save that commits the
result.

> The lab is a **consumer** of `systems/ambient/lib`, never a fork of it.
> Anything it can tune is a field of a `SkyConfig` that `deriveWeatherScene`,
> `stageMoon` and the shader take as input; the site paints from the committed
> `content/sky.json` through the very same functions.

## Where things live

| Piece | Location |
|-------|----------|
| Config type + defaults + normalization | `systems/ambient/lib/sky-config.ts` |
| Committed config (source of truth) | `content/sky.json` |
| Scene derivation (reads the config) | `systems/ambient/lib/scene.ts` |
| Shader framing (from `WeatherScene.render`) | `systems/ambient/lib/wallpaper/{shader,renderer}.ts` |
| Ephemeris, rise/set, `explain*` readouts | `systems/ambient/lib/solar.ts` |
| Editor page (hidden, `noindex`) | `app/editor/sky/{page,view,controls,model}.tsx` |
| Lab copy, both languages | `app/editor/sky/i18n.ts` |
| Plots (SVG, no chart library) | `app/editor/sky/plots/` |
| Shared editor form vocabulary | `app/editor/controls.tsx` (with the Icon Studio and the Legibility Lab) |
| Server-side file access | `lib/sky-file.ts` |
| Dev save API | `app/api/sky/route.ts` |
| CLI check | `scripts/sky-check.ts` → `pnpm sky:check` |

Entry points, and no others: a **Sky** link in the `/editor` toolbar, and `K` in
the command palette's slash commands (`E` is the editor index, and `S` is the
solar-theme toggle — so the lab takes sKy).

## The config

`SkyConfig` is one plain-JSON object — colours are `#rrggbb` strings — grouped
by area:

| Group | What it holds |
|-------|---------------|
| `sun` | The clear-sky keyframes (`el` → zenith / horizon / glow / strength), the day threshold, the twilight window, disc size, glow radii and gain, the horizon warmth band |
| `moon` | Disc size, the moon-illusion curve, halo, earthshine, terminator softness, the three visibility gates (up × dark sky × clear), the daytime-moon gate, and moonlight's lift of sky, clouds and stars |
| `stars` | Density, twinkle, the night gate, the cover gate |
| `clouds` | The six condition profiles (cover, floor, density, darkness, precipitation, fog, day/night tint and amount), how cover brings the tint in, cloud lighting colours, wind scaling and drift |
| `veil` | Per theme: colour, amount, exposure |
| `staging` | The camera: horizon y, the sun's arc height, the east→west span and margin, the moon's stage, and the shader's framing (horizon curve, cloud deck scale and parallax) |

`content/sky.json` is a **document of named presets**:

```jsonc
{
  "version": 1,
  "active": "default",           // the preset the site paints from
  "presets": [{ "id": "default", "name": "Default", "config": { … } }]
}
```

`normalizeSkyConfig` / `normalizeSkyFile` are the only way in — the editor's live
state, the save route, the committed file at build and `sky:check` all go
through them, so a hand-edited or stale file can never produce a broken sky.
`default` always exists and is the shipped look.

The defaults are a **transcription** of the constants `scene.ts` and the shader
shipped with, not a re-tuning: the extraction leaves the wallpaper pixel-for-pixel
where it was.

## The page

**Left — the picture and the evidence.**

- **Three engines on one scene**: the live `<WeatherWallpaper>` (WebGL), the CSS
  Gradient fallback and the Classic palette, side by side, so a change is seen
  in all three. A Light / Dark switch drives the scene's theme independently of
  the page's, for tuning the veil.
- **The clock**, at three scales (below).
- **The day**: the sky strip (the devtool's, at ten-minute resolution) with a
  moon-visibility track under it, sunrise / sunset / moonrise / moonset ticked,
  and a playhead you drag.
- **Sky dome** — azimuth × elevation, the horizon as a line, both paths for the
  day, rise/set ticks at the azimuth they happen at, the −18° band shaded.
- **Screen space** — the same two paths after `sunToScreen` and `stageMoon`,
  over a wireframe of the viewport with the band behind the page content
  shaded. This is the plot that shows why the stage exists: the moon's real arc
  spends the night high in the dome, and the staged one spends it in the strip
  above the widget grid.
- **Analemma** — the sun at one clock time on every day of a year; the
  figure-eight is the equation of time, drawn.
- **A month of moons** — one tile a day: the phase glyph, and how high the moon
  gets at its transit. Click one to jump there.
- **Derived scalars** — daylight, glow, the three moon gates and their product,
  stars, fog, cover, cloud darkness: each a number and a sparkline across the
  day. A moon that went out has a culprit, not a mystery.
- **Ephemeris, explained** — day number, orbital elements, the anomalies, what
  the perturbation terms added, ecliptic → equatorial → horizontal, sidereal
  time, the hour angle and the parallax correction, for both bodies.
- **The one-clock guarantee** — the invariants, re-derived at the instant in
  view and compared with the scene: one `nowMs` feeds sun and moon; phase is the
  moon's ecliptic longitude minus the sun's; day/night comes from the sun alone
  (checked by deriving the same instant under a different condition).
- **Compared with the literature** — four published constants recomputed from
  this repo's ephemeris at load: a known new-moon instant, the synodic month
  (averaged over 99 lunations, because a single year of them is biased by half
  an hour), the obliquity of the ecliptic, and the moon's mean distance.
  "Schlyter-grade, ~1°" is a claim until something measures it.

**Right — the config.** Presets · Observer & scenarios · Weather · Sun · Moon ·
Stars · Camera & staging. Every lever shows its value, and an amber `*` once it
has left the committed default — click it to go back.

## Language

Every string is in English and Chinese (`app/editor/sky/i18n.ts`, the same
shape as the Legibility Lab's), keyed and resolved through `useSkyText()`.
Numbers stay numbers and the clock stays 24-hour in both — `18:14` beside a
published almanac value should read as the same kind of number either way —
but dates follow the locale (`21 Jun 2026` / `2026年6月21日`).

Anything the *site* already names, the lab asks for rather than re-translating:

| Thing | Who names it |
|-------|--------------|
| The six conditions | `getWeatherConditionLabel` (`lib/weather.ts`) |
| The six ambient phases | `getAmbientPhaseLabel` (`lib/phase.ts`) |
| The moon's eight faces | `getMoonPhaseLabel` (`lib/solar.ts`) |

The last two moved out of the devtool panel to be shared, for the same reason
`MoonPhaseIcon` did: a lab that invents a second name for 满月 is a lab that
can disagree with the thing it is inspecting.

## Time control

| Scale | Sweeps | At ×1 | What it shows |
|-------|--------|-------|---------------|
| **Day** | 00:00 → 24:00, continuously | 1 h / s | The sun's arc, twilight, the moon at the date's phase |
| **Month** | 30 days, whole days, clock held | 2 d / s | The moon marching ~50 min later each day, waxing and waning; the sun barely moving |
| **Year** | 365 days, whole days, clock held | 1 week / s | The sun's seasonal height, the analemma, day-length change |

Play / pause, step, a speed dial (0.25× → 8×), a loop toggle, and a scrubber
whose extent follows the scale. The month and year sweeps advance by whole days
on purpose: a continuous sweep would be a blur of sunrises, and the point is the
day-to-day beat. **Hold** pins the time of day the long sweeps (and the
analemma) use; **Now** returns to the real instant.

The lab drives `deriveWeatherScene` directly rather than going through the
ambient provider — so a sweep never touches the site's own clock, and never has
to push 30 days through the provider's minute tick.

## Observer

Presets for both hemispheres, the equator and inside the Arctic circle (where
the rise/set solver has to return nothing at all), plus the visitor's own
resolved location, editable latitude/longitude, and a southern-hemisphere
switch — the sign in `scene.hemisphere` that mirrors east/west and turns the
crescent over, and the easiest thing in the model to get backwards.

**Named skies** jump the clock and the condition together: a full moon at its
transit, a new moon at midnight, a daytime moon, a thunderstorm at dusk, the
blue hour, noon in polar night.

## Saving and sharing

- **Save** (dev only) writes `content/sky.json` through `/api/sky`. Commit it;
  `scene.ts` imports it at build, so the static export needs nothing at runtime.
- **Presets** are named configs in the same file. Editing one that is not
  `active` changes nothing on the site until you make it active. The devtool's
  Sky module gains a picker over them (session-only) once there is more than one.
- **JSON** copies the current config; **Link** copies a permalink
  (`/editor/sky?t=…&lat=…&lon=…&preset=…&scale=…`) so a look can be shared in an
  issue.

```bash
pnpm sky:check           # fail if content/sky.json no longer normalizes cleanly
pnpm sky:check --write   # accept the normalized form (after a schema change)
```

`sky:check` catches what forgiving normalization otherwise hides: a field
renamed in `sky-config.ts`, an out-of-range value silently clamped, a colour
that is not a hex triple, a preset written by an older shape of the config.

## Non-goals

- **Changing the physics.** The ephemeris stays Schlyter-grade; the lab makes
  its accuracy visible, it does not add a higher-precision model.
- **A user-facing feature.** Nothing here ships to visitors except the committed
  config.
- **Replacing the devtool's Sky module.** That stays the on-page shortcut: four
  sliders, the day strip, the condition chips. The tables live here.
