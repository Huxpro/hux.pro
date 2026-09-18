// =============================================================================
// Capability detection for the shader wallpaper.
// =============================================================================

let webgl2Cache: boolean | null = null;

/** Whether this browser can create a WebGL2 context (cached per session). */
export function supportsWebGL2(): boolean {
  if (typeof window === "undefined") return false;
  if (webgl2Cache !== null) return webgl2Cache;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    webgl2Cache = !!gl;
    // Free the probe context eagerly; browsers cap live contexts.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2Cache = false;
  }
  return webgl2Cache;
}

function isCoarsePointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export interface WallpaperQualityProfile {
  /** Target internal pixel count; the canvas is upscaled by CSS beyond it. */
  pixelBudget: number;
  /**
   * Frame-rate cap. Only a whole divisor of the display's refresh rate is
   * actually deliverable — the loop can skip an animation frame but it cannot
   * invent one between two — so a cap of 45 on a 60 Hz panel does not give 45,
   * it gives 30, and on 120 Hz it gives 40. Ask for a rate the panels in use
   * can hit, or the number is not the one that takes effect.
   */
  maxFps: number;
}

/**
 * The scene is soft (gradients, fbm clouds), so rendering below device
 * resolution and letting CSS upscale is nearly invisible — and it is what
 * keeps a full-screen five-octave fbm affordable on phones.
 */
export function getWallpaperQualityProfile(): WallpaperQualityProfile {
  const coarse = isCoarsePointer();
  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 8;
  if (coarse) {
    // 45 was meant to buy back some battery, and on every phone panel there is
    // it bought half the frame rate instead: 60 Hz cannot deliver 45, so the
    // gate dropped every second frame and the page ran at a flat 30. That is
    // what reads as dropped frames on a phone fast enough for 60 — the motion
    // is half-rate, not late. Fewer pixels is the honest way to spend less
    // here, and that is what pixelBudget is for.
    return { pixelBudget: cores <= 4 ? 320_000 : 480_000, maxFps: 60 };
  }
  return { pixelBudget: cores <= 4 ? 700_000 : 1_100_000, maxFps: 60 };
}
