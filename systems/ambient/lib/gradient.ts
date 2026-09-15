// =============================================================================
// CSS gradient renderer for a WeatherScene.
//
// This is the wallpaper's *fallback* path — widget mode, browsers without
// WebGL, and `prefers-reduced-motion`. It paints the same palette the shader
// uses (sky zenith → horizon, sun glow at the real sun position, a soft cloud
// wash) so switching renderers never changes the mood, only the fidelity.
// =============================================================================

import type { SunEvent } from "./sun";
import type { WeatherCondition } from "./weather";
import { mixRGB, rgbToCss, type RGB, type WeatherScene } from "./scene";

export type WeatherGradient = {
  backgroundImage: string;
};

/**
 * One entry in the crossfade stack rendered by <GradientStack />.
 *
 * The stack is source-agnostic: a layer is whatever the active wallpaper source
 * produced — a weather/sun-event gradient, or a picture wallpaper — so switching
 * sources crossfades through the same machinery as a weather change.
 */
export interface GradientLayerData {
  id: number;
  gradient: string;
  /**
   * Size the layer to cover the frame instead of stretching it. Picture
   * wallpapers need this; CSS-gradient layers already fill their box.
   */
  cover?: boolean;
}

/** Duration of a gradient crossfade, shared by the provider and renderer. */
export const GRADIENT_CROSSFADE_MS = 700;

export type SunEventGradient = {
  backgroundImage: string;
};

/**
 * Extra veil applied on the CSS path. Flat gradients have no cloud texture to
 * carry the colour, so they read heavier than the shader at the same veil;
 * lifting them keeps text contrast comfortable over the page background.
 */
const CSS_VEIL_BOOST = { light: 0.28, dark: 0.18 } as const;

function veiled(c: RGB, scene: WeatherScene): RGB {
  const amount = Math.min(
    1,
    scene.veil.amount + CSS_VEIL_BOOST[scene.theme]
  );
  return mixRGB(c, scene.veil.color, amount);
}

export function sceneToCssGradient(scene: WeatherScene): string {
  const zenith = veiled(scene.sky.zenith, scene);
  const horizon = veiled(scene.sky.horizon, scene);
  const glow = veiled(scene.sky.glow, scene);
  const cloud = veiled(
    mixRGB(scene.clouds.lit, scene.clouds.shade, scene.clouds.darkness * 0.6),
    scene
  );

  const sunX = (scene.sun.screen.x * 100).toFixed(1);
  // CSS y runs top → bottom; scene y runs bottom → top.
  const sunY = ((1 - scene.sun.screen.y) * 100).toFixed(1);
  const glowAlpha = scene.sky.glowStrength * 0.85;
  const cloudAlpha = 0.25 + scene.clouds.cover * 0.55;
  const cloudX = scene.sun.screen.x < 0.5 ? 82 : 18;

  const layers = [
    `radial-gradient(1100px 620px at ${sunX}% ${sunY}%, ${rgbToCss(glow, glowAlpha)} 0%, ${rgbToCss(glow, glowAlpha * 0.35)} 28%, transparent 68%)`,
    `radial-gradient(900px 520px at ${cloudX}% 8%, ${rgbToCss(cloud, cloudAlpha)} 0%, transparent 70%)`,
    `linear-gradient(180deg, ${rgbToCss(zenith)} 0%, ${rgbToCss(mixRGB(zenith, horizon, 0.55))} 55%, ${rgbToCss(horizon)} 100%)`,
  ];

  if (scene.fog > 0.2) {
    layers.unshift(
      `linear-gradient(0deg, ${rgbToCss(horizon, scene.fog * 0.8)} 0%, transparent 60%)`
    );
  }

  return layers.join(", ");
}

// -----------------------------------------------------------------------------
// Devtool previews — the original hand-tuned palette table.
//
// The scene-derived gradient above is what the page renders; these thumbnails
// exist to tell conditions apart at a glance, so they keep the older, more
// saturated per-condition colours rather than the veiled real palette.
// -----------------------------------------------------------------------------

const BASE = {
  dark: "oklch(0.2178 0 0)",
  light: "oklch(1 0 0)",
} as const;

