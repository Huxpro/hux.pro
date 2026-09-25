import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveWeatherScene } from "../scene.ts";
import { getWeatherStyleGradient, getClassicGradient, sceneToCssGradient } from "../gradient.ts";
import { readWeatherStyle, resolveWeatherStyle, WEATHER_STYLE_ENGINE, WALLPAPER_LOOK_FAMILY } from "../wallpaper.ts";
import { atmosphereGradient, toAtmosphereScene } from "./scene.ts";
import { createSkyRenderer } from "./renderer.ts";

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
      assert.deepEqual(alternative.wind, [scene.wind.x, scene.wind.y]);
      assert.deepEqual(alternative.sun, [scene.sun.screen.x, 1 - scene.sun.screen.y]);
      assert.equal(alternative.moonPhase, scene.moon.phase);
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
