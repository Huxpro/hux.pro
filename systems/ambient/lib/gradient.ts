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
export const GRADIENT_CROSSFADE_MS = 700;

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

/** key glow, fill, horizon bloom, base */
type ColorStops = readonly [string, string, string, string];

function oklch(L: number, C: number, H: number, alpha?: number): string {
  return alpha !== undefined
    ? `oklch(${L} ${C} ${H} / ${alpha})`
    : `oklch(${L} ${C} ${H})`;
}

const WEATHER_PALETTE: Record<
  WeatherCondition,
  {
    day: { dark: ColorStops; light: ColorStops };
    night: { dark: ColorStops; light: ColorStops };
  }
> = {
  clear: {
    day: {
      dark: [
        oklch(0.52, 0.12, HUE.skyBlue),
        oklch(0.36, 0.08, HUE.blue),
        oklch(0.28, 0.05, 230),
        BASE.dark,
      ],
      light: [
        oklch(0.96, 0.06, 85),
        oklch(0.93, 0.045, HUE.skyBlue),
        oklch(0.97, 0.03, 200),
        BASE.light,
      ],
    },
    night: {
      dark: [
        oklch(0.34, 0.08, HUE.indigo),
        oklch(0.24, 0.05, HUE.blue),
        oklch(0.2, 0.035, HUE.indigo),
        BASE.dark,
      ],
      light: [
        oklch(0.93, 0.04, 270),
        oklch(0.95, 0.025, HUE.blue),
        oklch(0.975, 0.016, HUE.indigo),
        BASE.light,
      ],
    },
  },
  cloudy: {
    day: {
      dark: [
        oklch(0.4, 0.04, HUE.cloudBlue),
        oklch(0.3, 0.025, HUE.blue),
        oklch(0.24, 0.018, 250),
        BASE.dark,
      ],
      light: [
        oklch(0.88, 0.028, HUE.cloudBlue),
        oklch(0.94, 0.02, 230),
        oklch(0.975, 0.012, HUE.cloudBlue),
        oklch(0.99, 0.008, 230),
      ],
    },
    night: {
      dark: [
        oklch(0.32, 0.04, 255),
        oklch(0.24, 0.025, 260),
        oklch(0.2, 0.018, 250),
        BASE.dark,
      ],
      light: [
        oklch(0.87, 0.028, HUE.blue),
        oklch(0.94, 0.018, 245),
        oklch(0.975, 0.01, HUE.blue),
        oklch(0.99, 0.006, 250),
      ],
    },
  },
  fog: {
    day: {
      dark: [
        oklch(0.38, 0.02, 210),
        oklch(0.28, 0.016, HUE.cyan),
        oklch(0.22, 0.012, HUE.blue),
        BASE.dark,
      ],
      light: [
        oklch(0.9, 0.016, 205),
        oklch(0.955, 0.012, HUE.cyan),
        oklch(0.98, 0.008, 205),
        oklch(0.992, 0.005, 210),
      ],
    },
    night: {
      dark: [
        oklch(0.34, 0.025, 225),
        oklch(0.26, 0.018, 220),
        oklch(0.21, 0.014, HUE.blue),
        BASE.dark,
      ],
      light: [
        oklch(0.89, 0.016, 225),
        oklch(0.95, 0.012, 220),
        oklch(0.978, 0.008, 225),
        oklch(0.99, 0.005, 220),
      ],
    },
  },
  rain: {
    day: {
      dark: [
        oklch(0.36, 0.07, HUE.blue),
        oklch(0.26, 0.05, 250),
        oklch(0.2, 0.035, 255),
        BASE.dark,
      ],
      light: [
        oklch(0.9, 0.035, HUE.blue),
        oklch(0.95, 0.022, HUE.cyan),
        oklch(0.98, 0.014, 220),
        BASE.light,
      ],
    },
    night: {
      dark: [
        oklch(0.32, 0.075, HUE.indigo),
        oklch(0.24, 0.05, 255),
        oklch(0.19, 0.035, 260),
        BASE.dark,
      ],
      light: [
        oklch(0.9, 0.03, HUE.blue),
        oklch(0.95, 0.02, HUE.cyan),
        oklch(0.978, 0.012, 230),
        BASE.light,
      ],
    },
  },
  snow: {
    day: {
      dark: [
        oklch(0.4, 0.04, HUE.lavender),
        oklch(0.28, 0.028, 270),
        oklch(0.22, 0.02, 260),
        BASE.dark,
      ],
      light: [
        oklch(0.94, 0.028, HUE.lavender),
        oklch(0.97, 0.018, 275),
        oklch(0.985, 0.012, HUE.lavender),
        oklch(0.994, 0.008, 270),
      ],
    },
    night: {
      dark: [
        oklch(0.36, 0.05, HUE.twilight),
        oklch(0.26, 0.032, 275),
        oklch(0.2, 0.022, 270),
        BASE.dark,
      ],
      light: [
        oklch(0.93, 0.028, HUE.twilight),
        oklch(0.96, 0.018, HUE.lavender),
        oklch(0.982, 0.012, HUE.twilight),
        oklch(0.992, 0.008, 285),
      ],
    },
  },
  thunder: {
    day: {
      dark: [
        oklch(0.34, 0.11, 280),
        oklch(0.24, 0.07, 270),
        oklch(0.18, 0.045, 260),
        BASE.dark,
      ],
      light: [
        oklch(0.9, 0.045, HUE.lavender),
        oklch(0.95, 0.025, HUE.blue),
        oklch(0.978, 0.016, 270),
        BASE.light,
      ],
    },
    night: {
      dark: [
        oklch(0.3, 0.12, 285),
        oklch(0.22, 0.07, 270),
        oklch(0.17, 0.04, 260),
        BASE.dark,
      ],
      light: [
        oklch(0.9, 0.04, HUE.lavender),
        oklch(0.95, 0.022, HUE.blue),
        oklch(0.978, 0.014, 275),
        BASE.light,
      ],
    },
  },
};