const HUE = {
  amber: 38,
  peach: 55,
  warmBase: 85,
  cyan: 200,
  skyBlue: 210,
  cloudBlue: 235,
  blue: 250,
  indigo: 265,
  lavender: 285,
  violet: 290,
  twilight: 295,
} as const;

type ColorTriple = readonly [key: string, fill: string, base: string];

function oklch(L: number, C: number, H: number, alpha?: number): string {
  return alpha !== undefined
    ? `oklch(${L} ${C} ${H} / ${alpha})`
    : `oklch(${L} ${C} ${H})`;
}

const WEATHER_PALETTE: Record<
  WeatherCondition,
  {
    day: { dark: ColorTriple; light: ColorTriple };
    night: { dark: ColorTriple; light: ColorTriple };
  }
> = {
  clear: {
    day: {
      dark: [oklch(0.38, 0.08, HUE.blue), oklch(0.24, 0.04, 260), BASE.dark],
      light: [oklch(0.97, 0.05, 95), oklch(0.95, 0.03, HUE.skyBlue), BASE.light],
    },
    night: {
      dark: [oklch(0.3, 0.06, HUE.blue), oklch(0.2, 0.03, HUE.indigo), BASE.dark],
      light: [oklch(0.94, 0.03, 270), oklch(0.96, 0.02, HUE.blue), BASE.light],
    },
  },
  cloudy: {
    day: {
      dark: [oklch(0.33, 0.03, HUE.blue), oklch(0.24, 0.02, 260), BASE.dark],
      light: [oklch(0.9, 0.03, HUE.cloudBlue), oklch(0.965, 0.018, 230), oklch(0.985, 0.01, HUE.cloudBlue)],
    },
    night: {
      dark: [oklch(0.3, 0.035, 255), oklch(0.22, 0.02, 260), BASE.dark],
      light: [oklch(0.89, 0.03, HUE.blue), oklch(0.955, 0.02, 245), oklch(0.983, 0.01, HUE.blue)],
    },
  },
  fog: {
    day: {
      dark: [oklch(0.34, 0.025, 215), oklch(0.205, 0.015, HUE.blue), BASE.dark],
      light: [oklch(0.92, 0.018, 205), oklch(0.97, 0.012, HUE.cyan), oklch(0.985, 0.008, 205)],
    },
    night: {
      dark: [oklch(0.32, 0.03, 225), oklch(0.215, 0.018, HUE.blue), BASE.dark],
      light: [oklch(0.91, 0.018, 225), oklch(0.96, 0.012, 220), oklch(0.983, 0.008, 225)],
    },
  },
  rain: {
    day: {
      dark: [oklch(0.3, 0.07, HUE.blue), oklch(0.22, 0.05, 255), BASE.dark],
      light: [oklch(0.95, 0.03, HUE.blue), oklch(0.97, 0.02, HUE.cyan), BASE.light],
    },
    night: {
      dark: [oklch(0.3, 0.07, HUE.blue), oklch(0.22, 0.05, 255), BASE.dark],
      light: [oklch(0.95, 0.03, HUE.blue), oklch(0.97, 0.02, HUE.cyan), BASE.light],
    },
  },
  snow: {
    day: {
      dark: [oklch(0.34, 0.04, HUE.lavender), oklch(0.22, 0.025, 260), BASE.dark],
      light: [oklch(0.95, 0.03, HUE.lavender), oklch(0.98, 0.02, 275), oklch(0.985, 0.014, HUE.lavender)],
    },
    night: {
      dark: [oklch(0.32, 0.045, HUE.twilight), oklch(0.215, 0.028, 270), BASE.dark],
      light: [oklch(0.94, 0.03, HUE.twilight), oklch(0.97, 0.02, HUE.lavender), oklch(0.983, 0.014, HUE.twilight)],
    },
  },
  thunder: {
    day: {
      dark: [oklch(0.28, 0.1, 275), oklch(0.21, 0.05, 260), BASE.dark],
      light: [oklch(0.94, 0.04, HUE.lavender), oklch(0.96, 0.02, HUE.blue), BASE.light],
    },
    night: {
      dark: [oklch(0.28, 0.1, 275), oklch(0.21, 0.05, 260), BASE.dark],
      light: [oklch(0.94, 0.04, HUE.lavender), oklch(0.96, 0.02, HUE.blue), BASE.light],
    },
  },
};

