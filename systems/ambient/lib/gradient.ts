import type { AmbientPhase } from "./phase";
import type { SunEvent } from "./sun";
import type { WeatherCondition } from "./weather";

export type WeatherGradient = {
  backgroundImage: string;
};

/** One entry in the crossfade stack rendered by <GradientStack />. */
export interface GradientLayerData {
  id: number;
  gradient: string;
}

/** Duration of a gradient crossfade, shared by the provider and renderer. */
export const GRADIENT_CROSSFADE_MS = 1100;

export type SunEventGradient = {
  backgroundImage: string;
};

const BASE = {
  dark: "oklch(0.2178 0 0)",
  light: "oklch(1 0 0)",
} as const;

const HUE = {
  amber: 38,
  peach: 55,
  gold: 60,
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

type DayNightPalette = {
  day: { dark: ColorTriple; light: ColorTriple };
  night: { dark: ColorTriple; light: ColorTriple };
};

const WEATHER_PALETTE: Record<WeatherCondition, DayNightPalette> = {
  clear: {
    day: {
      dark: [oklch(0.42, 0.1, HUE.blue), oklch(0.26, 0.05, 255), BASE.dark],
      light: [oklch(0.97, 0.055, 95), oklch(0.95, 0.038, HUE.skyBlue), BASE.light],
    },
    night: {
      dark: [oklch(0.28, 0.07, HUE.indigo), oklch(0.18, 0.04, 270), BASE.dark],
      light: [oklch(0.93, 0.03, 270), oklch(0.96, 0.02, HUE.blue), BASE.light],
    },
  },
  partlyCloudy: {
    day: {
      dark: [oklch(0.38, 0.07, HUE.skyBlue), oklch(0.25, 0.035, 250), BASE.dark],
      light: [oklch(0.95, 0.04, 100), oklch(0.955, 0.028, HUE.cloudBlue), BASE.light],
    },
    night: {
      dark: [oklch(0.3, 0.05, HUE.blue), oklch(0.2, 0.03, HUE.indigo), BASE.dark],
      light: [oklch(0.92, 0.028, 260), oklch(0.958, 0.018, HUE.blue), BASE.light],
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
  drizzle: {
    day: {
      dark: [oklch(0.32, 0.05, 215), oklch(0.23, 0.035, 230), BASE.dark],
      light: [oklch(0.93, 0.028, 215), oklch(0.97, 0.018, HUE.cyan), BASE.light],
    },
    night: {
      dark: [oklch(0.3, 0.045, 230), oklch(0.21, 0.03, 245), BASE.dark],
      light: [oklch(0.92, 0.025, 230), oklch(0.965, 0.016, 220), BASE.light],
    },
  },
  rain: {
    day: {
      dark: [oklch(0.3, 0.075, HUE.blue), oklch(0.21, 0.05, 255), BASE.dark],
      light: [oklch(0.9, 0.035, HUE.blue), oklch(0.955, 0.022, HUE.cyan), oklch(0.98, 0.012, 220)],
    },
    night: {
      dark: [oklch(0.26, 0.06, 250), oklch(0.18, 0.04, 260), BASE.dark],
      light: [oklch(0.88, 0.03, HUE.indigo), oklch(0.95, 0.02, HUE.blue), BASE.light],
    },
  },
  snow: {
    day: {
      dark: [oklch(0.36, 0.045, HUE.lavender), oklch(0.23, 0.028, 260), BASE.dark],
      light: [oklch(0.96, 0.03, HUE.lavender), oklch(0.985, 0.018, 275), oklch(0.99, 0.012, HUE.lavender)],
    },
    night: {
      dark: [oklch(0.32, 0.05, HUE.twilight), oklch(0.2, 0.03, 270), BASE.dark],
      light: [oklch(0.94, 0.03, HUE.twilight), oklch(0.97, 0.02, HUE.lavender), oklch(0.983, 0.014, HUE.twilight)],
    },
  },
  thunder: {
    day: {
      dark: [oklch(0.26, 0.11, 280), oklch(0.18, 0.06, 265), BASE.dark],
      light: [oklch(0.9, 0.045, HUE.lavender), oklch(0.95, 0.025, HUE.blue), BASE.light],
    },
    night: {
      dark: [oklch(0.22, 0.1, 285), oklch(0.16, 0.055, 270), BASE.dark],
      light: [oklch(0.88, 0.04, HUE.twilight), oklch(0.94, 0.022, HUE.indigo), BASE.light],
    },
  },
};

const SUN_PALETTE: Record<SunEvent, { dark: ColorTriple; light: ColorTriple }> = {
  sunrise: {
    dark: [
      oklch(0.87, 0.12, 52, 0.42),
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
      oklch(0.81, 0.15, 59.7, 0.4),
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

const WEATHER_SUN_VEIL: Record<
  WeatherCondition,
  { dark: string; light: string }
> = {
  clear: { dark: "transparent", light: "transparent" },
  partlyCloudy: {
    dark: oklch(0.28, 0.02, 250, 0.18),
    light: oklch(0.92, 0.015, 230, 0.16),
  },
  cloudy: {
    dark: oklch(0.26, 0.015, 250, 0.32),
    light: oklch(0.88, 0.012, 230, 0.28),
  },
  fog: {
    dark: oklch(0.3, 0.012, 220, 0.4),
    light: oklch(0.94, 0.01, 210, 0.36),
  },
  drizzle: {
    dark: oklch(0.24, 0.04, 220, 0.28),
    light: oklch(0.86, 0.02, 215, 0.22),
  },
  rain: {
    dark: oklch(0.22, 0.05, 240, 0.38),
    light: oklch(0.82, 0.025, 225, 0.3),
  },
  snow: {
    dark: oklch(0.32, 0.03, 280, 0.26),
    light: oklch(0.96, 0.02, 275, 0.22),
  },
  thunder: {
    dark: oklch(0.18, 0.07, 285, 0.42),
    light: oklch(0.8, 0.03, 270, 0.28),
  },
};

type GradientGeometry = {
  r1: { w: number; h: number; x: number; y: number; fade: number };
  r2: { w: number; h: number; x: number; y: number; fade: number };
  linear: { end: number };
};

const GEOMETRY: Record<"weather" | "sunrise" | "sunset", GradientGeometry> = {
  weather: {
    r1: { w: 980, h: 560, x: 18, y: 8, fade: 72 },
    r2: { w: 1040, h: 580, x: 82, y: 2, fade: 68 },
    linear: { end: 72 },
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

const PHASE_GEOMETRY: Partial<Record<AmbientPhase, GradientGeometry>> = {
  morning: {
    r1: { w: 920, h: 540, x: 24, y: 14, fade: 70 },
    r2: { w: 1000, h: 560, x: 76, y: 6, fade: 66 },
    linear: { end: 70 },
  },
  afternoon: GEOMETRY.weather,
  evening: {
    r1: { w: 960, h: 520, x: 70, y: 10, fade: 70 },
    r2: { w: 880, h: 500, x: 22, y: 4, fade: 64 },
    linear: { end: 68 },
  },
  night: {
    r1: { w: 860, h: 480, x: 30, y: 6, fade: 68 },
    r2: { w: 920, h: 500, x: 78, y: 0, fade: 62 },
    linear: { end: 64 },
  },
};

function buildGradient(colors: ColorTriple, geometry: GradientGeometry): string {
  const [a, b, c] = colors;
  const { r1, r2, linear } = geometry;

  return [
    `radial-gradient(${r1.w}px ${r1.h}px at ${r1.x}% ${r1.y}%, ${a} 0%, transparent ${r1.fade}%)`,
    `radial-gradient(${r2.w}px ${r2.h}px at ${r2.x}% ${r2.y}%, ${b} 0%, transparent ${r2.fade}%)`,
    `linear-gradient(180deg, ${b} 0%, ${c} ${linear.end}%)`,
  ].join(", ");
}

function phaseIsDay(phase?: AmbientPhase, isDay?: boolean): boolean {
  if (phase === "sunrise" || phase === "morning" || phase === "afternoon") {
    return true;
  }
  if (phase === "sunset" || phase === "evening" || phase === "night") {
    return false;
  }
  return isDay ?? true;
}

function geometryForPhase(phase?: AmbientPhase): GradientGeometry {
  if (!phase) return GEOMETRY.weather;
  if (phase === "sunrise" || phase === "sunset") return GEOMETRY[phase];
  return PHASE_GEOMETRY[phase] ?? GEOMETRY.weather;
}

export function getWeatherGradient(params: {
  condition: WeatherCondition;
  isDay?: boolean;
  theme: "light" | "dark";
  phase?: AmbientPhase;
}): WeatherGradient {
  const isDay = phaseIsDay(params.phase, params.isDay);
  const palette = WEATHER_PALETTE[params.condition];
  const timeSlot = isDay ? palette.day : palette.night;
  const colors = params.theme === "dark" ? timeSlot.dark : timeSlot.light;

  return {
    backgroundImage: buildGradient(colors, geometryForPhase(params.phase)),
  };
}

export function getSunEventGradient(params: {
  event: SunEvent;
  theme: "light" | "dark";
}): SunEventGradient {
  const palette = SUN_PALETTE[params.event];
  const colors = params.theme === "dark" ? palette.dark : palette.light;
  const geometry = GEOMETRY[params.event];

  return {
    backgroundImage: buildGradient(colors, geometry),
  };
}

/**
 * CSS underlay used by widgets and as a WebGL fallback.
 * Sun events keep their cinematic palettes and pick up a weather veil so
 * sunrise-rain does not look like a cloudless golden hour.
 */
export function getAmbientGradient(params: {
  condition?: WeatherCondition;
  isDay?: boolean;
  theme: "light" | "dark";
  phase: AmbientPhase;
}): string {
  const { condition, isDay, theme, phase } = params;
  const sunEvent = phase === "sunrise" || phase === "sunset" ? phase : null;

  if (sunEvent) {
    const sun = getSunEventGradient({ event: sunEvent, theme }).backgroundImage;
    if (!condition) return sun;
    const veil = WEATHER_SUN_VEIL[condition][theme];
    if (veil === "transparent") return sun;
    const weatherWash = [
      `radial-gradient(1000px 620px at 50% 0%, ${veil} 0%, transparent 70%)`,
      `linear-gradient(180deg, ${veil} 0%, transparent 62%)`,
    ].join(", ");
    return `${weatherWash}, ${sun}`;
  }

  if (condition) {
    return getWeatherGradient({ condition, isDay, theme, phase }).backgroundImage;
  }

  return "";
}
