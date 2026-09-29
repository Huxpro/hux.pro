# Atmosphere weather wallpaper

Choose **Wallpaper → Weather → Atmosphere** in the wallpaper window (the same picker becomes a sheet on phones). Sky remains the default; Gradient, Classic, image pairs and album playback are unchanged. Atmosphere is a separate rendering engine, with its code in `systems/ambient/lib/atmosphere/`:

| File | What it is |
|------|------------|
| `scene.ts` | `SkyScene`, Atmosphere's uniforms, and `toAtmosphereScene`, which takes them from the live `WeatherScene` |
| `shaders.ts` | The cloud pass: the Sky's sky, sun, moon and stars (ported), the meteor, a raymarched cloud volume, the Sky's fog, the lightning's light |
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

## One sky, two ways of rendering cloud

Atmosphere paints the Sky's sky and renders the cloud its own way. An A/B of the two engines on the same scenes (same place, clock and stubbed weather) showed the Sky ahead on everything behind the cloud and Atmosphere ahead on the cloud itself, so the sky was taken whole from the Sky:

- **The palette is the shared scene's.** Zenith, horizon, the sun's glow and its strength, the cloud's lit and shaded colours: the Sky's hand-tuned keyframes by sun elevation, re-keyed to the theme (a night under the light theme lifted to lavender, a day under the dark one pressed down), lit by the moon, with the twilight look's exposure at the crossing. Atmosphere used to derive a palette of its own, which read grey at noon, brown at sunset and slate on a lifted night.
- **The sky behind the volume is the Sky's `skyBase`, ported:** the gradient, the glow widening and warming as the sun falls, the dawn and dusk warmth band, the disc and its halo (the volume, not the cover, decides whether the disc is seen).
- **The moon is the Sky's lit sphere** — a terminator of grazing light, seas, regolith bright to the limb — and it is *added* to the sky, never mixed into it, so under a lifted night it is still the brightest thing there. It is lit from the side the sun is on.
- **The stars are the Sky's two fields**, a sparse bright one and a fine dust, twinkling, fading into the horizon haze.
- **The fog is the Sky's** drifting low-frequency veil, denser toward the bottom, in the horizon's and the cloud's colours.
- **Toward the horizon the deck gives way to what it averages to** — the Sky's `deckTowardHorizon` — which is also what a real deck does: it closes into one tone. It replaced a band of aliased, repeating little clouds, and the march is skipped where only the average shows.
- **An overcast keeps its structure.** The shadow taps read the deck against their own threshold, never below the middle of the noise, so under full cover the thick cores shade and the thin parts glow — the mottling the Sky's two decks have — instead of one flat grey slab. Darkness takes the lit side toward the shade too, as the Sky's `thick × darkness` mix does, so a storm is dark through.
- **A low sun lights the deck from underneath** in the glow's colour, so sunset cloud glows instead of standing in silhouette.

Everything else that is a *measurement* is the shared `WeatherScene`'s too, so the two engines never disagree about the weather:

