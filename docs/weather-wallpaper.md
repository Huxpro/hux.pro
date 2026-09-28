# Atmosphere weather wallpaper

Choose **Wallpaper → Weather → Atmosphere** in the wallpaper window (the same picker becomes a sheet on phones). Sky remains the default; Gradient, Classic, image pairs and album playback are unchanged. Atmosphere is a separate rendering engine, with its code in `systems/ambient/lib/atmosphere/`:

| File | What it is |
|------|------------|
| `scene.ts` | `SkyScene`, Atmosphere's uniforms: its own palette (`deriveSkyScene`), and `toAtmosphereScene`, which adapts the live `WeatherScene` onto it |
| `shaders.ts` | The cloud pass: sky, sun, moon, stars, meteor, a raymarched cloud volume, mist, the lightning's light |
| `renderer.ts` | The WebGL1 program around it; the packed noise; the fog wipe's mask texture |
| `details.ts` | The display-resolution 2D layer: rain, snow, the bolt |
| `lightning.ts` | One lightning event for both layers — the storm's own and a clicked strike |
| `engine.ts` | `AtmosphereEngine`: one clock for both canvases, the eggs, adaptive quality |

`components/atmosphere-wallpaper.tsx` is the React shell around the engine, and `components/live-atmosphere.tsx` puts it on the live scene with its gradient under it and the theme veil over it.

## What it does that the Sky cannot

The Sky paints two cloud decks as pictures in one fragment pass; Atmosphere integrates a shallow cloud *volume* along each view ray. That buys the things a picture of a cloud cannot have, and the engine is arranged to spend them:

- **Depth.** Self-shadowing toward the sun, sunlit rims, and real parallax: the deck is a world-space slab, the nearest billows are overhead and the far ones at the horizon, so anything that moves the camera moves them by their distance.
- **Light from inside.** A lightning flash is lit where the channel leaves the cloud and falls off through the volume, brightest where the cloud is thickest.
- **Occlusion.** The moon, the stars and a meteor sit behind the volume and are hidden by exactly the cloud in front of them, per pixel.
- **Display-resolution weather.** Rain, snow and bolts are strokes on a separate 2D canvas at device resolution, so they stay sharp however far the cloud pass has to drop its own resolution.

## Shared weather, independent rendering

`toAtmosphereScene` keeps Atmosphere's palette but takes every *measurement* from the shared `WeatherScene`, so the two engines never disagree about the weather:

