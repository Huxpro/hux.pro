import type { SunEvent } from "@/lib/ambient/sun";
import type { WeatherCondition } from "@/lib/ambient/weather";

export type WeatherGradient = {
  backgroundImage: string;
};

export type SunEventGradient = {
  backgroundImage: string;
};

// =============================================================================
// COLOR CONSTANTS
// =============================================================================

/**
 * Shared base colors used across all gradient palettes.
 * These anchor the "floor" of each theme.
 */
const BASE = {
  /** Dark mode base: warm neutral black (~#141414) */
  dark: "oklch(0.2178 0 0)",
  /** Light mode base: pure white */
  light: "oklch(1 0 0)",
} as const;

// =============================================================================
// HUE FAMILIES
// =============================================================================

/**
 * OKLCH hue angles grouped by semantic meaning.
 * Using named constants makes the color relationships explicit.
 *
 * Hue wheel reference (OKLCH):
 *   0°   = pink/red
 *   30°  = orange
 *   60°  = yellow
 *   90°  = lime/yellow-green
 *   120° = green
 *   180° = cyan
 *   210° = sky blue
 *   240° = blue
 *   270° = indigo/violet
 *   300° = magenta
 *   330° = rose
 */
const HUE = {
  // Warm tones
  amber: 38,
  peach: 55,
  gold: 60,
  warmBase: 85,

  // Cool tones
  cyan: 200,
  skyBlue: 210,
  cloudBlue: 235,
  blue: 250,
  indigo: 265,
  lavender: 285,
  violet: 290,
  twilight: 295,
} as const;

// =============================================================================
// COLOR PALETTE HELPERS
// =============================================================================

type ColorTriple = readonly [key: string, fill: string, base: string];

/**
 * Creates an OKLCH color string with optional alpha.
 */
function oklch(L: number, C: number, H: number, alpha?: number): string {
  return alpha !== undefined
    ? `oklch(${L} ${C} ${H} / ${alpha})`
    : `oklch(${L} ${C} ${H})`;
}

// =============================================================================
// WEATHER COLOR PALETTES
// =============================================================================

/**
 * Color palette definitions for each weather condition.
 *
 * Structure per condition:
 *   - `day.dark`  / `day.light`   → daytime colors per theme
 *   - `night.dark` / `night.light` → nighttime colors per theme
 *
 * Each returns [keyLight, fillLight, baseWash]:
 *   - **keyLight (a)**: "mood spotlight" from top-left
 *   - **fillLight (b)**: "mood spotlight" from top-right + vertical wash start
 *   - **baseWash (c)**: page background tint the content sits on
 */
const WEATHER_PALETTE: Record<
  WeatherCondition,
  {
    day: { dark: ColorTriple; light: ColorTriple };
    night: { dark: ColorTriple; light: ColorTriple };
  }