const SUN_PALETTE: Record<SunEvent, { dark: ColorStops; light: ColorStops }> = {
  sunrise: {
    dark: [
      oklch(0.88, 0.14, 52, 0.55),
      oklch(0.52, 0.08, 40, 0.7),
      oklch(0.36, 0.04, 245, 0.82),
      oklch(0.2, 0.01, 260),
    ],
    light: [
      oklch(0.95, 0.13, HUE.peach),
      oklch(0.93, 0.08, HUE.gold),
      oklch(0.96, 0.04, HUE.cloudBlue),
      oklch(0.988, 0.016, HUE.warmBase),
    ],
  },
  sunset: {
    dark: [
      oklch(0.84, 0.17, 55, 0.5),
      oklch(0.48, 0.14, 28),
      oklch(0.36, 0.08, HUE.violet, 0.84),
      oklch(0.2, 0.03, 290),
    ],
    light: [
      oklch(0.94, 0.13, HUE.amber),
      oklch(0.91, 0.1, 22),
      oklch(0.95, 0.05, HUE.violet),
      oklch(0.985, 0.02, 45),
    ],
  },
};

type RadialSpec = { w: number; h: number; x: number; y: number; fade: number };

type GradientGeometry = {
  r1: RadialSpec;
  r2: RadialSpec;
  r3: RadialSpec;
  linear: { mid: number; end: number };
};

const GEOMETRY: Record<"weather" | "sunrise" | "sunset", GradientGeometry> = {
  weather: {
    r1: { w: 980, h: 560, x: 22, y: 8, fade: 68 },
    r2: { w: 920, h: 520, x: 78, y: 4, fade: 64 },
    r3: { w: 1400, h: 420, x: 50, y: 88, fade: 72 },
    linear: { mid: 42, end: 78 },
  },
  sunrise: {
    r1: { w: 920, h: 540, x: 18, y: 78, fade: 70 },
    r2: { w: 1100, h: 580, x: 72, y: 8, fade: 66 },
    r3: { w: 1500, h: 480, x: 40, y: 92, fade: 74 },
    linear: { mid: 40, end: 80 },
  },
  sunset: {
    r1: { w: 1040, h: 600, x: 84, y: 76, fade: 70 },
    r2: { w: 1100, h: 620, x: 28, y: 18, fade: 68 },
    r3: { w: 1560, h: 500, x: 60, y: 90, fade: 76 },
    linear: { mid: 38, end: 82 },
  },
};

function buildGradient(colors: ColorStops, geometry: GradientGeometry): string {
  const [key, fill, horizon, base] = colors;
  const { r1, r2, r3, linear } = geometry;

  return [
    `radial-gradient(${r1.w}px ${r1.h}px at ${r1.x}% ${r1.y}%, ${key} 0%, transparent ${r1.fade}%)`,
    `radial-gradient(${r2.w}px ${r2.h}px at ${r2.x}% ${r2.y}%, ${fill} 0%, transparent ${r2.fade}%)`,
    `radial-gradient(${r3.w}px ${r3.h}px at ${r3.x}% ${r3.y}%, ${horizon} 0%, transparent ${r3.fade}%)`,
    `linear-gradient(180deg, ${fill} 0%, ${horizon} ${linear.mid}%, ${base} ${linear.end}%)`,
  ].join(", ");
}

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
    backgroundImage: buildGradient(colors, GEOMETRY.weather),
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
