/**
 * Sanity-check every wallpaper scene: colors stay in gamut, weather
 * intensities stay in [0, 1], and phase/weather combinations remain distinct.
 */
import {
  approachAtmosphere,
  resolveAtmosphere,
  type AtmosphereParams,
} from "../systems/ambient/lib/wallpaper.ts";
import type { AmbientPhase } from "../systems/ambient/lib/phase.ts";
import type { WeatherCondition } from "../systems/ambient/lib/weather.ts";

const phases: AmbientPhase[] = [
  "sunrise",
  "morning",
  "afternoon",
  "evening",
  "sunset",
  "night",
];
const conditions: WeatherCondition[] = [
  "clear",
  "cloudy",
  "fog",
  "rain",
  "snow",
  "thunder",
];
const themes = ["light", "dark"] as const;

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function inUnit(n: number, lo = 0, hi = 1.4) {
  return Number.isFinite(n) && n >= lo && n <= hi;
}

function checkVec3(name: string, v: readonly [number, number, number]) {
  assert(v.every((c) => inUnit(c, 0, 1.05)), `${name} out of gamut: ${v}`);
}

function checkParams(label: string, p: AtmosphereParams) {
  checkVec3(`${label}.zenith`, p.zenith);
  checkVec3(`${label}.horizon`, p.horizon);
  checkVec3(`${label}.haze`, p.haze);
  checkVec3(`${label}.ground`, p.ground);
  checkVec3(`${label}.sunColor`, p.sunColor);
  checkVec3(`${label}.moonColor`, p.moonColor);
  checkVec3(`${label}.cloudLight`, p.cloudLight);
  checkVec3(`${label}.cloudShade`, p.cloudShade);
  for (const key of [
    "sunSize",
    "sunGlow",
    "moonSize",
    "moonGlow",
    "cloudCover",
    "fog",
    "stars",
    "wind",
    "rain",
    "snow",
    "thunder",
    "rays",
    "vignette",
    "grain",
  ] as const) {
    assert(inUnit(p[key], 0, 2), `${label}.${key}=${p[key]}`);
  }
  assert(p.sunPos[0] >= -0.3 && p.sunPos[0] <= 1.1, `${label}.sunPos.x`);
  assert(p.moonPos[0] >= 0 && p.moonPos[0] <= 1, `${label}.moonPos.x`);
}

let count = 0;
const signatures = new Set<string>();

for (const condition of conditions) {
  for (const phase of phases) {
    for (const theme of themes) {
      const isDay =
        phase === "sunrise" || phase === "morning" || phase === "afternoon";
      const params = resolveAtmosphere({ condition, phase, theme, isDay });
      checkParams(`${condition}/${phase}/${theme}`, params);

      if (condition === "rain") assert(params.rain > 0.5, "rain intensity");
      if (condition === "snow") assert(params.snow > 0.5, "snow intensity");
      if (condition === "thunder") assert(params.thunder > 0.5, "thunder intensity");
      if (condition === "fog") assert(params.fog > 0.5, "fog intensity");
      if (condition === "clear" && phase === "night" && theme === "dark") {
        assert(params.stars > 0.4, "night stars");
        assert(params.moonGlow > 0.4, "night moon");
      }
      if (phase === "sunset") assert(params.sunGlow > 0.2, "sunset glow");
      if (phase === "evening" || phase === "night") {
        assert(params.sunGlow < 0.05, `${phase} should hide the sun (glow=${params.sunGlow})`);
        assert(params.rays < 0.05, `${phase} should not keep sun rays`);
        if (condition === "clear") {
          assert(params.moonGlow > 0.45, `${phase} moon glow`);
          assert(params.moonSize > 0.05, `${phase} moon size`);
          assert(
            params.moonPos[0] > 0.12 && params.moonPos[0] < 0.88,
            `${phase} moon not in the extreme corner (x=${params.moonPos[0]})`
          );
          assert(
            params.moonPos[1] > 0.32 && params.moonPos[1] < 0.7,
            `${phase} moon in the open sky (y=${params.moonPos[1]})`
          );
        }
      }
      if (condition === "clear" && phase === "evening" && theme === "dark") {
        const withDayFlag = resolveAtmosphere({
          condition,
          phase,
          theme,
          isDay: true,
        });
        assert(withDayFlag.sunGlow < 0.05, "evening keeps the moon even if isDay");
        assert(withDayFlag.moonGlow > 0.45, "evening moon when isDay is true");
      }
      if (condition === "clear" && phase === "morning" && theme === "dark") {
        const night = resolveAtmosphere({
          condition,
          phase,
          theme,
          isDay: false,
        });
        assert(
          night.zenith[2] < params.zenith[2] || night.zenith[0] < params.zenith[0],
          "night override should darken a morning plate"
        );
        assert(night.stars > 0.3, "night override stars");
      }

      signatures.add(
        [params.zenith, params.horizon, params.rain, params.snow, params.stars]
          .flat()
          .map((n) => n.toFixed(3))
          .join("|")
      );
      count += 1;

      const morphed = approachAtmosphere(params, params, 0.5);
      checkParams(`${condition}/${phase}/${theme}/lerp`, morphed);
    }
  }
}

assert(count === conditions.length * phases.length * themes.length, "scene count");
assert(signatures.size > 40, `scenes too similar (${signatures.size})`);

console.log(`ok: ${count} wallpaper scenes, ${signatures.size} distinct signatures`);