> = {
  /**
   * Clear sky:
   * - Day: warm sun glow (amber key → soft blue fill)
   * - Night: cool moonlight (indigo → slate)
   */
  clear: {
    day: {
      dark: [oklch(0.38, 0.08, HUE.blue), oklch(0.24, 0.04, 260), BASE.dark],
      light: [
        oklch(0.97, 0.05, 95), // warm amber highlight
        oklch(0.95, 0.03, HUE.skyBlue),
        BASE.light,
      ],
    },
    night: {
      dark: [
        oklch(0.3, 0.06, HUE.blue),
        oklch(0.2, 0.03, HUE.indigo),
        BASE.dark,
      ],
      light: [
        oklch(0.94, 0.03, 270), // moonlit lavender
        oklch(0.96, 0.02, HUE.blue),
        BASE.light,
      ],
    },
  },

  /**
   * Cloudy:
   * - Day: pale blue-gray (visible in light mode; muted in dark)
   * - Night: slightly cooler and darker
   */
  cloudy: {
    day: {
      dark: [oklch(0.33, 0.03, HUE.blue), oklch(0.24, 0.02, 260), BASE.dark],
      light: [
        oklch(0.9, 0.03, HUE.cloudBlue), // Inspired by loe's vertical palette
        oklch(0.965, 0.018, 230),
        oklch(0.985, 0.01, HUE.cloudBlue), // tinted off-white base
      ],
    },
    night: {
      dark: [oklch(0.3, 0.035, 255), oklch(0.22, 0.02, 260), BASE.dark],
      light: [
        oklch(0.89, 0.03, HUE.blue),
        oklch(0.955, 0.02, 245),
        oklch(0.983, 0.01, HUE.blue),
      ],
    },
  },

  /**
   * Fog:
   * - Day: ethereal milk-glass (cool white with a whisper of cyan)
   * - Night: colder haze (leans bluer)
   */
  fog: {
    day: {
      dark: [oklch(0.34, 0.025, 215), oklch(0.205, 0.015, HUE.blue), BASE.dark],
      light: [
        oklch(0.92, 0.018, 205), // milk-glass top
        oklch(0.97, 0.012, HUE.cyan),
        oklch(0.985, 0.008, 205), // slightly tinted base
      ],
    },
    night: {
      dark: [oklch(0.32, 0.03, 225), oklch(0.215, 0.018, HUE.blue), BASE.dark],
      light: [
        oklch(0.91, 0.018, 225),
        oklch(0.96, 0.012, 220),
        oklch(0.983, 0.008, 225),
      ],
    },
  },

  /**
   * Rain:
   * - Day: cool blues (wet asphalt feel)
   * - Night: deeper blues/purples
   */
  rain: {
    day: {
      dark: [oklch(0.3, 0.07, HUE.blue), oklch(0.22, 0.05, 255), BASE.dark],
      light: [
        oklch(0.95, 0.03, HUE.blue),
        oklch(0.97, 0.02, HUE.cyan),
        BASE.light,
      ],
    },
    night: {
      // Night rain uses same palette as day (already moody enough)
      dark: [oklch(0.3, 0.07, HUE.blue), oklch(0.22, 0.05, 255), BASE.dark],
      light: [
        oklch(0.95, 0.03, HUE.blue),
        oklch(0.97, 0.02, HUE.cyan),
        BASE.light,
      ],
    },
  },

  /**
   * Snow:
   * - Day: bright but not flat (white with subtle lavender)
   * - Night: colder lavender-blue
   */
  snow: {
    day: {
      dark: [
        oklch(0.34, 0.04, HUE.lavender),
        oklch(0.22, 0.025, 260),
        BASE.dark,
      ],
      light: [
        oklch(0.95, 0.03, HUE.lavender),
        oklch(0.98, 0.02, 275),
        oklch(0.985, 0.014, HUE.lavender),
      ],
    },
    night: {
      dark: [
        oklch(0.32, 0.045, HUE.twilight),
        oklch(0.215, 0.028, 270),
        BASE.dark,
      ],
      light: [
        oklch(0.94, 0.03, HUE.twilight),
        oklch(0.97, 0.02, HUE.lavender),
        oklch(0.983, 0.014, HUE.twilight),
      ],
    },
  },

  /**
   * Thunder:
   * - Day: storm violet (electric)
   * - Night: deeper purple-black
   */
  thunder: {
    day: {
      dark: [oklch(0.28, 0.1, 275), oklch(0.21, 0.05, 260), BASE.dark],
      light: [
        oklch(0.94, 0.04, HUE.lavender),
        oklch(0.96, 0.02, HUE.blue),
        BASE.light,
      ],
    },
    night: {
      // Night thunder uses same palette as day (already dramatic)
      dark: [oklch(0.28, 0.1, 275), oklch(0.21, 0.05, 260), BASE.dark],
      light: [
        oklch(0.94, 0.04, HUE.lavender),
        oklch(0.96, 0.02, HUE.blue),
        BASE.light,
      ],
    },
  },
};

// =============================================================================
// SUN EVENT COLOR PALETTES
// =============================================================================

/**
 * Color palettes for sunrise/sunset events.
 * These override weather gradients during golden hour.
 */
const SUN_PALETTE: Record<SunEvent, { dark: ColorTriple; light: ColorTriple }> =
  {
    /**
     * Sunrise: hopeful + optimistic
     * - Light: airy peach/gold + clean sky blue
     * - Dark: 早餐刚亮起来的感觉 - soft warm glow, sky transitioning to daylight
     */
    sunrise: {
      dark: [
        oklch(0.62, 0.11, 44.94, 0.5), // warm golden glow (semi-transparent)
        oklch(0.33, 0.03, 245), // transitioning sky blue
        oklch(0.22, 0, 0), // near-black base
      ],
      light: [
        oklch(0.94, 0.11, HUE.peach), // dramatic sunrise glow
        oklch(0.92, 0.06, HUE.cloudBlue), // sky wash
        oklch(0.985, 0.018, HUE.warmBase), // warm off-white base
      ],
    },

    /**
     * Sunset: peaceful + nostalgic
     * - Light: golden-hour amber + warm rose into dusk
     * - Dark: Epic cinematic sunset - intense fiery highlights with deep twilight
     */
    sunset: {
      dark: [
        oklch(0.81, 0.15, 59.7, 0.38), // intense fiery amber (semi-transparent)
        oklch(0.35, 0.1, 32), // fiery wash
        oklch(0.34, 0.02, HUE.violet, 0.78), // deep twilight
      ],
      light: [
        oklch(0.93, 0.11, HUE.amber), // golden hour amber
        oklch(0.91, 0.08, 25), // warm rose/dusk fill
        oklch(0.98, 0.02, 50), // warm base
      ],
    },
  };