const SUN_PALETTE: Record<SunEvent, { dark: ColorTriple; light: ColorTriple }> = {
  sunrise: {
    dark: [
      oklch(0.87, 0.12, 52, 0.4),
      oklch(0.48, 0.02, 245, 0.8),
      oklch(0.22, 0, 0),
    ],
    light: [
      oklch(0.94, 0.11, HUE.peach),
      oklch(0.92, 0.06, HUE.cloudBlue),
      oklch(0.985, 0.018, HUE.warmBase),
    ],
  },
  sunset: {
    dark: [
      oklch(0.81, 0.15, 59.7, 0.38),
      oklch(0.35, 0.1, 32),
      oklch(0.34, 0.02, HUE.violet, 0.78),
    ],
    light: [
      oklch(0.93, 0.11, HUE.amber),
      oklch(0.91, 0.08, 25),
      oklch(0.98, 0.02, 50),
    ],
  },
};

type GradientGeometry = {
  r1: { w: number; h: number; x: number; y: number; fade: number };
  r2: { w: number; h: number; x: number; y: number; fade: number };
  linear: { end: number };
};

const GEOMETRY: Record<"weather" | "sunrise" | "sunset", GradientGeometry> = {
  weather: {
    r1: { w: 900, h: 500, x: 20, y: 10, fade: 70 },
    r2: { w: 900, h: 500, x: 80, y: 0, fade: 65 },
    linear: { end: 70 },
  },
  sunrise: {
    r1: { w: 900, h: 520, x: 22, y: 12, fade: 70 },
    r2: { w: 980, h: 540, x: 78, y: 6, fade: 66 },
    linear: { end: 72 },
  },
  sunset: {
    r1: { w: 980, h: 560, x: 28, y: 28, fade: 72 },
    r2: { w: 1050, h: 600, x: 72, y: 18, fade: 68 },
    linear: { end: 74 },
  },
};

function buildPreviewGradient(colors: ColorTriple, geometry: GradientGeometry): string {
  const [a, b, c] = colors;
  const { r1, r2, linear } = geometry;

  return [
    `radial-gradient(${r1.w}px ${r1.h}px at ${r1.x}% ${r1.y}%, ${a} 0%, transparent ${r1.fade}%)`,
    `radial-gradient(${r2.w}px ${r2.h}px at ${r2.x}% ${r2.y}%, ${b} 0%, transparent ${r2.fade}%)`,
    `linear-gradient(180deg, ${b} 0%, ${c} ${linear.end}%)`,
  ].join(", ");
}

/** Devtool thumbnail for a condition (day / night × theme). */
export function getWeatherGradient(params: {
  condition: WeatherCondition;
  isDay?: boolean;
  theme: "light" | "dark";
}): WeatherGradient {
  const isDay = params.isDay ?? true;
  const palette = WEATHER_PALETTE[params.condition];
  const timeSlot = isDay ? palette.day : palette.night;
  const colors = params.theme === "dark" ? timeSlot.dark : timeSlot.light;

  return {
    backgroundImage: buildPreviewGradient(colors, GEOMETRY.weather),
  };
}

/** Devtool thumbnail for a sunrise / sunset phase. */
export function getSunEventGradient(params: {
  event: SunEvent;
  theme: "light" | "dark";
}): SunEventGradient {
  const palette = SUN_PALETTE[params.event];
  const colors = params.theme === "dark" ? palette.dark : palette.light;
  const geometry = GEOMETRY[params.event];

  return {
    backgroundImage: buildPreviewGradient(colors, geometry),
  };
}

/**
 * The Classic weather style: the original palettes, chosen the way the page
 * always chose them — the sunrise or sunset gradient during those phases,
 * otherwise the condition's day or night palette. It steps at phase and
 * weather changes rather than following the clock, which is the point of it.
 */
export function getClassicGradient(params: {
  condition: WeatherCondition;
  isDay: boolean;
  phase: "sunrise" | "morning" | "afternoon" | "evening" | "sunset" | "night";
  theme: "light" | "dark";
}): string {
  if (params.phase === "sunrise" || params.phase === "sunset") {
    return getSunEventGradient({ event: params.phase, theme: params.theme }).backgroundImage;
  }
  return getWeatherGradient({
    condition: params.condition,
    isDay: params.isDay,
    theme: params.theme,
  }).backgroundImage;
}
