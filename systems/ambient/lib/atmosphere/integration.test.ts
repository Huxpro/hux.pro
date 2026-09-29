import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveWeatherScene } from "../scene.ts";
import { getWeatherStyleGradient, getClassicGradient, sceneToCssGradient } from "../gradient.ts";
import { readWeatherStyle, resolveWeatherStyle, WEATHER_STYLE_ENGINE, WALLPAPER_LOOK_FAMILY } from "../wallpaper.ts";
import { atmosphereGradient, toAtmosphereScene } from "./scene.ts";
import { createSkyRenderer, packedNoise } from "./renderer.ts";
import { SNAPPED_KEYS } from "./scene.ts";
import { GUST, gustStep } from "../wallpaper/stir.ts";

const conditions = ["clear", "cloudy", "fog", "rain", "snow", "thunder"] as const;

test("saved styles round-trip without changing defaults or Sky's fallback", () => {
  for (const style of ["sky", "atmosphere", "gradient", "classic"] as const) {
    assert.equal(readWeatherStyle(JSON.parse(JSON.stringify(style))), style);
    assert.equal(resolveWeatherStyle({ weatherStyle: style, shaderSupported: true }), style);
    assert.equal(resolveWeatherStyle({ weatherStyle: style, shaderSupported: false }), style === "sky" ? "gradient" : style);
  }
  for (const invalid of [null, undefined, "", "unknown", {}]) assert.equal(readWeatherStyle(invalid), "sky");
  assert.equal(WEATHER_STYLE_ENGINE.sky, "shader");
  assert.equal(WEATHER_STYLE_ENGINE.atmosphere, "atmosphere");
  assert.equal(WALLPAPER_LOOK_FAMILY.atmosphere, "picture");
});

test("all live conditions adapt without mutating the existing scene or CSS styles", () => {
  for (const condition of conditions) for (const theme of ["light", "dark"] as const) {
    for (const hour of [0, 6, 12, 18]) {
      const scene = deriveWeatherScene({ nowMs: Date.UTC(2026, 8, 25, hour), lat: 35, lon: 0, theme,
        weather: { condition, cloudCover: 0.83, precipitationIntensity: 0.7, windSpeedKmh: 32, windDirectionDeg: 250 }, seed: 17 });
      const before = structuredClone(scene);
      const alternative = toAtmosphereScene(scene);
      assert.deepEqual(scene, before);
      assert.equal(alternative.cloud, 0.83);
      assert.equal(alternative.rain, scene.precipitation.type === "rain" ? scene.precipitation.intensity : 0);
      assert.equal(alternative.snow, scene.precipitation.type === "snow" ? scene.precipitation.intensity : 0);
      assert.equal(alternative.storm, scene.lightning);
      assert.equal(alternative.fog, scene.fog);
      // Across the view as the Sky has it; into the view from the world wind.
      assert.deepEqual(alternative.wind, [scene.wind.x, -scene.windWorld.north * scene.hemisphere]);
      assert.deepEqual(alternative.sun, [scene.sun.screen.x, 1 - scene.sun.screen.y]);
      assert.equal(alternative.moonPhase, scene.moon.phase);
      // The real moon and the real night, unhidden: the volume does the hiding.
      assert.deepEqual(alternative.moon, [scene.moon.screen.x, 1 - scene.moon.screen.y]);
      assert.ok(alternative.moonVisible <= scene.behind.moon + 1e-12);
      assert.equal(alternative.moonSize, scene.moon.size);
      assert.equal(alternative.stars, scene.behind.stars);
      assert.equal(alternative.density, scene.clouds.density);
      assert.equal(alternative.darkness, scene.clouds.darkness);
      assert.equal(alternative.hemisphere, scene.hemisphere);
      for (const value of Object.values(alternative).flat()) assert.ok(Number.isFinite(value));
      assert.equal(getWeatherStyleGradient("sky", scene, "afternoon"), sceneToCssGradient(scene));
      assert.equal(getWeatherStyleGradient("gradient", scene, "afternoon"), sceneToCssGradient(scene));
      assert.equal(getWeatherStyleGradient("classic", scene, "afternoon"), getClassicGradient(scene, "afternoon"));
      assert.equal(getWeatherStyleGradient("atmosphere", scene, "afternoon"), atmosphereGradient(scene));
    }
  }
});

test("Atmosphere gracefully declines a missing WebGL context", () => {
  const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
  assert.equal(createSkyRenderer(canvas), null);
});

test("one noise fetch returns what two did: green is red one z-slice on", () => {
  const size = 32, data = packedNoise(size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const on = (((y + 17) % size) * size + (x + 37) % size) * 4;
    assert.equal(data[(y * size + x) * 4 + 1], data[on]);
  }
});

test("only the cyclic and discrete fields snap", () => {
  const scene = toAtmosphereScene(deriveWeatherScene({ nowMs: Date.UTC(2026, 8, 25, 22), lat: -33, lon: 151, theme: "dark", weather: { condition: "clear" }, seed: 1 }));
  for (const key of SNAPPED_KEYS) assert.equal(typeof scene[key], "number");
  assert.equal(scene.hemisphere, -1);
});

test("a hand's gust arrives at once and passes slowly, in either engine", () => {
  const stirAt = 1000;
  let gust = 0, now = stirAt;
  for (let i = 0; i < 12; i++) { now += 16; gust = gustStep(gust, GUST.max, now - 8, now, 0.016); }
  assert.ok(gust > GUST.max * 0.6, `rose to ${gust}`);
  const peak = gust;
  now += 1000; gust = gustStep(gust, GUST.max, stirAt, now, 1);
  assert.ok(gust < peak && gust > peak * 0.3, `still half itself a second later: ${gust}`);
  for (let i = 0; i < 60; i++) { now += 250; gust = gustStep(gust, GUST.max, stirAt, now, 0.25); }
  assert.equal(gust, 0);
});

test("Atmosphere sits in the theme's lightness, as the shared scene does", () => {
  const lum = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const at = (hour: number, theme: "light" | "dark") => toAtmosphereScene(deriveWeatherScene({
    nowMs: Date.UTC(2026, 8, 25, hour), lat: 51.5, lon: 0, theme, weather: { condition: "clear" }, seed: 3 }));
  // Night: the light theme lifts it, the dark theme leaves it.
  assert.ok(lum(at(23, "light").zenith) > lum(at(23, "dark").zenith) + 0.2);
  // Noon: the dark theme presses it down, the light theme leaves it.
  assert.ok(lum(at(12, "dark").horizon) < lum(at(12, "light").horizon) - 0.2);
  // A lifted night's moon is a day moon.
  assert.ok(at(23, "light").moonVisible < at(23, "dark").moonVisible || at(23, "dark").moonVisible === 0);
});