// =============================================================================
// GRADIENT PATTERNS
// =============================================================================

/**
 * Gradient geometry definitions.
 *
 * We use a 3-layer system:
 *   1. **Radial 1 (key)**: Primary "mood spotlight" - simulates directional lighting
 *   2. **Radial 2 (fill)**: Secondary fill light - balances the key
 *   3. **Linear (wash)**: Vertical gradient anchoring the overall page tint
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                                                                 │
 * │     ╭─────────╮                           ╭─────────╮          │
 * │    ╱  Radial  ╲                          ╱  Radial  ╲          │
 * │   │     1      │                        │     2      │         │
 * │   │   (key)    │                        │   (fill)   │         │
 * │    ╲          ╱                          ╲          ╱          │
 * │     ╰────────╯                            ╰────────╯           │
 * │                                                                 │
 * │  ═══════════════════════════════════════════════════════════   │
 * │                    Linear gradient (wash)                       │
 * │                    fills the background                         │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 */
type GradientGeometry = {
  /** Radial 1: key light */
  r1: { w: number; h: number; x: number; y: number; fade: number };
  /** Radial 2: fill light */
  r2: { w: number; h: number; x: number; y: number; fade: number };
  /** Linear: vertical wash */
  linear: { end: number };
};

const GEOMETRY: Record<"weather" | "sunrise" | "sunset", GradientGeometry> = {
  /**
   * Weather: Balanced symmetric lighting
   *
   * ```
   *      20%                           80%
   *   ╭───────╮                    ╭───────╮
   *   │ 900×500│                   │ 900×500│  ← y: 10%, 0%
   *   │  key   │                   │  fill  │
   *   ╰───────╯                    ╰───────╯
   *
   *   ════════════════════════════════════════
   *                 70% end
   * ```
   */
  weather: {
    r1: { w: 900, h: 500, x: 20, y: 10, fade: 70 },
    r2: { w: 900, h: 500, x: 80, y: 0, fade: 65 },
    linear: { end: 70 },
  },

  /**
   * Sunrise: Light higher in sky, cleaner atmosphere
   *
   * ```
   *       22%                          78%
   *   ╭────────╮                   ╭─────────╮
   *   │ 900×520│                   │ 980×540 │  ← y: 12%, 6%
   *   │   key  │                   │  fill   │
   *   ╰────────╯                   ╰─────────╯
   *
   *   ════════════════════════════════════════
   *                 72% end
   * ```
   */
  sunrise: {
    r1: { w: 900, h: 520, x: 22, y: 12, fade: 70 },
    r2: { w: 980, h: 540, x: 78, y: 6, fade: 66 },
    linear: { end: 72 },
  },

  /**
   * Sunset: Light sits closer to horizon (nostalgic, warm)
   *
   * ```
   *        28%                        72%
   *    ╭─────────╮                ╭───────────╮
   *    │ 980×560 │                │ 1050×600  │  ← y: 28%, 18%
   *    │   key   │                │   fill    │
   *    ╰─────────╯                ╰───────────╯
   *         ↓                          ↓
   *    (lower position = closer to horizon)
   *
   *   ════════════════════════════════════════
   *                 74% end
   * ```
   */
  sunset: {
    r1: { w: 980, h: 560, x: 28, y: 28, fade: 72 },
    r2: { w: 1050, h: 600, x: 72, y: 18, fade: 68 },
    linear: { end: 74 },
  },
};

// =============================================================================
// GRADIENT BUILDERS
// =============================================================================

/**
 * Composes a CSS background-image string from colors and geometry.
 */
function buildGradient(
  colors: ColorTriple,
  geometry: GradientGeometry
): string {
  const [a, b, c] = colors;
  const { r1, r2, linear } = geometry;

  return [
    `radial-gradient(${r1.w}px ${r1.h}px at ${r1.x}% ${r1.y}%, ${a} 0%, transparent ${r1.fade}%)`,
    `radial-gradient(${r2.w}px ${r2.h}px at ${r2.x}% ${r2.y}%, ${b} 0%, transparent ${r2.fade}%)`,
    `linear-gradient(180deg, ${b} 0%, ${c} ${linear.end}%)`,
  ].join(", ");
}

// =============================================================================
// PUBLIC API
// =============================================================================

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
