import assert from "node:assert/strict";
import { test } from "node:test";
import { lightningAt, STRIKE_LIFE, strikeAt } from "./lightning.ts";
import { toAtmosphereScene } from "./scene.ts";
import { deriveWeatherScene } from "../scene.ts";
import { normalizeWeatherCode } from "../weather.ts";

const now = Date.UTC(2026, 2, 20, 12);
const at = (nowMs: number, weather: Parameters<typeof deriveWeatherScene>[0]["weather"], theme: "light" | "dark" = "dark") =>
  toAtmosphereScene(deriveWeatherScene({ nowMs, lat: 35, lon: 0, theme, weather, seed: 7 }));

test("sunrise evolves continuously: the palette is the shared scene's, minute by minute", () => {
  let previous = at(now - 8 * 3600000, { condition: "clear" });
  for (let minute = 1; minute <= 240; minute++) {
    const next = at(now - 8 * 3600000 + minute * 60000, { condition: "clear" });
    for (const key of ["zenith", "horizon", "glow", "cloudLight"] as const) {
      next[key].forEach((value, i) => assert.ok(Math.abs(value - previous[key][i]) < 0.04, `${key} jumped at minute ${minute}`));
    }
    assert.ok(Math.abs(next.daylight - previous.daylight) < 0.04);
    previous = next;
  }
});

test("all WMO precipitation families are classified, including snow showers", () => {
  for(const code of [51,53,55,56,57,61,63,65,66,67,80,81,82]) assert.equal(normalizeWeatherCode(code),"rain");
  for(const code of [71,73,75,77,85,86]) assert.equal(normalizeWeatherCode(code),"snow");
  for(const code of [95,96,99]) assert.equal(normalizeWeatherCode(code),"thunder");
});
test("all weather × hour × theme combinations produce finite, bounded uniforms", () => {
  for (const condition of ["clear", "cloudy", "fog", "rain", "snow", "thunder"] as const) {
    for (const hour of [0, 5, 6, 9, 12, 17, 18, 21]) for (const theme of ["light", "dark"] as const) {
      const scene = at(Date.UTC(2026, 8, 20, hour), { condition }, theme);
      for (const value of Object.values(scene).flat()) assert.ok(Number.isFinite(value));
      for (const key of ["cloud", "rain", "snow", "fog", "storm", "daylight", "moonPhase", "moonVisible", "stars", "glowStrength"] as const) {
        assert.ok(scene[key] >= 0 && scene[key] <= 1, `${condition} ${hour}h ${theme}: ${key}=${scene[key]}`);
      }
      if (condition === "thunder") assert.ok(scene.storm > 0);
      if (condition === "clear") assert.equal(scene.rain + scene.snow, 0);
    }
  }
});

test("storms show an early double stroke, coherent illumination, and a quiet interval", () => {
  assert.equal(lightningAt(1, true).bolt, 0);
  const first = lightningAt(1.72, true), second = lightningAt(2.04, true);
  assert.ok(first.bolt > 0.95 && first.strength > 0.8);
  assert.ok(second.bolt > 0.65 && second.bolt < first.bolt);
  assert.equal(first.seed, second.seed);
  assert.equal(first.x, second.x);
  assert.equal(lightningAt(2.4, true).bolt, 0);
  assert.ok(lightningAt(2.4, true).strength > 0);
  assert.equal(lightningAt(5, true).strength, 0);
  for (let time = 0; time < 60; time += 0.05) {
    const disabled = lightningAt(time, false);
    assert.equal(disabled.bolt, 0);
    assert.equal(disabled.strength, 0);
  }
});

test("a clicked strike lands on the point, lit from the cloud above it, then retires", () => {
  const x = 0.3, y = 0.7;
  const peak = strikeAt(0.12, x, y, 5);
  assert.ok(peak.bolt > 0.95 && peak.strength > 0.8);
  assert.equal(peak.toX, x);
  assert.equal(peak.toY, y);
  // From the top of the sky, grown to the point within the stroke.
  assert.ok((peak.from ?? peak.y) < 0 && peak.y < y);
  assert.equal(strikeAt(0.01, x, y, 5).grow < 1, true);
  assert.equal(peak.grow, 1);
  assert.equal(strikeAt(-0.01, x, y, 5).bolt, 0);
  assert.equal(strikeAt(STRIKE_LIFE + 0.01, x, y, 5).strength, 0);
  // A click near the top still gets a channel out of the cloud base.
  const high = strikeAt(0.12, 0.5, 0.05, 5);
  assert.ok(high.y < high.toY);
});