- the sun and the moon where the scene stages them, the moon's phase, and its disc size (larger near the horizon);
- the moon lit **from the side the sun is on**, rather than from a fixed axis;
- stars and moon from `behind` — the sky with nothing in front of it. The Sky dims them by the cover because its decks are pictures; here the volume and the mist hide them physically, so dimming them as well would count the murk twice (and leave the fog wipe nothing to find);
- cloud cover, and the **density** and **darkness** the measured cloud layers give (thin cirrus reads thin, stratus thick and grey-based);
- precipitation, fog, lightning, and the wind — across the view as the Sky has it, and **into** the view from the world wind (`windWorld`), so on a day with a northerly the deck travels toward or away from the viewer. The deck drifts *with* the wind: the drift is subtracted where it is sampled (see "The wind's sign" in [system-ambient.md](./system-ambient.md#the-winds-sign)). On a calm day it still recedes very slowly, along the view and never across it, so the sky is never frozen and there is no sideways constant to fight the wind;
- **the theme's key** (`themeKeyFor` in `lib/scene.ts`): the same lightness move the shared scene applies to its own colours, over Atmosphere's palette. A night under the light theme is lifted to a pale lavender and its moon dimmed to a day moon; a day under the dark theme is pressed down. The theme veil — already lightened by the key — sits right over it, and legibility (`profileFromScene`) reads the keyed palette.

Both engines follow the same location, clock, observations and devtool overrides. Selecting a style uses the persisted `weatherStyle` setting and stops image playback.

Full placement paints the engine. Widget placement uses its matching CSS palette and theme veil (`atmosphereGradient`), following the wallpaper system's existing widget policy without adding per-card GPU contexts. Off and image placement unmount the engine. The picker's tile runs it at a 90,000-pixel cloud budget and 30 fps, the Sky tile's budget and rate. Theme veil, reading-page veil, legibility profiling and bezel/edge-mask treatment use the shared wallpaper system; the veil moves at the Sky's theme pace, and at the sun's slower one while the theme hands over (`skyThemeEaseMs`).

## The eggs

`<WallpaperBackground />` arms the weather eggs for either engine that paints a sky, through the same refs (`pokeRef`, `wipeRef`), so the rules of when each is armed — `armedPoke`, `WIPE_MIN_FOG`, reduced motion, the home's edit mode — are one set. What each answer looks like is Atmosphere's own:

| Egg | Atmosphere's answer |
|-----|---------------------|
| **Strike** (thunder, a click) | A branching bolt from the cloud base down to the clicked point, crisp on the 2D layer, a restrike and a ground flash where it lands; the volume is lit from inside where the channel leaves it. `strikeAt` in `lightning.ts`. |
| **Meteor** (a clear, dark night, a click) | A head and a train through the clicked point on a path re-rolled per click, at the Sky's pace and bounds, drawn inside the cloud pass so a cloud in front hides it; faint on a washed-out night. |
| **Fog wipe** (fog, a drag) | The swath is painted into a small mask the cloud pass reads, torn at its edge by noise. It clears the mist *and* opens the cloud volume behind it, so the real moon and stars come through. The path has no corner limit — the mask holds a long stroke — and it uses `lib/wipe.ts`'s life, decay, carry and tiring hand. |
| **Gust** (rain or snow, a drag) | `GUST` and `gustStep` from `lib/wallpaper/stir.ts`, the Sky's own air: the rain leans at once, the snow comes round over a breath. Neither engine moves a cloud. |

There is **no sky window**. The pull that opens it is armed only while the Sky paints: the window is a camera aimed at the real sky, with the sun, the moon and the stars on the celestial sphere, and Atmosphere's volume is a stage seen from one place. The tilt primer is shared.

## Tilt

With the gyroscope on (`gyro.active`), rain and snow fall along the phone's gravity, the rain re-aiming in a blink and the snow over a breath, exactly as in the Sky. Atmosphere also slides its camera sideways with the tilt, up to a fifth of a deck unit, eased over half a second. The sun, moon and stars are at infinity and stay where they are; the cloud moves by its distance — overhead billows most, the horizon hardly at all. Reduced motion turns it off.

## Performance

The cloud pass is the cost. Measured on SwiftShader (CPU WebGL, a proxy for fill-rate cost) at 640×400, against the PR's first version, on the same scene:

| Sky | Before | Now |
|-----|--------|-----|
| Broken cloud (55%) | 465–480 ms | 214–224 ms (≈2.1×) |
| Overcast (95%) | 613–640 ms | 157–168 ms (≈3.8×) |

What changed:

- **One texture fetch per octave.** The noise texture holds two z-slices per texel (red at (x, y), green at (x + 37, y + 17)), which is where the value noise made its second fetch. Linear filtering interpolates both channels identically, so the result is the same, and a test checks the packing.
- **Level of detail where it cannot be seen.** The two shadow taps toward the sun sample only the broad octaves (plus the dropped octaves' mean, so the shadow sits on the same deck). Toward the horizon, where a ray crosses the deck in long steps, the fine octaves and the erosion are swapped for their mean too — which removed the crunchy aliased band the first version had there — with a little aerial perspective and a wider per-pixel jitter.
- **Early termination.** The march stops once the cloud in front is opaque; an overcast sky is where this pays most.
- **Per-frame constants on the CPU**: coverage, extinction and the light direction are computed once per frame, and uniform locations once per program.
- **Two rates.** The volume draws at 24 fps — it drifts, it does not dart — and at the full rate only while something quick is in it: a flash, a meteor, a hand in the mist, a tilt still settling. Precipitation draws every frame.
- **Batched particles.** Rain and snow are stored as typed columns and grouped into depth bands; each band goes out as one path and one stroke (or one fill), instead of a path and a style string per drop. The bolt's geometry is cached per event.
- **Adaptive quality, both ways.** A frame-time average above 1.55× the budget for 45 frames drops the cloud resolution by 0.8× (to 45% of its base), then the particle count (to 40%); meeting the cap for 300 frames wins them back, but never to a scale already measured as too slow.
- **Budget.** A share (0.65) of the Sky's device profile (`getWallpaperQualityProfile`), at most 1.25 backing pixels per CSS pixel; the loop cap is the profile's.

Hidden tabs and offscreen canvases stop drawing. Reduced motion renders a still frame, answers no eggs and follows no tilt. Context loss shows the atmospheric CSS gradient; restoration rebuilds the GPU resources. Unmount releases resources and observers.

The devtool's Wallpaper module reads the engine's stats (`GL1 + 2D · width×height · scale · frame ms`), or says the CSS gradient is showing. Its “No WebGL2” switch applies only to Sky.

## Studio

`/editor/weather` (in the `/editor` dropdown as **atmosphere**) is the standalone Atmosphere studio: six weather presets, time, intensity, wind, pause, reading preview and lightning replay. A tap on the sky previews the eggs — a strike on Thunder, a meteor on a clear night. **Use live wallpaper** selects Atmosphere in the wallpaper system and returns home using live observations; synthetic studio weather never overrides the shared provider.

## Verification

`pnpm test:weather` covers the alternative scene, the shared-scene adaptation (the real moon, the unhidden night, the cloud layers, the wind into the view, the theme's key), weather style selection/fallback, the existing CSS styles, the packed noise, the shared gust, and the storm's and the clicked strike's lightning. Also run `pnpm exec tsc --noEmit`, targeted ESLint and `pnpm build`.

Browser checks (Chromium, with the weather and IP-location APIs stubbed per condition): the strike lands on the clicked point with the volume lit; the meteor passes through the clicked point; the fog wipe opens the mist and the deck and heals; snow and rain draw at display resolution; adaptive quality steps down under SwiftShader; context loss falls back to the gradient and recovers; reduced motion is a still frame that ignores clicks; the picker's tile runs live; Sky is unchanged.
