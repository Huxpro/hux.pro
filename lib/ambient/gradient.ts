import type { WeatherCondition } from "@/lib/ambient/weather";

export type WeatherGradient = {
  backgroundImage: string;
};

/**
 * Returns 3 OKLCH stops for our layered gradient renderer:
 * - **a**: key light (a “mood spotlight” from top-left)
 * - **b**: fill light (a “mood spotlight” from top-right + also used in the vertical wash)
 * - **c**: base wash (the page background tint the content sits on)
 *
 * Design notes:
 * - We keep chroma low to avoid fighting content readability, but we still want
 *   *visible* atmosphere—especially in light mode for cloudy/fog/snow.
 * - Dark mode uses deeper, more saturated tints because the base background is darker.
 */
function stopsFor(
  condition: WeatherCondition,
  isDay: boolean,
  theme: "light" | "dark"
) {
  const dark = theme === "dark";
  const day = isDay;

  switch (condition) {
    case "clear":
      // Clear sky:
      // - Day: warm sun glow (amber → soft blue)
      // - Night: cool moonlight (indigo → slate)
      return dark
        ? [
            day ? "oklch(0.38 0.08 255)" : "oklch(0.30 0.06 250)",
            day ? "oklch(0.24 0.04 260)" : "oklch(0.20 0.03 265)",
            "oklch(0.2178 0  0)",
          ]
        : [
            day ? "oklch(0.97 0.05 95)" : "oklch(0.94 0.03 270)",
            day ? "oklch(0.95 0.03 210)" : "oklch(0.96 0.02 250)",
            "oklch(1 0 0)",
          ];
    case "cloudy":
      // Cloudy:
      // - Day: pale blue-gray (visible in light mode; muted in dark mode)
      // - Night: slightly cooler and darker
      return dark
        ? [
            day ? "oklch(0.33 0.03 250)" : "oklch(0.30 0.035 255)",
            day ? "oklch(0.24 0.02 260)" : "oklch(0.22 0.02 260)",
            "oklch(0.2178 0 0)",
          ]
        : [
            // Inspired by loe’s vertical palette, but adapted for our radial + wash layers.
            // Push contrast a bit more than loe: slightly darker top + higher chroma.
            day ? "oklch(0.90 0.03 235)" : "oklch(0.89 0.03 250)",
            day ? "oklch(0.965 0.018 230)" : "oklch(0.955 0.02 245)",
            // Keep the base off-white and tinted (so it reads on pure-white pages).
            day ? "oklch(0.985 0.01 235)" : "oklch(0.983 0.01 250)",
          ];
    case "fog":
      // Fog:
      // - Day: ethereal milk-glass (cool white with a whisper of cyan)
      // - Night: colder haze (leans bluer)
      return dark
        ? [
            // Borrow from loe: keep it “soft”, but increase separation so it’s readable in dark mode.
            day ? "oklch(0.34 0.025 215)" : "oklch(0.32 0.03 225)",
            day ? "oklch(0.205 0.015 250)" : "oklch(0.215 0.018 250)",
            "oklch(0.2178 0 0)",
          ]
        : [
            // Increase visibility: darker top + more chroma, and a slightly more tinted base.
            day ? "oklch(0.92 0.018 205)" : "oklch(0.91 0.018 225)",
            day ? "oklch(0.97 0.012 200)" : "oklch(0.96 0.012 220)",
            day ? "oklch(0.985 0.008 205)" : "oklch(0.983 0.008 225)",
          ];
    case "rain":
      // Rain:
      // - Day: cool blues (wet asphalt)
      // - Night: deeper blues/purples
      return dark
        ? ["oklch(0.30 0.07 250)", "oklch(0.22 0.05 255)", "oklch(0.2178 0 0)"]
        : ["oklch(0.95 0.03 250)", "oklch(0.97 0.02 200)", "oklch(1 0 0)"];
    case "snow":
      // Snow:
      // - Day: bright but not flat (white with subtle lavender)
      // - Night: colder lavender-blue
      return dark
        ? [
            // Increase dark-mode contrast (loe uses more chroma for snow/thunder).
            day ? "oklch(0.34 0.04 285)" : "oklch(0.32 0.045 295)",
            day ? "oklch(0.22 0.025 260)" : "oklch(0.215 0.028 270)",
            "oklch(0.2178 0 0)",
          ]
        : [
            // Increase visibility in light mode: stronger lavender tint + lower base lightness.
            day ? "oklch(0.95 0.03 285)" : "oklch(0.94 0.03 295)",
            day ? "oklch(0.98 0.02 275)" : "oklch(0.97 0.02 285)",
            day ? "oklch(0.985 0.014 285)" : "oklch(0.983 0.014 295)",
          ];
    case "thunder":
      // Thunder:
      // - Day: storm violet (electric)
      // - Night: deeper purple-black
      return dark
        ? ["oklch(0.28 0.10 275)", "oklch(0.21 0.05 260)", "oklch(0.2178 0 0)"]
        : ["oklch(0.94 0.04 285)", "oklch(0.96 0.02 250)", "oklch(1 0 0)"];
  }
}

export function getWeatherGradient(params: {
  condition: WeatherCondition;
  isDay?: boolean;
  theme: "light" | "dark";
}): WeatherGradient {
  const isDay = params.isDay ?? true;
  const [a, b, c] = stopsFor(params.condition, isDay, params.theme);

  /**
   * Rendering:
   * - Two radial gradients provide “atmosphere” (like light in a room).
   * - A vertical wash anchors the overall page tint.
   *
   * This layering keeps the effect soft and avoids banding while still being
   * noticeably “alive” in light mode.
   */
  const backgroundImage = [
    `radial-gradient(900px 500px at 20% 10%, ${a} 0%, transparent 70%)`,
    `radial-gradient(900px 500px at 80% 0%, ${b} 0%, transparent 65%)`,
    `linear-gradient(180deg, ${b} 0%, ${c} 70%)`,
  ].join(", ");

  return { backgroundImage };
}
