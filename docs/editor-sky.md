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
| Editor page (hidden, `noindex`) | `app/editor/sky/{page,view,controls,i18n,model}.ts(x)` |
| Plots (SVG, no chart library) | `app/editor/sky/plots/` |
| Shared editor vocabulary (sections, sliders, the amber star, chips, readouts) | `app/editor/controls.tsx` (with the Icon Studio and the Legibility Lab) |
| The two provider overrides (`labStage`, `labSkyConfig`) | `systems/ambient/provider.tsx` |
| Server-side file access | `lib/sky-file.ts` |
| Dev save API | `app/api/sky/route.ts` |
| CLI check | `scripts/sky-check.ts` → `pnpm sky:check` |

Entry points, and no others: a **Sky** link in the `/editor` toolbar, and `S` in
the command palette's slash commands (`E` is the editor index).

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

The lab is built the way the Legibility Lab is: a page that scrolls, over the
site's own wallpaper, with a sticky glass panel on the right. **The stage is
not a mock.** While the lab is open the full-page wallpaper behind it paints
the lab's scene — through `labStage` on the ambient provider, the counterpart
of the Legibility Lab's `legibilityOverride` — with whichever engine the panel's
**Stage** switch names (Sky, Gradient, Classic). The same canvas, the same
shader, the same CSS engines a visitor gets; the visitor's own wallpaper comes
back on leave. Everything on the page sits on that sky as glass cards, the way
widgets sit on the home screen.

**Left — the picture and the evidence.**

- **Three engines on one scene**: a `<WeatherWallpaper>` tile (WebGL), the CSS
  Gradient fallback and the Classic palette, side by side, so a change is seen
  in all three at once — and full-page behind them in the one the Stage
  switch names. The tiles follow the Preview frame (landscape / portrait).
- **The clock**, at three scales (below): space plays, the arrows step.
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

**Right — the panel.** Scene (theme, the Stage engine, the condition and the
three scene tweaks, the raw API readout) · Observer · Presets · Sun · Moon ·
Stars · Clouds · Veil · Camera · Export. Every lever is the site's own slider
with its value beside it and an amber `*` once it has left the committed
value — click the star to go back — exactly as in the Legibility Lab and the
devtool. Lever labels are keyed by the config path they edit (`i18n.ts`), in
both languages, so a label cannot drift from the field it writes.

The header line reads the instant, the observer, the condition, the engine
that is painting, the theme and the preset, then how many leaves of the config
differ from the committed preset and whether the file is unsaved.

**What reaches past the page.** As in the Legibility Lab, the tuning is not
confined to the lab: the config you are editing goes to the provider as
`labSkyConfig` and paints every route until Reset all or a reload, so a moon
staged here can be checked on the real home screen before it is saved. The
devtool's Sky module shows a *Sky lab config in force* row with a star while
that is so. The stage itself (`labStage`) is lab-only and cleared on leave.
Coming back finds the panel where you left it (the session store), unless the
file on disk changed meanwhile.

## Time control

| Scale | Sweeps | At ×1 | What it shows |
|-------|--------|-------|---------------|
| **Day** | 00:00 → 24:00, continuously | 1 h / s | The sun's arc, twilight, the moon at the date's phase |
| **Month** | 30 days, whole days, clock held | 2 d / s | The moon marching ~50 min later each day, waxing and waning; the sun barely moving |
| **Year** | 365 days, whole days, clock held | 1 week / s | The sun's seasonal height, the analemma, day-length change |

Play / pause, step, a speed dial (0.25× → 8×), a loop toggle, and a scrubber
whose extent follows the scale (space plays and pauses, ← → step, when no
field has the focus). The month and year sweeps advance by whole days
on purpose: a continuous sweep would be a blur of sunrises, and the point is the
day-to-day beat. **Hold** pins the time of day the long sweeps (and the
analemma) use; **Now** returns to the real instant.

The lab drives `deriveWeatherScene` directly rather than going through the
ambient provider's clock — so a sweep never touches the site's own clock, and
never has to push 30 days through the provider's minute tick. The finished
scene is handed to the provider as the stage; under a CSS engine that stage
paints one layer replaced in place rather than a crossfade per frame.

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
- **Presets** are named configs in the same file. The site paints from the
  `active` one once saved; while you are in the lab, and until Reset all, the
  preset you are *editing* is what paints (`labSkyConfig`). **Add** saves the
  current config as a new preset and moves the editing there — the preset you
  were on keeps its stored config. The devtool's Sky module gains a picker
  over the saved presets (session-only) once there is more than one.
- In dev, `content/sky.json` is also a static import of the scene module, so a
  Save hot-reloads the app; the lab keeps its place through that (the session
  store, and a saved-file event any mounted instance adopts).
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
