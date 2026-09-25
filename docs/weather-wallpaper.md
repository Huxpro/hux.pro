# Atmosphere weather wallpaper

Choose **Wallpaper → Weather → Atmosphere** in the wallpaper window (the same picker becomes a sheet on phones). Sky remains the default; Gradient, Classic, image pairs and album playback are unchanged. Atmosphere is a separate rendering engine, with its code in `systems/ambient/lib/atmosphere/`.

## Shared weather, independent rendering

`toAtmosphereScene` adapts the existing provider's live `WeatherScene`: cloud cover, rain/snow intensity, fog, wind, sun placement, moon phase and lightning. It keeps Atmosphere's palette and volumetric clouds. Both weather engines therefore follow the same location, clock, weather observations and devtool overrides. Selecting a style uses the existing persisted `weatherStyle` setting and stops image playback.

Full placement paints the animated sky. Widget placement uses its matching CSS palette and theme veil, following the wallpaper system's existing widget policy without adding per-card GPU contexts. Off and image placement unmount the Atmosphere engine. The picker previews it at a 90,000-pixel cloud budget while open. Theme veil, reading-page veil, legibility profiling and bezel/edge-mask treatment use the shared wallpaper system.

The original Sky renderer and its WebGL2 fallback, gyroscope, meteor, lightning tap, wind-stir and fog-wipe interactions remain independent. Atmosphere uses WebGL1 and its own fallback; it does not claim Sky's gesture or tilt features. The devtool's “No WebGL2” switch applies only to Sky.

## Visual treatment and runtime

- A 20-step, four-scale volumetric cloud shader with self-shadow and sunlit rims.
- Broad solar glow, a phase-lit illustrative moon, stars and mist.
- A separate display-resolution 2D layer for sharp rain, drifting snowflakes and branching lightning synchronized with cloud illumination.
- Clouds normally draw at up to 24 fps, precipitation up to 60 fps. Cloud resolution can reduce under load without blurring precipitation (up to 2× device scale).
- Hidden/offscreen canvases stop drawing. Reduced motion renders a still frame without lightning. Context loss shows the atmospheric CSS gradient; restoration rebuilds the GPU resources. Unmount releases resources and observers.

`/editor/weather` retains the standalone Atmosphere studio, with six weather presets, time, intensity, wind, pause, reading preview and lightning replay. **Use live wallpaper** selects Atmosphere in the wallpaper system and returns home using live observations; synthetic studio weather never overrides the shared provider.

## Verification

`pnpm test:weather` covers the alternative scene, shared-scene adaptation, weather style selection/fallback, existing CSS styles and lightning timing. Also run `pnpm exec tsc --noEmit`, targeted ESLint and `pnpm build`. Browser checks should cover switching Sky ↔ Atmosphere, reloading the saved choice, image playback, full/widget/off placement, the picker on desktop/mobile, and the standalone weather presets.

Rebase verification (2026-09-25): 9 Node tests pass, including 48 shared-scene condition/theme/time combinations; TypeScript, targeted ESLint and the production build pass. Chromium checks covered the mobile picker and desktop window, all four styles, persisted selection after reload, full/widget/off, image and Shuffle switching, Sky's simulated WebGL2 fallback, Atmosphere's independent WebGL1 canvas, and the studio's six presets, sharp snow, pause stability and live-wallpaper handoff. The standalone studio mounts only its own two canvases. Existing weather fetching, shared scene derivation, Sky shaders/renderer, provider and widget implementation remain unchanged from upstream.
