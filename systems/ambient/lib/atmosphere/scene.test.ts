import assert from "node:assert/strict";
import { test } from "node:test";
import { lightningAt } from "./lightning.ts";
import { deriveSkyScene, solarPosition } from "./scene.ts";
import { normalizeWeatherCode } from "../weather.ts";

const now = Date.UTC(2026, 2, 20, 12);
test("solar lighting follows coordinates and UTC, including polar day/night", () => {
  assert.ok(solarPosition(now,0,0).elevation > 87);
  assert.ok(solarPosition(now,0,180).elevation < -87);
  assert.ok(solarPosition(Date.UTC(2026,5,21),80,0).elevation > 0);
  assert.ok(solarPosition(Date.UTC(2026,11,21,12),80,0).elevation < 0);
});
test("sunrise lighting evolves continuously rather than switching phase palettes", () => {
  let previous = deriveSkyScene({ nowMs: now-8*3600000,latitude:35,longitude:0 });
  for (let minute=1;minute<=240;minute++) {
    const next = deriveSkyScene({ nowMs: now-8*3600000+minute*60000,latitude:35,longitude:0 });
    assert.ok(Math.abs(next.daylight-previous.daylight)<0.04);
    next.horizon.forEach((value,i)=>assert.ok(Math.abs(value-previous.horizon[i])<0.04));
    previous = next;
  }
});
test("all WMO precipitation families are classified, including snow showers", () => {
  for(const code of [51,53,55,56,57,61,63,65,66,67,80,81,82]) assert.equal(normalizeWeatherCode(code),"rain");
  for(const code of [71,73,75,77,85,86]) assert.equal(normalizeWeatherCode(code),"snow");
  for(const code of [95,96,99]) assert.equal(normalizeWeatherCode(code),"thunder");
});
test("live intensity, clear intervals and previews do not inherit unrelated precipitation", () => {
  const weather = {condition:"rain" as const, weatherCode:63,temperatureC:10,updatedAt:now,precipitationMmH:8,cloudCover:1};
  const wet = deriveSkyScene({weather,nowMs:now});
  const dry = deriveSkyScene({weather:{...weather,precipitationMmH:0},nowMs:now});
  const preview = deriveSkyScene({weather,nowMs:now,condition:"clear",isDay:false});
  assert.ok(wet.rain>dry.rain);
  assert.equal(dry.rain,0);
  assert.equal(preview.rain,0);
  assert.ok(preview.cloud<0.1);
  assert.equal(preview.daylight,0);
});
test("all weather/time combinations produce finite bounded uniforms", () => {
  for(const condition of ["clear","cloudy","fog","rain","snow","thunder"] as const) {
    for(const phase of ["sunrise","morning","afternoon","sunset","evening","night"] as const) {
      const scene = deriveSkyScene({nowMs:now,condition,phase});
      for(const value of Object.values(scene).flat()) assert.ok(Number.isFinite(value));
      for(const key of ["cloud","rain","snow","fog","storm","daylight","twilight","moonPhase"] as const) assert.ok(scene[key]>=0&&scene[key]<=1);
      if(condition === "thunder") assert.equal(scene.storm,1);
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