- the sun and the moon where the scene stages them, the moon's phase, and its disc size (larger near the horizon);
- stars and moon from `behind` — the sky with nothing in front of it. The Sky dims them by the cover because its decks are pictures; here the volume and the mist hide them physically, so dimming them as well would count the murk twice (and leave the fog wipe nothing to find);
- cloud cover, and the **density** and **darkness** the measured cloud layers give (thin cirrus reads thin, stratus thick and grey-based);
- precipitation, fog, lightning, and the wind — across the view as the Sky has it, and **into** the view from the world wind (`windWorld`), so on a day with a northerly the deck travels toward or away from the viewer. The deck drifts *with* the wind: the drift is subtracted where it is sampled (see "The wind's sign" in [system-ambient.md](./system-ambient.md#the-winds-sign)). On a calm day it still recedes very slowly, along the view and never across it, so the sky is never frozen and there is no sideways constant to fight the wind;
- the theme's dimming of a lifted night's moon (`themeKeyFor` in `lib/scene.ts`), over the unhidden moon.

Both engines follow the same location, clock, observations and devtool overrides. Selecting a style uses the persisted `weatherStyle` setting and stops image playback.

Full placement paints the engine. Widget placement uses its matching CSS palette and theme veil (`atmosphereGradient`), following the wallpaper system's existing widget policy without adding per-card GPU contexts. Off and image placement unmount the engine. The picker's tile runs it at a 90,000-pixel cloud budget and 30 fps, the Sky tile's budget and rate. Theme veil, reading-page veil, legibility profiling and bezel/edge-mask treatment use the shared wallpaper system; the veil moves at the Sky's theme pace, and at the sun's slower one while the theme hands over (`skyThemeEaseMs`).

## The eggs

`<WallpaperBackground />` arms the weather eggs for either engine that paints a sky, through the same refs (`pokeRef`, `wipeRef`), so the rules of when each is armed — `armedPoke`, `WIPE_MIN_FOG`, reduced motion, the home's edit mode — are one set. What each answer looks like is Atmosphere's own:

| Egg | Atmosphere's answer |
|-----|---------------------|
| **Strike** (thunder, a click) | As in the Sky, a channel from the top of the sky that grows down to the clicked point in ~70 ms, with branches, a restrike and a ground flash where it lands — crisp on the 2D layer, as wide as the screen is tall allows; the volume is lit from inside where the channel leaves it. `strikeAt` in `lightning.ts`. |
| **Meteor** (a clear, dark night, a click) | A head and a long train through the clicked point on a path re-rolled per click, at the Sky's pace and bounds, drawn inside the cloud pass so a cloud in front hides it; faint on a washed-out night. |
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
- **Batched particles.** Rain and snow are stored as typed columns and grouped into depth bands; each band goes out as one path and one stroke (or one fill), instead of a path and a style string per drop — which is what lets the rain run as dense as the Sky's (4,200 drops per CSS megapixel at full intensity) for a fraction of a millisecond. The bolt's geometry is cached per event.
- **Adaptive quality, both ways.** A frame-time average above 1.55× the budget for 45 frames drops the cloud resolution by 0.8× (to 45% of its base), then the particle count (to 40%); meeting the cap for 300 frames wins them back, but never to a scale already measured as too slow.
- **Budget.** A share (0.65) of the Sky's device profile (`getWallpaperQualityProfile`), at most 1.25 backing pixels per CSS pixel; the loop cap is the profile's.

Hidden tabs and offscreen canvases stop drawing. Reduced motion renders a still frame, answers no eggs and follows no tilt. Context loss shows the atmospheric CSS gradient; restoration rebuilds the GPU resources. Unmount releases resources and observers.

The devtool's Wallpaper module reads the engine's stats (`GL1 + 2D · width×height · scale · frame ms`), or says the CSS gradient is showing. Its “No WebGL2” switch applies only to Sky.

## Studio

`/editor/weather` (in the `/editor` dropdown as **atmosphere**) is the standalone Atmosphere studio. Its sky is the shared scene derived from the studio's weather, clock and the site's theme (`deriveWeatherScene`), so it previews exactly what the wallpaper paints: six weather presets, time, intensity, wind, pause, reading preview and lightning replay. A tap on the sky previews the eggs — a strike on Thunder, a meteor on a clear night. **Use live wallpaper** selects Atmosphere in the wallpaper system and returns home using live observations; synthetic studio weather never overrides the shared provider.

## Verification

`pnpm test:weather` covers the alternative scene, the shared-scene adaptation (the real moon, the unhidden night, the cloud layers, the wind into the view, the theme's key), weather style selection/fallback, the existing CSS styles, the packed noise, the shared gust, and the storm's and the clicked strike's lightning. Also run `pnpm exec tsc --noEmit`, targeted ESLint and `pnpm build`.

Browser checks (Chromium, with the weather and IP-location APIs stubbed per condition): the strike lands on the clicked point with the volume lit; the meteor passes through the clicked point; the fog wipe opens the mist and the deck and heals; snow and rain draw at display resolution; adaptive quality steps down under SwiftShader; context loss falls back to the gradient and recovers; reduced motion is a still frame that ignores clicks; the picker's tile runs live; Sky is unchanged.
